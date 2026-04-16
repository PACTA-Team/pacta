package email

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/wneessen/go-mail"
)

func getMailClient() (*mail.Client, error) {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")

	if smtpHost == "" {
		smtpHost = "localhost"
	}

	opts := []mail.Option{
		mail.WithTLSPortPolicy(mail.TLSOpportunistic),
	}

	if smtpUser != "" && smtpPass != "" {
		opts = append(opts, mail.WithSMTPAuth(mail.SMTPAuthPlain))
	}

	client, err := mail.NewClient(smtpHost, opts...)
	if err != nil {
		return nil, err
	}

	if smtpUser != "" && smtpPass != "" {
		client = client.WithUsername(smtpUser).WithPassword(smtpPass)
	}

	return client, nil
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

	client, err := getMailClient()
	if err != nil {
		log.Printf("[email] ERROR creating mail client: %v", err)
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
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

	client, err := getMailClient()
	if err != nil {
		log.Printf("[email] ERROR creating mail client: %v", err)
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		log.Printf("[email] ERROR sending admin notification to %s: %v", adminEmail, err)
		return err
	}

	log.Printf("[email] admin notification sent to %s (%s)", adminEmail, lang)
	return nil
}
