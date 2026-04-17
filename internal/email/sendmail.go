package email

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/wneessen/go-mail"
)

// sendWithBrevo sends the email using Brevo SMTP relay
func sendWithBrevo(ctx context.Context, msg *mail.Msg) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")

	if smtpHost == "" {
		smtpHost = "smtp-relay.brevo.com"
	}

	opts := []mail.Option{
		mail.WithPort(587),
		mail.WithTLSPortPolicy(mail.TLSMandatory),
	}

	if smtpUser != "" && smtpPass != "" {
		opts = append(opts, mail.WithSMTPAuth(mail.SMTPAuthPlain))
		opts = append(opts, mail.WithUsername(smtpUser))
		opts = append(opts, mail.WithPassword(smtpPass))
	} else {
		return fmt.Errorf("Brevo SMTP credentials not fully configured (SMTP_USER/SMTP_PASS)")
	}

	client, err := mail.NewClient(smtpHost, opts...)
	if err != nil {
		return fmt.Errorf("failed to create Brevo client: %w", err)
	}

	log.Printf("[email] sending via Brevo (%s:587)", smtpHost)
	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		return fmt.Errorf("Brevo send failed: %w", err)
	}

	log.Printf("[email] email sent via Brevo")
	return nil
}

// sendWithGmail sends the email using Gmail SMTP as fallback
func sendWithGmail(ctx context.Context, msg *mail.Msg) error {
	gmailUser := os.Getenv("GMAIL_USER")
	gmailPass := os.Getenv("GMAIL_APP_PASSWORD")

	if gmailUser == "" || gmailPass == "" {
		return fmt.Errorf("Gmail credentials not configured (GMAIL_USER/GMAIL_APP_PASSWORD)")
	}

	opts := []mail.Option{
		mail.WithPort(587),
		mail.WithTLSPortPolicy(mail.TLSMandatory),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithUsername(gmailUser),
		mail.WithPassword(gmailPass),
	}

	client, err := mail.NewClient("smtp.gmail.com", opts...)
	if err != nil {
		return fmt.Errorf("failed to create Gmail client: %w", err)
	}

	log.Printf("[email] sending via Gmail fallback (smtp.gmail.com:587)")
	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		return fmt.Errorf("Gmail fallback failed: %w", err)
	}

	log.Printf("[email] email sent via Gmail fallback")
	return nil
}

// SendEmailWithFallback attempts to send via Brevo first, then Gmail on failure
func SendEmailWithFallback(ctx context.Context, msg *mail.Msg) error {
	// Check if Brevo is fully configured (all three vars must be non-empty)
	hasBrevo := os.Getenv("SMTP_HOST") != "" && os.Getenv("SMTP_USER") != "" && os.Getenv("SMTP_PASS") != ""

	if hasBrevo {
		err := sendWithBrevo(ctx, msg)
		if err == nil {
			return nil // Brevo succeeded
		}
		// Brevo failed — log and fallback to Gmail
		log.Printf("[email] Brevo send failed: %v. Falling back to Gmail…", err)
	} else {
		log.Printf("[email] Brevo not configured, using Gmail directly")
	}

	// Either Brevo was not configured or it failed — try Gmail
	err := sendWithGmail(ctx, msg)
	if err != nil {
		log.Printf("[email] Gmail fallback failed: %v", err)
		return err
	}
	return nil
}

// SendVerificationCode sends a verification code email to the user
func SendVerificationCode(ctx context.Context, to, code, lang string) error {
	from := os.Getenv("EMAIL_FROM")
	if from == "" {
		from = "PACTA <noreply@pacta.duckdns.org>"
	}

	template := GetVerificationTemplate(lang, code)

	msg := mail.NewMsg()
	if err := msg.From(from); err != nil {
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

	if err := SendEmailWithFallback(ctx, msg); err != nil {
		log.Printf("[email] ERROR sending verification code to %s: %v", to, err)
		return err
	}

	log.Printf("[email] verification code sent to %s (%s)", to, lang)
	return nil
}

// SendAdminNotification sends a notification email to an admin
func SendAdminNotification(ctx context.Context, adminEmail, userName, userEmail, companyName, lang string) error {
	from := os.Getenv("EMAIL_FROM")
	if from == "" {
		from = "PACTA <noreply@pacta.duckdns.org>"
	}

	template := GetAdminNotificationTemplate(lang, userName, userEmail, companyName)

	msg := mail.NewMsg()
	if err := msg.From(from); err != nil {
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

	if err := SendEmailWithFallback(ctx, msg); err != nil {
		log.Printf("[email] ERROR sending admin notification to %s: %v", adminEmail, err)
		return err
	}

	log.Printf("[email] admin notification sent to %s (%s)", adminEmail, lang)
	return nil
}
