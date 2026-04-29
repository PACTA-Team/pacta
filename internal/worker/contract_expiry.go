package worker

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/wneessen/go-mail"
	"github.com/PACTA-Team/pacta/internal/email"
	"github.com/PACTA-Team/pacta/internal/models"
	"github.com/PACTA-Team/pacta/internal/config"
)

type ContractExpiryWorker struct {
	config  *config.Service
	logger  *log.Logger
	ticker  *time.Ticker
	running bool
	mu      sync.RWMutex
}

func NewContractExpiryWorker(cfg *config.Service) *ContractExpiryWorker {
	return &ContractExpiryWorker{
		config:  cfg,
		logger:  log.New(os.Stdout, "[email-worker] ", log.LstdFlags),
		ticker:  nil,
		running: false,
	}
}

// checkEmailEnabled checks if global email notifications are enabled
func (w *ContractExpiryWorker) checkEmailEnabled() bool {
	var enabled string
	err := w.config.DB.QueryRow("SELECT value FROM system_settings WHERE key = 'email_notifications_enabled'").Scan(&enabled)
	if err != nil || enabled == "false" {
		w.logger.Printf("[worker] email_notifications disabled in settings")
		return false
	}
	return true
}

// checkContractExpiryEnabled checks if contract expiry notifications are enabled
func (w *ContractExpiryWorker) checkContractExpiryEnabled() bool {
	var enabled string
	err := w.config.DB.QueryRow("SELECT value FROM system_settings WHERE key = 'email_contract_expiry_enabled'").Scan(&enabled)
	if err != nil || enabled == "false" {
		w.logger.Printf("[worker] contract_expiry notifications disabled in settings")
		return false
	}
	return true
}

func (w *ContractExpiryWorker) Start() {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return
	}
	w.running = true
	w.mu.Unlock()

	// Load settings to get frequency
	settings, err := w.loadSettings()
	if err != nil {
		w.logger.Printf("ERROR loading settings: %v — using default 6h", err)
		settings = &models.ContractExpirySettings{Enabled: true, FrequencyHours: 6, ThresholdsDays: []int{30, 14, 7, 1}}
	}

	// If disabled, don't start ticker
	if !settings.Enabled {
		w.logger.Println("worker disabled by settings — not starting")
		w.mu.Lock()
		w.running = false
		w.mu.Unlock()
		return
	}

	w.ticker = time.NewTicker(time.Duration(settings.FrequencyHours) * time.Hour)
	w.logger.Printf("started — frequency: %dh, thresholds: %v", settings.FrequencyHours, settings.ThresholdsDays)

	go w.run()
}

func (w *ContractExpiryWorker) Stop() {
	w.mu.Lock()
	w.running = false
	w.mu.Unlock()
	if w.ticker != nil {
		w.ticker.Stop()
	}
	w.logger.Println("stopped")
}

func (w *ContractExpiryWorker) run() {
	for w.running {
		w.runCycle()
		<-w.ticker.C
	}
}

func (w *ContractExpiryWorker) loadSettings() (*models.ContractExpirySettings, error) {
	var s models.ContractExpirySettings
	err := w.config.DB.QueryRow(`
		SELECT id, enabled, frequency_hours, thresholds_days, updated_by, updated_at
		FROM contract_expiry_notification_settings
		WHERE id = 1
	`).Scan(&s.ID, &s.Enabled, &s.FrequencyHours, &s.ThresholdsDays, &s.UpdatedBy, &s.UpdatedAt)

	if err == sql.ErrNoRows {
		// Should not happen (migration inserts singleton), but default
		return &models.ContractExpirySettings{
			ID:              1,
			Enabled:         true,
			FrequencyHours:  6,
			ThresholdsDays:  models.IntArray{30, 14, 7, 1},
		}, nil
	}
	return &s, err
}

// contractInfo holds the data needed for sending notification
type contractInfo struct {
	ID             int64
	ContractNumber string
	Name           string
	ExpiryDate     time.Time // end_date parsed as time.Time
	CreatedBy      int64
	ClientName     string
	CompanyName    string
	CompanyID      int64
}

func (w *ContractExpiryWorker) queryExpiringContracts(thresholdDays int) ([]contractInfo, error) {
	rows, err := w.config.DB.Query(`
		SELECT c.id, c.contract_number, c.title, c.end_date, c.created_by,
		       cl.name AS client_name, co.name AS company_name, cl.company_id
		FROM contracts c
		JOIN clients cl ON c.client_id = cl.id
		JOIN companies co ON cl.company_id = co.id
		WHERE c.end_date BETWEEN DATE('now', ? || ' days') AND DATE('now', ? || ' days')
		  AND c.status = 'active'
		  AND c.deleted_at IS NULL
		  AND NOT EXISTS (
		      SELECT 1 FROM contract_expiry_notification_log l
		      WHERE l.contract_id = c.id AND l.threshold_days = ?
		  )
		ORDER BY c.end_date ASC
		LIMIT 1000
	`, thresholdDays, thresholdDays, thresholdDays)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var contracts []contractInfo
	for rows.Next() {
		var c contractInfo
		var expiryDateStr string
		err := rows.Scan(&c.ID, &c.ContractNumber, &c.Name, &expiryDateStr, &c.CreatedBy,
			&c.ClientName, &c.CompanyName, &c.CompanyID)
		if err != nil {
			return nil, err
		}
		// Parse expiry date from "2006-01-02" format
		c.ExpiryDate, err = time.Parse("2006-01-02", expiryDateStr)
		if err != nil {
			return nil, fmt.Errorf("parsing expiry date %s: %w", expiryDateStr, err)
		}
		contracts = append(contracts, c)
	}
	return contracts, rows.Err()
}

func (w *ContractExpiryWorker) processContract(ctx context.Context, contract contractInfo, thresholdDays int) error {
	// 1. Get owner user
	owner, err := w.config.GetUserByID(contract.CreatedBy)
	if err != nil {
		w.logger.Printf("ERROR getting owner %d for contract %s: %v", contract.CreatedBy, contract.ContractNumber, err)
		return err
	}
	// 2. Get admins for company
	admins, err := w.config.GetUsersByCompanyAndRole(contract.CompanyID, "admin")
	if err != nil {
		w.logger.Printf("ERROR getting admins for company %d: %v", contract.CompanyID, err)
		return err
	}

	// Dedupe emails
	emailSet := make(map[string]bool)
	emailSet[owner.Email] = false
	for _, admin := range admins {
		emailSet[admin.Email] = false
	}
	var recipients []string
	for email := range emailSet {
		recipients = append(recipients, email)
	}

	if len(recipients) == 0 {
		w.logger.Printf("WARNING: no recipients for contract %s", contract.ContractNumber)
		return nil // skip
	}

	// 3. Determine admin contact email (first admin or fallback)
	adminEmail := "support@pacta.example.com"
	if len(admins) > 0 {
		adminEmail = admins[0].Email
	}

	// 4. Send via Mailtrap SMTP
	err = w.sendContractExpiryEmail(ctx, contract, thresholdDays, recipients, adminEmail)
	if err != nil {
		w.logger.Printf("[email-worker] send failed for contract %s (threshold %d): %v", contract.ContractNumber, thresholdDays, err)
		// Log failure
		w.logSend(contract.ID, thresholdDays, false, false, err, "smtp")
		return err
	}

	// 5. Log success
	w.logSend(contract.ID, thresholdDays, true, true, nil, "mailtrap")
	return nil
}

func (w *ContractExpiryWorker) sendContractExpiryEmail(
	ctx context.Context,
	contract contractInfo,
	thresholdDays int,
	recipients []string,
	adminEmail string,
) error {
	cfg, err := email.GetSMTPConfig(w.config.DB)
	if err != nil {
		return fmt.Errorf("failed to get SMTP config: %w", err)
	}

	subject := fmt.Sprintf("⚠️ Contrato %s vence en %d días — Acción requerida", contract.ContractNumber, thresholdDays)
	html := buildEmailHTML(contract, thresholdDays, adminEmail)

	msg := mail.NewMsg()
	if err := msg.From(cfg.From); err != nil {
		return fmt.Errorf("failed to set From: %w", err)
	}
	for _, r := range recipients {
		if err := msg.To(r); err != nil {
			return fmt.Errorf("failed to add recipient %s: %w", r, err)
		}
	}
	msg.Subject(subject)
	msg.SetBodyString(mail.TypeTextHTML, html)

	return email.SendEmail(ctx, msg, w.config.DB)
}

func buildEmailHTML(contract contractInfo, daysLeft int, adminEmail string) string {
	return fmt.Sprintf(`<!DOCTYPE html><html><head><style>body{font-family:sans-serif;line-height:1.6}.c{max-width:600px;margin:0 auto;padding:20px}.h{background:#f59e0b;color:white;padding:15px;text-align:center}.a{background:#fef2f2;border-left:4px solid #dc2626;padding:12px;margin:15px 0}.b{display:inline-block;background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px}.f{color:#64748b;font-size:12px;margin-top:20px}</style></head><body><div class="c"><div class="h"><h2>📅 Recordatorio de Vencimiento</h2></div><div class="c"><p>El contrato <strong>%s</strong> vence en <strong>%d días</strong> (%s).</p><div class="a"><strong>⚠️ Acción requerida:</strong> Para renovar, cree un nuevo suplemento que actualice la fecha de vencimiento y los valores correspondientes.</div><h3>Detalles:</h3><ul><li><strong>Contrato:</strong> %s</li><li><strong>Cliente:</strong> %s</li><li><strong>Empresa:</strong> %s</li><li><strong>Vencimiento:</strong> %s</li></ul><p><a href="https://pacta.example.com/contracts/%d/supplement" class="b">🔷 Renovar Contrato en PACTA</a></p><p>¿Preguntas? Contacte al administrador: <a href="mailto:%s">%s</a></p></div><div class="f">Este es un recordatorio automático de PACTA.</div></div></body></html>`,
		contract.ContractNumber, daysLeft, contract.ExpiryDate.Format("2006-01-02"),
		contract.Name, contract.ClientName, contract.CompanyName, contract.ExpiryDate.Format("2006-01-02"),
		contract.ID, adminEmail, adminEmail)
}

func (w *ContractExpiryWorker) logSend(
	contractID int64,
	threshold int,
	sentToUser, sentToAdmin bool,
	err error,
	channel string,
) {
	status := "sent"
	var errMsg *string
	if err != nil {
		status = "failed"
		msg := err.Error()
		errMsg = &msg
	}

	_, dbErr := w.config.DB.Exec(`
		INSERT INTO contract_expiry_notification_log
			(contract_id, threshold_days, sent_to_user, sent_to_admin, sent_at, delivery_status, error_message, channel)
		VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)
		ON CONFLICT (contract_id, threshold_days)
		DO UPDATE SET
			sent_to_user = excluded.sent_to_user,
			sent_to_admin = excluded.sent_to_admin,
			sent_at = excluded.sent_at,
			delivery_status = excluded.delivery_status,
			error_message = excluded.error_message,
			channel = excluded.channel
	`, contractID, threshold, sentToUser, sentToAdmin, status, errMsg, channel)

	if dbErr != nil {
		w.logger.Printf("ERROR logging notification for contract %d: %v", contractID, dbErr)
	} else {
		w.logger.Printf("logged contract %d threshold %d: status=%s channel=%s", contractID, threshold, status, channel)
	}
}

func (w *ContractExpiryWorker) runCycle() {
	w.logger.Println("cycle start")

	// Check global email toggle
	if !w.checkEmailEnabled() {
		w.logger.Println("email notifications disabled — skipping cycle")
		return
	}

	// Check contract expiry specific toggle
	if !w.checkContractExpiryEnabled() {
		w.logger.Println("contract expiry notifications disabled — skipping cycle")
		return
	}

	// 1. Load settings
	settings, err := w.loadSettings()
	if err != nil {
		w.logger.Printf("ERROR loading settings: %v — skipping cycle", err)
		return
	}
	if !settings.Enabled {
		w.logger.Println("worker disabled — skipping")
		return
	}

	w.logger.Printf("processing thresholds: %v", settings.ThresholdsDays)

	// 2. For each threshold
	totalSent := 0
	for _, days := range settings.ThresholdsDays {
		contracts, err := w.queryExpiringContracts(days)
		if err != nil {
			w.logger.Printf("ERROR querying contracts for %d days: %v", days, err)
			continue
		}

		w.logger.Printf("threshold %d days: %d contracts to process", days, len(contracts))

		for _, contract := range contracts {
			err := w.processContract(context.Background(), contract, days)
			if err != nil {
				w.logger.Printf("ERROR processing contract %s (ID=%d): %v", contract.ContractNumber, contract.ID, err)
			} else {
				totalSent++
			}
			time.Sleep(100 * time.Millisecond) // rate limit
		}
	}

	w.logger.Printf("cycle complete — total notifications sent: %d", totalSent)
}
