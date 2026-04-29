package ai

import (
	"testing"
)

func TestParseReviewResponse_ValidJSON(t *testing.T) {
	raw := `{
		"summary": "Test summary",
		"risks": [{"clause": "Payment", "risk": "high", "suggestion": "Add due date"}],
		"missing_clauses": ["Indemnity"],
		"overall_risk": "medium"
	}`
	resp, err := ParseReviewResponse(raw)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if resp.Summary != "Test summary" {
		t.Errorf("unexpected summary: %s", resp.Summary)
	}
	if len(resp.Risks) != 1 {
		t.Errorf("expected 1 risk, got %d", len(resp.Risks))
	}
	if resp.Risks[0].Clause != "Payment" {
		t.Errorf("unexpected clause: %s", resp.Risks[0].Clause)
	}
	if resp.OverallRisk != "medium" {
		t.Errorf("overall risk: want medium, got %s", resp.OverallRisk)
	}
}

func TestParseReviewResponse_WithMarkdownFences(t *testing.T) {
	raw := "```json\n{\"summary\": \"Fenced JSON\", \"risks\": [], \"missing_clauses\": [], \"overall_risk\": \"low\"}\n```"
	resp, err := ParseReviewResponse(raw)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if resp.Summary != "Fenced JSON" {
		t.Errorf("unexpected summary: %s", resp.Summary)
	}
}

func TestParseReviewResponse_InvalidJSON(t *testing.T) {
	raw := `{invalid json}`
	_, err := ParseReviewResponse(raw)
	if err == nil {
		t.Error("expected error for invalid JSON, got nil")
	}
}
