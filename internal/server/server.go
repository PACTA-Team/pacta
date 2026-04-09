package server

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/PACTA-Team/pacta/internal/config"
	"github.com/PACTA-Team/pacta/internal/db"
	"github.com/PACTA-Team/pacta/internal/handlers"
)

//go:embed frontend/out
var staticFS embed.FS

func Start(cfg *config.Config) error {
	database, err := db.Open(cfg.DataDir)
	if err != nil {
		return err
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		return err
	}

	h := &handlers.Handler{DB: database}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Auth routes (no auth required)
	r.Post("/api/auth/login", h.HandleLogin)
	r.Post("/api/auth/logout", h.HandleLogout)

	// Authenticated API routes
	r.Group(func(r chi.Router) {
		r.Use(h.AuthMiddleware)

		r.Get("/api/auth/me", h.HandleMe)

		r.Get("/api/contracts", h.HandleContracts)
		r.Post("/api/contracts", h.HandleContracts)
		r.Get("/api/contracts/{id}", h.HandleContractByID)
		r.Put("/api/contracts/{id}", h.HandleContractByID)
		r.Delete("/api/contracts/{id}", h.HandleContractByID)

		r.Get("/api/clients", h.HandleClients)
		r.Post("/api/clients", h.HandleClients)

		r.Get("/api/suppliers", h.HandleSuppliers)
		r.Post("/api/suppliers", h.HandleSuppliers)
	})

	// Static files (Next.js export) - catch-all
	staticSub, _ := fs.Sub(staticFS, "frontend/out")
	r.Handle("/*", http.FileServer(http.FS(staticSub)))

	srv := &http.Server{
		Addr:         cfg.Addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("PACTA v%s running on http://127.0.0.1%s", cfg.Version, cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Listen: %v", err)
		}
	}()

	// Open browser
	openBrowser("http://127.0.0.1" + cfg.Addr)

	// Wait for signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down...")
	return nil
}
