package email

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	brevo "github.com/getbrevo/brevo-go/lib"
)

// BrevoClient wraps the Brevo API client
type BrevoClient struct {
	client *brevo.APIClient
	apiKey string
}

// NewBrevoClient creates a new Brevo API client from environment
func NewBrevoClient() (*BrevoClient, error) {
	apiKey := os.Getenv("BREVO_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("BREVO_API_KEY not set")
	}

	cfg := brevo.NewConfiguration()
	cfg.AddDefaultHeader("api-key", apiKey)
	client := brevo.NewAPIClient(cfg)

	log.Printf("[email-brevo] client initialized")
	return &BrevoClient{client: client, apiKey: apiKey}, nil
}

// SendContractExpiryViaBrevo sends a contract expiry notification via Brevo API
func (bc *BrevoClient) SendContractExpiryViaBrevo(
	ctx context.Context,
	contractNumber string,
	daysLeft int,
	expiryDate time.Time,
	contractName string,
	clientName string,
	companyName string,
	contractID int64,
	recipients []string,
	adminEmail string,
) error {
	// Build subject
	subject := fmt.Sprintf("⚠️ Contrato %s vence en %d días — Acción requerida", contractNumber, daysLeft)

	// Build HTML body (inline template — simple for now)
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 15px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
    .alert { background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 15px 0; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
    .footer { color: #64748b; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h2>📅 Recordatorio de Vencimiento</h2></div>
    <div class="content">
      <p>El contrato <strong>%s</strong> vence en <strong>%d días</strong> (%s).</p>
      <div class="alert"><strong>⚠️ Acción requerida:</strong> Para renovar, cree un nuevo suplemento que actualice la fecha de vencimiento y los valores correspondientes.</div>
      <h3>Detalles:</h3>
      <ul>
        <li><strong>Contrato:</strong> %s</li>
        <li><strong>Cliente:</strong> %s</li>
        <li><strong>Empresa:</strong> %s</li>
        <li><strong>Vencimiento:</strong> %s</li>
      </ul>
      <p><a href="https://pacta.example.com/contracts/%d/supplement" class="button">🔷 Renovar Contrato en PACTA</a></p>
      <p>¿Preguntas? Contacte al administrador: <a href="mailto:%s">%s</a></p>
    </div>
    <div class="footer">Este es un recordatorio automático de PACTA — Contract Management System.</div>
  </div>
</body>
</html>`,
		contractNumber, daysLeft, expiryDate.Format("2006-01-02"),
		contractName, clientName, companyName, expiryDate.Format("2006-01-02"),
		contractID, adminEmail, adminEmail)

	// Build Brevo SendSmtpEmail payload
	sendSmtpEmail := &brevo.SendSmtpEmail{
		Subject:     &subject,
		HtmlContent: &html,
		Sender: &brevo.SendSmtpEmailSender{
			Name:  "PACTA",
			Email: os.Getenv("EMAIL_FROM"),
		},
		ReplyTo: nil,
		Bcc:     nil,
		Cc:      nil,
	}

	// Build To recipients list
	toList := make([]brevo.SendSmtpEmailTo, 0, len(recipients))
	for _, email := range recipients {
		toList = append(toList, brevo.SendSmtpEmailTo{Email: email})
	}
	sendSmtpEmail.To = toList

	// Call Brevo API
	_, _, err := bc.client.TransactionalEmailsApi.SendTransacEmail(ctx, sendSmtpEmail)
	if err != nil {
		log.Printf("[email-brevo] failed for contract %s: %v", contractNumber, err)
		return fmt.Errorf("brevo send failed: %w", err)
	}

	log.Printf("[email-brevo] sent contract %s expiry (%d days) to %v", contractNumber, daysLeft, recipients)
	return nil
}
