package server

import (
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

func Start(cfg *config.Config, staticFS fs.FS) error {
	database, err := db.Open(cfg.DataDir)
	if err != nil {
		return err
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		return err
	}

	h := &handlers.Handler{DB: database, DataDir: cfg.DataDir}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Auth routes (no auth required)
	r.Post("/api/auth/login", h.HandleLogin)
	r.Post("/api/auth/logout", h.HandleLogout)

	// Setup routes (no auth required, gated by first-run check)
	r.Get("/api/setup/status", h.HandleSetupStatus)
	r.Post("/api/setup", h.HandleSetup)

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
		r.Get("/api/clients/{id}", h.HandleClientByID)
		r.Put("/api/clients/{id}", h.HandleClientByID)
		r.Delete("/api/clients/{id}", h.HandleClientByID)

		r.Get("/api/suppliers", h.HandleSuppliers)
		r.Post("/api/suppliers", h.HandleSuppliers)
		r.Get("/api/suppliers/{id}", h.HandleSupplierByID)
		r.Put("/api/suppliers/{id}", h.HandleSupplierByID)
		r.Delete("/api/suppliers/{id}", h.HandleSupplierByID)

		r.Get("/api/signers", h.HandleSigners)
		r.Post("/api/signers", h.HandleSigners)
		r.Get("/api/signers/{id}", h.HandleSignerByID)
		r.Put("/api/signers/{id}", h.HandleSignerByID)
		r.Delete("/api/signers/{id}", h.HandleSignerByID)

		r.Get("/api/audit-logs", h.HandleAuditLogs)

		r.Get("/api/supplements", h.HandleSupplements)
		r.Post("/api/supplements", h.HandleSupplements)
		r.Get("/api/supplements/{id}", h.HandleSupplementByID)
		r.Put("/api/supplements/{id}", h.HandleSupplementByID)
		r.Patch("/api/supplements/{id}/status", h.HandleSupplementStatus)
		r.Delete("/api/supplements/{id}", h.HandleSupplementByID)

		// Document routes
		r.Get("/api/documents", h.HandleDocuments)
		r.Post("/api/documents", h.HandleDocuments)
		r.Get("/api/documents/{id}/download", h.HandleDocumentByID)
		r.Delete("/api/documents/{id}", h.HandleDocumentByID)
	})

	// Static files (Vite build output) - catch-all
	staticSub, _ := fs.Sub(staticFS, "dist")
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
