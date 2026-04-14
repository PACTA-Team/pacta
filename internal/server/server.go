package server

import (
	"bytes"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/config"
	"github.com/PACTA-Team/pacta/internal/db"
	"github.com/PACTA-Team/pacta/internal/email"
	"github.com/PACTA-Team/pacta/internal/handlers"
)

func Start(cfg *config.Config, staticFS fs.FS) error {
	database, err := db.Open(cfg.DataDir)
	if err != nil {
		return err
	}
	defer database.Close()

	// Initialize email service
	email.Init(cfg.ResendAPIKey)

	if err := db.Migrate(database); err != nil {
		return err
	}

	h := &handlers.Handler{DB: database, DataDir: cfg.DataDir}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Auth routes (no auth required)
	r.Post("/api/auth/login", h.HandleLogin)
	r.Post("/api/auth/register", h.HandleRegister)
	r.Post("/api/auth/logout", h.HandleLogout)
	r.Post("/api/auth/verify-code", h.HandleVerifyCode)

	// Setup routes (no auth required, gated by first-run check)
	r.Get("/api/setup/status", h.HandleSetupStatus)
	r.Post("/api/setup", h.HandleSetup)

	// Authenticated API routes
	r.Group(func(r chi.Router) {
		r.Use(h.AuthMiddleware)
		r.Use(h.CompanyMiddleware)

		// Auth routes (no auth required)
		r.Get("/api/auth/me", h.HandleMe)

		// Viewer+ (read-only)
		r.Group(func(r chi.Router) {
			r.Use(h.RequireRole(auth.RoleViewer))

			r.Get("/api/companies", h.HandleCompanies)
			r.Get("/api/companies/{id}", h.HandleCompanyByID)
			r.Get("/api/users/me/companies", h.HandleUserCompanies)
			r.Get("/api/contracts", h.HandleContracts)
			r.Get("/api/contracts/{id}", h.HandleContractByID)
			r.Get("/api/clients", h.HandleClients)
			r.Get("/api/clients/{id}", h.HandleClientByID)
			r.Get("/api/suppliers", h.HandleSuppliers)
			r.Get("/api/suppliers/{id}", h.HandleSupplierByID)
			r.Get("/api/signers", h.HandleSigners)
			r.Get("/api/signers/{id}", h.HandleSignerByID)
			r.Get("/api/audit-logs", h.HandleAuditLogs)
			r.Get("/api/supplements", h.HandleSupplements)
			r.Get("/api/supplements/{id}", h.HandleSupplementByID)
			r.Get("/api/documents", h.HandleDocuments)
			r.Get("/api/documents/{id}/download", h.HandleDocumentByID)
			r.Get("/api/notifications", h.HandleNotifications)
			r.Get("/api/notifications/count", h.HandleNotificationCount)
			r.Get("/api/notifications/{id}", h.HandleNotificationByID)
			r.Get("/api/notification-settings", h.HandleNotificationSettings)
			r.Put("/api/notification-settings", h.HandleNotificationSettings)
		})

		// Editor+ (create/edit)
		r.Group(func(r chi.Router) {
			r.Use(h.RequireRole(auth.RoleEditor))

			r.Post("/api/companies", h.HandleCompanies)
			r.Put("/api/companies/{id}", h.HandleCompanyByID)
			r.Patch("/api/users/me/company/{id}", h.HandleSwitchCompany)
			r.Post("/api/contracts", h.HandleContracts)
			r.Put("/api/contracts/{id}", h.HandleContractByID)
			r.Post("/api/clients", h.HandleClients)
			r.Put("/api/clients/{id}", h.HandleClientByID)
			r.Post("/api/suppliers", h.HandleSuppliers)
			r.Put("/api/suppliers/{id}", h.HandleSupplierByID)
			r.Post("/api/signers", h.HandleSigners)
			r.Put("/api/signers/{id}", h.HandleSignerByID)
			r.Post("/api/supplements", h.HandleSupplements)
			r.Put("/api/supplements/{id}", h.HandleSupplementByID)
			r.Patch("/api/supplements/{id}/status", h.HandleSupplementStatus)
			r.Post("/api/documents", h.HandleDocuments)
			r.Post("/api/notifications", h.HandleNotifications)
			r.Patch("/api/notifications/mark-all-read", h.HandleMarkAllNotificationsRead)
			r.Patch("/api/notifications/{id}/read", h.HandleNotificationByID)
		})

		// Manager+ (delete)
		r.Group(func(r chi.Router) {
			r.Use(h.RequireRole(auth.RoleManager))

			r.Delete("/api/companies/{id}", h.HandleCompanyByID)
			r.Delete("/api/contracts/{id}", h.HandleContractByID)
			r.Delete("/api/clients/{id}", h.HandleClientByID)
			r.Delete("/api/suppliers/{id}", h.HandleSupplierByID)
			r.Delete("/api/signers/{id}", h.HandleSignerByID)
			r.Delete("/api/supplements/{id}", h.HandleSupplementByID)
			r.Delete("/api/documents/{id}", h.HandleDocumentByID)
			r.Delete("/api/notifications/{id}", h.HandleNotificationByID)
		})

		// Admin only
		r.Group(func(r chi.Router) {
			r.Use(h.RequireRole(auth.RoleAdmin))

			r.Get("/api/users", h.HandleUsers)
			r.Post("/api/users", h.HandleUsers)
			r.Get("/api/users/{id}", h.HandleUserByID)
			r.Put("/api/users/{id}", h.HandleUserByID)
			r.Delete("/api/users/{id}", h.HandleUserByID)
			r.Patch("/api/users/{id}/reset-password", h.HandleUserByID)
			r.Patch("/api/users/{id}/status", h.HandleUserByID)
			r.Patch("/api/users/{id}/company", h.HandleUserCompany)

			// Approval routes
			r.Get("/api/approvals/pending", h.HandlePendingApprovals)
			r.Post("/api/approvals", h.HandlePendingApprovals)
		})
	})

	// Static files (Vite build output) - SPA catch-all
	staticSub, err := fs.Sub(staticFS, "dist")
	if err != nil {
		log.Printf("warning: static sub fs error: %v", err)
	}
	r.Handle("/*", spaHandler(staticSub))

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

// spaHandler serves static files, falling back to index.html for SPA routing.
func spaHandler(fsys fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")

		// Try to open the requested file
		f, err := fsys.Open(path)
		if err != nil {
			// File doesn't exist - serve index.html for SPA routing
			indexFile, err := fsys.Open("index.html")
			if err != nil {
				http.Error(w, "index.html not found", http.StatusInternalServerError)
				return
			}
			defer indexFile.Close()

			stat, err := indexFile.Stat()
			if err != nil {
				http.Error(w, "index.html stat failed", http.StatusInternalServerError)
				return
			}

			// Read file into bytes since fs.File doesn't implement io.ReadSeeker
			data, err := io.ReadAll(indexFile)
			if err != nil {
				http.Error(w, "index.html read failed", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			http.ServeContent(w, r, "index.html", stat.ModTime(), bytes.NewReader(data))
			return
		}
		defer f.Close()

		// Check if it's a directory
		stat, err := f.Stat()
		if err == nil && stat.IsDir() {
			http.FileServer(http.FS(fsys)).ServeHTTP(w, r)
			return
		}

		// Serve the static file
		http.FileServer(http.FS(fsys)).ServeHTTP(w, r)
	})
}
