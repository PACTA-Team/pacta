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
	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/config"
	"github.com/PACTA-Team/pacta/internal/db"
	"github.com/PACTA-Team/pacta/internal/email"
	"github.com/PACTA-Team/pacta/internal/handlers"
	"github.com/PACTA-Team/pacta/internal/server/middleware"
	"github.com/PACTA-Team/pacta/internal/worker"
)

func Start(cfg *config.Config, staticFS fs.FS) error {
	database, err := db.Open(cfg.DataDir)
	if err != nil {
		return err
	}
	defer database.Close()

	// Configure connection pool for production workloads
	// NOTE: SQLite connection pool size is managed by GORM/sqlx defaults
	// For RLS via session_tenant_context table, we rely on each request
	// setting its own tenant context within its transaction scope.
	// database.SetMaxOpenConns(100)  // Optional: tune based on load
	// database.SetMaxIdleConns(10)

	if err := db.Migrate(database); err != nil {
		return err
	}

	h := &handlers.Handler{DB: database, DataDir: cfg.DataDir}

	// Create a service that bundles config and DB for worker and settings handler
	svc := &config.Service{Config: cfg, DB: database}

	r := chi.NewRouter()
	r.Use(middleware.NewCORS())
	r.Use(middleware.SecurityHeaders())
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	// Apply CSRF protection globally with auth endpoints exempt
	r.Use(middleware.CSRFProtection([]string{
		"/api/auth/login",
		"/api/auth/register",
		"/api/auth/logout",
		"/api/auth/verify-code",
		"/api/setup/status",
		"/api/setup",
	}))
	r.Use(middleware.RateLimit())
	// Tenant isolation: sets session_tenant_context for RLS triggers
	r.Use(h.TenantContextMiddleware)

	// Auth routes (no auth required, exempt from CSRF via global config)
	r.Post("/api/auth/login", h.HandleLogin)
	r.Post("/api/auth/register", h.HandleRegister)
	r.Post("/api/auth/logout", h.HandleLogout)
	r.Post("/api/auth/verify-code", h.HandleVerifyCode)

	// Public companies list (for registration form)
	r.Get("/api/public/companies", h.HandlePublicCompanies)

	// Setup routes (no auth required, gated by first-run check, exempt from CSRF via global config)
	r.Get("/api/setup/status", h.HandleSetupStatus)
	r.Post("/api/setup", h.HandleSetup)

	// User setup route (authenticated, for completing user company config)
	r.Patch("/api/setup", h.HandleUserSetup)

	// Authenticated API routes
	r.Group(func(r chi.Router) {
		r.Use(h.AuthMiddleware)
		r.Use(h.CompanyMiddleware)

		// User profile routes
		r.Get("/api/user/profile", h.HandleUserProfile)
		r.Patch("/api/user/profile", h.HandleUserProfile)
		r.Post("/api/user/change-password", h.HandleChangePassword)
		r.Post("/api/user/certificate", h.HandleCertificate)
		r.Delete("/api/user/certificate/{type}", h.HandleCertificate)

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
			// Temp document verification (HEAD)
			r.Head("/api/documents/temp/{key}", h.HandleVerifyTempDocument)
			// Allow GET for convenience (fetch temp file directly)
			r.Get("/api/documents/temp/{key}", h.HandleServeTempDocument)
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
			// Temporary document upload (for contract form before contract is created)
			r.Post("/api/upload/temp", h.HandleUploadTempDocument)
			r.Delete("/api/documents/temp/{key}", h.HandleCleanupTempDocument)
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

			// Approval routes (protected by RequireRole(auth.RoleAdmin) above)
			r.Get("/api/approvals/pending", h.HandlePendingApprovals)
			r.Post("/api/approvals", h.HandlePendingApprovals)

			// Pending activations from setup wizard
			r.Get("/api/activations/pending", h.HandlePendingActivations)

		// System settings
		r.Get("/api/system-settings", h.GetSystemSettings)
		r.Put("/api/system-settings", h.UpdateSystemSettings)

		// Contract expiry notification settings (Brevo worker)
		expirySettingsHandler := handlers.NewContractExpirySettingsHandler(svc)
		r.Get("/api/admin/settings/notifications", expirySettingsHandler.GetSettings)
		r.Put("/api/admin/settings/notifications", expirySettingsHandler.UpdateSettings)
	})
	})

	// Static files (Vite build output) - SPA catch-all
	staticSub, err := fs.Sub(staticFS, "dist")
	if err != nil {
		log.Printf("warning: static sub fs error: %v", err)
	}
	r.Handle("/*", spaHandler(staticSub))

	// --- Initialize Brevo email client and contract expiry worker ---
	brevoClient, err := email.NewBrevoClient(svc.DB)
	if err != nil {
		log.Printf("[email-worker] Brevo client not initialized: %v — contract expiry notifications will use SMTP only", err)
		brevoClient = nil
	}

	expiryWorker := worker.NewContractExpiryWorker(svc, brevoClient)
	expiryWorker.Start()
	defer expiryWorker.Stop()
	// -----------------------------------------------------------------

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
