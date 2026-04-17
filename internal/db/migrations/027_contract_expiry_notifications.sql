-- +goose Up
CREATE TABLE contract_expiry_notification_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT true,
    frequency_hours INTEGER NOT NULL DEFAULT 6,
    thresholds_days TEXT NOT NULL DEFAULT '[30,14,7,1]',
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contract_expiry_notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    threshold_days INTEGER NOT NULL,
    sent_to_user BOOLEAN NOT NULL DEFAULT false,
    sent_to_admin BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMP,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'failed',
    error_message TEXT,
    channel VARCHAR(10) NOT NULL DEFAULT 'smtp',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contract_id, threshold_days)
);

CREATE INDEX idx_contract_expiry_log_contract ON contract_expiry_notification_log(contract_id);
CREATE INDEX idx_contract_expiry_log_threshold ON contract_expiry_notification_log(threshold_days);
CREATE INDEX idx_contract_expiry_log_created ON contract_expiry_notification_log(created_at DESC);

INSERT INTO contract_expiry_notification_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS contract_expiry_notification_log;
DROP TABLE IF EXISTS contract_expiry_notification_settings;
