package ai

import (
	"strings"
	"testing"
)

func TestSystemPromptLegal(t *testing.T) {
	if !strings.Contains(SystemPromptLegal, "legal expert") {
		t.Error("SystemPromptLegal should contain 'legal expert'")
	}
}

func TestBuildContractPrompt(t *testing.T) {
	req := GenerateContractRequest{
		ContractType: "services",
		Amount:       50000,
		StartDate:    "2026-05-01",
		EndDate:      "2026-12-31",
		Description:  "Consulting services",
	}

	context := "Previous contract reference..."
	prompt := BuildContractPrompt(req, context)

	if !strings.Contains(prompt, "services") {
		t.Error("prompt should contain contract type")
	}
	if !strings.Contains(prompt, "50000") {
		t.Error("prompt should contain amount")
	}
	if !strings.Contains(prompt, "Previous contract reference...") {
		t.Error("prompt should contain context")
	}
}

func TestBuildReviewPrompt(t *testing.T) {
	contractText := "This is a contract about..."
	prompt := BuildReviewPrompt(contractText)

	if !strings.Contains(prompt, contractText) {
		t.Error("prompt should contain contract text")
	}
	if !strings.Contains(prompt, "JSON") {
		t.Error("prompt should mention JSON format")
	}
}

func TestCubanLegalExpertPrompt(t *testing.T) {
	prompt := SystemPromptCubanLegalExpert()

	if prompt == "" {
		t.Error("Prompt should not be empty")
	}

	if !strings.Contains(prompt, "Cuban") {
		t.Error("Prompt should mention Cuban law")
	}

	if !strings.Contains(prompt, "contratos") {
		t.Error("Prompt should mention contracts")
	}
}
