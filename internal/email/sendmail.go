package email

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/wneessen/go-mail"
)

// IsSMTPEnabled checks if SMTP is enabled in settings
func IsSMTPEnabled(db *sql.DB) bool {
	if db == nil {
		return true // default to enabled if no DB
	}
	var enabled string
	err := db.QueryRow("SELECT value FROM system_settings WHERE key = 'smtp_enabled'").Scan(&enabled)
	if err != nil || enabled == "false" {
		return false
	}
	return true
}

// SendEmail sends an email using Mailtrap SMTP configuration
func SendEmail(ctx context.Context, msg *mail.Msg, db *sql.DB) error {
	cfg, err := GetSMTPConfig(db)
	if err != nil {
		return fmt.Errorf("failed to get SMTP config: %w", err)
	}

	log.Printf("[email] sending via SendWithMailtrap")
	return SendWithMailtrap(ctx, msg, cfg)
}

// SendVerificationCode sends a verification code email to the user
func SendVerificationCode(ctx context.Context, to, code, lang string, db *sql.DB) error {
	cfg, err := GetSMTPConfig(db)
	if err != nil {
		log.Printf("[email] ERROR getting SMTP config: %v", err)
		cfg = SMTPConfig{
			From: "PACTA <noreply@pacta.duckdns.org>",
		}
	}

	template := GetVerificationTemplate(lang, code)

	msg := mail.NewMsg()
	if err := msg.From(cfg.From); err != nil {
		log.Printf("[email] ERROR setting from address: %v", err)
		return err
	}
	if err := msg.To(to); err != nil {
		log.Printf("[email] ERROR setting to address %s: %v", to, err)
		return err
	}
	msg.Subject(template.Subject)
	msg.SetBodyString(mail.TypeTextHTML, template.HTML)

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := SendEmail(ctx, msg, db); err != nil {
		log.Printf("[email] ERROR sending verification code to %s: %v", to, err)
		return err
	}

	log.Printf("[email] verification code sent to %s (%s)", to, lang)
	return nil
}

// SendAdminNotification sends a notification email to an admin
func SendAdminNotification(ctx context.Context, adminEmail, userName, userEmail, companyName, lang string, db *sql.DB) error {
	cfg, err := GetSMTPConfig(db)
	if err != nil {
		log.Printf("[email] ERROR getting SMTP config: %v", err)
		cfg = SMTPConfig{
			From: "PACTA <noreply@pacta.duckdns.org>",
		}
	}

	template := GetAdminNotificationTemplate(lang, userName, userEmail, companyName)

	msg := mail.NewMsg()
	if err := msg.From(cfg.From); err != nil {
		log.Printf("[email] ERROR setting from address: %v", err)
		return err
	}
	if err := msg.To(adminEmail); err != nil {
		log.Printf("[email] ERROR setting to address %s: %v", adminEmail, err)
		return err
	}
	msg.Subject(template.Subject)
	msg.SetBodyString(mail.TypeTextHTML, template.HTML)

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := SendEmail(ctx, msg, db); err != nil {
		log.Printf("[email] ERROR sending admin notification to %s: %v", adminEmail, err)
		return err
	}

	log.Printf("[email] admin notification sent to %s (%s)", adminEmail, lang)
	return nil
}
