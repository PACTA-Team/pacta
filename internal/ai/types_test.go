package ai

import (
	"encoding/json"
	"testing"
)

func TestGenerateContractRequest_Validation(t *testing.T) {
	req := GenerateContractRequest{
		ContractType: "services",
		Amount:       50000,
		StartDate:    "2026-05-01",
		EndDate:      "2026-12-31",
		ClientID:     123,
		SupplierID:   456,
		Description:  "Consulting services",
	}

	if req.ContractType != "services" {
		t.Errorf("expected services, got %s", req.ContractType)
	}
	if req.Amount != 50000 {
		t.Errorf("expected 50000, got %f", req.Amount)
	}
}

func TestReviewContractRequest_Validation(t *testing.T) {
	req := ReviewContractRequest{
		ContractID: 123,
		Text:       "Contract text here...",
	}

	if req.ContractID != 123 {
		t.Errorf("expected 123, got %d", req.ContractID)
	}
	if req.Text != "Contract text here..." {
		t.Errorf("unexpected text: %s", req.Text)
	}
}

func TestGenerateResponse_JSON(t *testing.T) {
	resp := GenerateResponse{
		Text:  "Generated contract text",
		Error: "",
	}

	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var decoded GenerateResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if decoded.Text != "Generated contract text" {
		t.Errorf("unexpected text: %s", decoded.Text)
	}
}
