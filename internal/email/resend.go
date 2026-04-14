package email

import (
	"context"
	"log"
	"os"
	"sync"

	"github.com/resend/resend-go/v3"
)

var (
	client     *resend.Client
	clientOnce sync.Once
)

func Init(apiKey string) {
	clientOnce.Do(func() {
		if apiKey == "" {
			log.Println("[email] RESEND_API_KEY not set, email features disabled")
			return
		}
		client = resend.NewClient(apiKey)
	})
}

func IsEnabled() bool {
	return client != nil
}

func SendVerificationCode(ctx context.Context, to, code string) error {
	if client == nil {
		log.Printf("[email] verification code for %s not sent (email disabled)", to)
		return nil
	}

	from := os.Getenv("EMAIL_FROM")
	if from == "" {
		from = "PACTA <onboarding@resend.dev>"
	}

	params := &resend.SendEmailRequest{
		To:      []string{to},
		From:    from,
		Subject: "Your PACTA Verification Code",
		Html:    verificationEmailHTML(code),
	}

	_, err := client.Emails.SendWithContext(ctx, params)
	return err
}

func SendAdminNotification(ctx context.Context, adminEmail, userName, userEmail, companyName string) error {
	if client == nil {
		log.Printf("[email] admin notification for %s not sent (email disabled)", adminEmail)
		return nil
	}

	from := os.Getenv("EMAIL_FROM")
	if from == "" {
		from = "PACTA <onboarding@resend.dev>"
	}

	params := &resend.SendEmailRequest{
		To:      []string{adminEmail},
		From:    from,
		Subject: "New User Registration Pending Approval",
		Html:    adminNotificationHTML(userName, userEmail, companyName),
	}

	_, err := client.Emails.SendWithContext(ctx, params)
	return err
}

func verificationEmailHTML(code string) string {
	return `<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1a1a1a">Verify Your PACTA Account</h2>
        <p>Enter this code to complete your registration:</p>
        <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;border-radius:8px;margin:20px 0">` + code + `</div>
        <p style="color:#666;font-size:14px">This code expires in 5 minutes.</p>
        <p style="color:#666;font-size:12px">If you didn't request this, ignore this email.</p>
    </body></html>`
}

func adminNotificationHTML(userName, userEmail, companyName string) string {
	return `<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1a1a1a">New User Registration Pending</h2>
        <p><strong>Name:</strong> ` + userName + `</p>
        <p><strong>Email:</strong> ` + userEmail + `</p>
        <p><strong>Company:</strong> ` + companyName + `</p>
        <p style="margin-top:20px">Log in to PACTA as admin to review and approve this registration.</p>
    </body></html>`
}
