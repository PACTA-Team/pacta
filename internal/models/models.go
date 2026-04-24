package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type User struct {
	ID                    int        `json:"id"`
	Name                  string     `json:"name"`
	Email                 string     `json:"email"`
	PasswordHash          string     `json:"-"`
	Role                  string     `json:"role"`
	Status                string     `json:"status"`
	CompanyID             *int       `json:"company_id,omitempty"`
	LastAccess            *time.Time `json:"last_access,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	DigitalSignatureURL   *string    `json:"digital_signature_url,omitempty"`
	DigitalSignatureKey   *string    `json:"digital_signature_key,omitempty"`
	PublicCertURL         *string    `json:"public_cert_url,omitempty"`
	PublicCertKey         *string    `json:"public_cert_key,omitempty"`
	SetupCompleted        bool       `json:"setup_completed"`
	RoleAtCompany         string     `json:"role_at_company,omitempty"`
}

type Client struct {
	ID        int       `json:"id"`
	CompanyID int       `json:"company_id"`
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
	CompanyID int       `json:"company_id"`
	Name      string    `json:"name"`
	Address   *string   `json:"address,omitempty"`
	REUCode   *string   `json:"reu_code,omitempty"`
	Contacts  *string   `json:"contacts,omitempty"`
	CreatedBy *int      `json:"created_by,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Signer struct {
	ID          int       `json:"id"`
	CompanyID   int       `json:"company_id"`
	CompanyType string    `json:"company_type"`
	FirstName   string    `json:"first_name"`
	LastName    string    `json:"last_name"`
	Position    *string   `json:"position,omitempty"`
	Phone       *string   `json:"phone,omitempty"`
	Email       *string   `json:"email,omitempty"`
	CreatedBy   *int      `json:"created_by,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Contract struct {
	ID                  int        `json:"id"`
	CompanyID           int        `json:"company_id"`
	InternalID          string     `json:"internal_id"`
	ContractNumber      string     `json:"contract_number"`
	Title              *string   `json:"title,omitempty"`
	ClientID           int        `json:"client_id"`
	SupplierID         int        `json:"supplier_id"`
	ClientSignerID      *int       `json:"client_signer_id,omitempty"`
	SupplierSignerID  *int       `json:"supplier_signer_id,omitempty"`
	StartDate          string     `json:"start_date"`
	EndDate            string     `json:"end_date"`
	Amount             float64    `json:"amount"`
	Type               string     `json:"type"`
	Status             string     `json:"status"`
	Description       *string    `json:"description,omitempty"`
	Object             *string    `json:"object,omitempty"`
	FulfillmentPlace  *string    `json:"fulfillment_place,omitempty"`
	DisputeResolution *string    `json:"dispute_resolution,omitempty"`
	HasConfidentiality *bool      `json:"has_confidentiality,omitempty"`
	Guarantees        *string    `json:"guarantees,omitempty"`
	RenewalType       *string    `json:"renewal_type,omitempty"`
	DocumentURL       *string    `json:"document_url,omitempty"`
	DocumentKey       *string    `json:"document_key,omitempty"`
	CreatedBy         *int       `json:"created_by,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type DashboardStats struct {
	TotalContracts   int            `json:"total_contracts"`
	ActiveContracts  int            `json:"active_contracts"`
	ExpiringSoon     int            `json:"expiring_soon"`
	ExpiredContracts int            `json:"expired_contracts"`
	TotalValue       float64        `json:"total_value"`
	ByStatus         map[string]int `json:"by_status"`
}

type AuditLog struct {
	ID            int       `json:"id"`
	CompanyID     int       `json:"company_id"`
	UserID        *int      `json:"user_id,omitempty"`
	Action        string    `json:"action"`
	EntityType    string    `json:"entity_type"`
	EntityID      *int      `json:"entity_id,omitempty"`
	PreviousState *string   `json:"previous_state,omitempty"`
	NewState      *string   `json:"new_state,omitempty"`
	IPAddress     *string   `json:"ip_address,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type Supplement struct {
	ID               int        `json:"id"`
	CompanyID        int        `json:"company_id"`
	InternalID       string     `json:"internal_id"`
	ContractID       int        `json:"contract_id"`
	SupplementNumber string     `json:"supplement_number"`
	Description      *string    `json:"description,omitempty"`
	EffectiveDate    string     `json:"effective_date"`
	Modifications      *string    `json:"modifications,omitempty"`
	ModificationType   *string    `json:"modification_type,omitempty"`
	Status             string     `json:"status"`
	ClientSignerID   *int       `json:"client_signer_id,omitempty"`
	SupplierSignerID *int       `json:"supplier_signer_id,omitempty"`
	CreatedBy        *int       `json:"created_by,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type Company struct {
	ID          int        `json:"id"`
	Name        string     `json:"name"`
	Address     *string    `json:"address,omitempty"`
	TaxID       *string    `json:"tax_id,omitempty"`
	CompanyType string     `json:"company_type"`
	ParentID    *int       `json:"parent_id,omitempty"`
	ParentName  *string    `json:"parent_name,omitempty"`
	CreatedBy   *int       `json:"created_by,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type UserCompany struct {
	UserID      int    `json:"user_id"`
	CompanyID   int    `json:"company_id"`
	CompanyName string `json:"company_name"`
	IsDefault   bool   `json:"is_default"`
}

type SystemSetting struct {
	ID        int        `json:"id"`
	Key      string     `json:"key"`
	Value    *string    `json:"value,omitempty"`
	Category string    `json:"category"`
	UpdatedBy *int       `json:"updated_by,omitempty"`
	UpdatedAt time.Time `json:"updated_at"`
}

// IntArray is a custom type for storing []int as JSON in SQLite
type IntArray []int

// Scan implements sql.Scanner interface
func (a *IntArray) Scan(value interface{}) error {
	if value == nil {
		*a = nil
		return nil
	}
	var data []int
	switch v := value.(type) {
	case []byte:
		if err := json.Unmarshal(v, &data); err != nil {
			return fmt.Errorf("unmarshal IntArray: %w", err)
		}
	case string:
		if err := json.Unmarshal([]byte(v), &data); err != nil {
			return fmt.Errorf("unmarshal IntArray: %w", err)
		}
	default:
		return fmt.Errorf("unsupported type %T for IntArray", value)
	}
	*a = data
	return nil
}

// Value implements driver.Valuer interface
func (a IntArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}
