package email

import (
	"context"
	"fmt"
	"log"

	"github.com/wneessen/go-mail"

	"github.com/PACTA-Team/pacta/internal/db"
)

type SMTPConfig struct {
	Host  string
	Port  int
	User  string
	Pass  string
	From  string
}

// GetSMTPConfig retrieves SMTP configuration from system_settings using sqlc Queries
func GetSMTPConfig(ctx context.Context, queries *db.Queries) (SMTPConfig, error) {
	cfg := SMTPConfig{
		Host: "smtp.mailtrap.io",
		Port: 587,
		From: "PACTA <noreply@pacta.duckdns.org>",
	}
	// If queries is nil, return defaults
	if queries == nil {
		return cfg, nil
	}
	// Fetch each setting individually
	if v, err := queries.GetSettingValue(ctx, "smtp_host"); err == nil && v != "" {
		cfg.Host = v
	}
	if v, err := queries.GetSettingValue(ctx, "smtp_port"); err == nil && v != "" {
		fmt.Sscanf(v, "%d", &cfg.Port)
	}
	if v, err := queries.GetSettingValue(ctx, "smtp_username"); err == nil && v != "" {
		cfg.User = v
	}
	if v, err := queries.GetSettingValue(ctx, "smtp_password"); err == nil && v != "" {
		cfg.Pass = v
	}
	if v, err := queries.GetSettingValue(ctx, "smtp_from"); err == nil && v != "" {
		cfg.From = v
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