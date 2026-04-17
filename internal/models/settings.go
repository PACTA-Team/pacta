package models

type ContractExpirySettings struct {
	ID              int64   `json:"id"`
	Enabled         bool    `json:"enabled"`
	FrequencyHours  int     `json:"frequency_hours"`
	ThresholdsDays  []int  `json:"thresholds_days"`
	UpdatedBy       int64   `json:"updated_by,omitempty"`
	UpdatedAt       string  `json:"updated_at,omitempty"`
}
