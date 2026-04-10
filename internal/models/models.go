package models

import "time"

type User struct {
	ID           int        `json:"id"`
	Name         string     `json:"name"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	Role         string     `json:"role"`
	Status       string     `json:"status"`
	LastAccess   *time.Time `json:"last_access,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type Client struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Address   *string   `json:"address,omitempty"`
	REUCode   *string   `json:"reu_code,omitempty"`
	Contacts  *string   `json:"contacts,omitempty"`
	CreatedBy *int      `json:"created_by,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Supplier struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Address   *string   `json:"address,omitempty"`
	REUCode   *string   `json:"reu_code,omitempty"`
	Contacts  *string   `json:"contacts,omitempty"`
	CreatedBy *int      `json:"created_by,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Contract struct {
	ID               int        `json:"id"`
	InternalID       string     `json:"internal_id"`
	ContractNumber   string     `json:"contract_number"`
	Title            string     `json:"title"`
	ClientID         int        `json:"client_id"`
	SupplierID       int        `json:"supplier_id"`
	ClientSignerID   *int       `json:"client_signer_id,omitempty"`
	SupplierSignerID *int       `json:"supplier_signer_id,omitempty"`
	StartDate        string     `json:"start_date"`
	EndDate          string     `json:"end_date"`
	Amount           float64    `json:"amount"`
	Type             string     `json:"type"`
	Status           string     `json:"status"`
	Description      *string    `json:"description,omitempty"`
	CreatedBy        *int       `json:"created_by,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type DashboardStats struct {
	TotalContracts   int            `json:"total_contracts"`
	ActiveContracts  int            `json:"active_contracts"`
	ExpiringSoon     int            `json:"expiring_soon"`
	ExpiredContracts int            `json:"expired_contracts"`
	TotalValue       float64        `json:"total_value"`
	ByStatus         map[string]int `json:"by_status"`
}
