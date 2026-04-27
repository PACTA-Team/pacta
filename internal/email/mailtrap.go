package email

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/wneessen/go-mail"
)

// SMTPConfig holds the configuration for Mailtrap SMTP client
type SMTPConfig struct {
	Host string
	Port int
	User string
	Pass string
	From string
}

// GetSMTPConfig loads SMTP configuration from database or environment
func GetSMTPConfig(db *sql.DB) (SMTPConfig, error) {
	cfg := SMTPConfig{
		Host: "smtp.mailtrap.io",
		Port: 587,
		From: "PACTA <noreply@pacta.duckdns.org>",
	}

	// Get from database
	if db != nil {
		if v, err := getSetting(db, "mailtrap_smtp_host"); err == nil && v != "" {
			cfg.Host = v
		}
		if v, err := getSetting(db, "mailtrap_smtp_user"); err == nil && v != "" {
			cfg.User = v
		}
		if v, err := getSetting(db, "mailtrap_smtp_pass"); err == nil && v != "" {
			cfg.Pass = v
		}
		if v, err := getSetting(db, "email_from"); err == nil && v != "" {
			cfg.From = v
		}
	}

	// Fallback to environment
	if cfg.User == "" {
		cfg.User = os.Getenv("MAILTRAP_SMTP_USER")
	}
	if cfg.Pass == "" {
		cfg.Pass = os.Getenv("MAILTRAP_SMTP_PASS")
	}
	if cfg.Host == "smtp.mailtrap.io" && os.Getenv("MAILTRAP_SMTP_HOST") != "" {
		cfg.Host = os.Getenv("MAILTRAP_SMTP_HOST")
	}
	if cfg.From == "PACTA <noreply@pacta.duckdns.org>" && os.Getenv("EMAIL_FROM") != "" {
		cfg.From = os.Getenv("EMAIL_FROM")
	}

	return cfg, nil
}

// SendWithMailtrap sends email using Mailtrap SMTP
func SendWithMailtrap(ctx context.Context, msg *mail.Msg, cfg SMTPConfig) error {
	if cfg.User == "" || cfg.Pass == "" {
		return fmt.Errorf("Mailtrap credentials not configured")
	}

	opts := []mail.Option{
		mail.WithPort(cfg.Port),
		mail.WithTLSPortPolicy(mail.TLSMandatory),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithUsername(cfg.User),
		mail.WithPassword(cfg.Pass),
	}

	client, err := mail.NewClient(cfg.Host, opts...)
	if err != nil {
		return fmt.Errorf("failed to create Mailtrap client: %w", err)
	}

	log.Printf("[email] sending via Mailtrap (%s:%d)", cfg.Host, cfg.Port)
	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		return fmt.Errorf("Mailtrap send failed: %w", err)
	}

	log.Printf("[email] email sent via Mailtrap")
	return nil
}

// getSetting retrieves a setting value from the system_settings table
func getSetting(db *sql.DB, key string) (string, error) {
	var value string
	err := db.QueryRow("SELECT value FROM system_settings WHERE key = ?", key).Scan(&value)
	return value, err
}