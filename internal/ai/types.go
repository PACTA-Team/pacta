package ai

// LLM Provider constants
type LLMProvider string

const (
	ProviderOpenAI    LLMProvider = "openai"
	ProviderGroq      LLMProvider = "groq"
	ProviderAnthropic LLMProvider = "anthropic"
	ProviderOpenRouter LLMProvider = "openrouter"
	ProviderCustom    LLMProvider = "custom"
)

// GenerateContractRequest is the request body for generating a contract with AI
type GenerateContractRequest struct {
	ContractType string  `json:"contract_type"`
	Amount       float64 `json:"amount"`
	StartDate    string  `json:"start_date"`
	EndDate      string  `json:"end_date"`
	ClientID     int     `json:"client_id"`
	SupplierID   int     `json:"supplier_id"`
	Description  string  `json:"description,omitempty"`
	Context      string  `json:"context,omitempty"`
}

// ReviewContractRequest is the request body for reviewing a contract with AI
type ReviewContractRequest struct {
	ContractID int    `json:"contract_id"`
	Text       string `json:"text"`
	DocumentURL string `json:"document_url,omitempty"`
}

// GenerateResponse is the response for AI generation requests
type GenerateResponse struct {
	Text  string `json:"text"`
	Error string `json:"error,omitempty"`
}

// ReviewResponse is the structured response for contract review
type ReviewResponse struct {
	Summary        string     `json:"summary"`
	Risks          []RiskItem `json:"risks"`
	MissingClauses []string   `json:"missing_clauses"`
	OverallRisk    string     `json:"overall_risk"`
}

// RiskItem represents a specific risk found in a contract
type RiskItem struct {
	Clause     string `json:"clause"`
	Risk       string `json:"risk"` // "high", "medium", "low"
	Suggestion string `json:"suggestion"`
}
