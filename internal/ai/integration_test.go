package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestGenerateContract_EndToEnd tests the full LLM generate flow with a mock server
func TestGenerateContract_EndToEnd(t *testing.T) {
	// Create mock server that mimics OpenAI API
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST, got %s", r.Method)
		}

		// Read and validate request body structure
		var req openAIRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("Failed to decode request: %v", err)
		}

		if req.Model == "" {
			t.Error("Expected non-empty model")
		}
		if len(req.Messages) == 0 {
			t.Error("Expected at least one message")
		}

		// Send fake chat completion response
		response := map[string]interface{}{
			"choices": []map[string]interface{}{
				{
					"message": map[string]interface{}{
						"content": "CONTRACT DRAFT CONTENT HERE",
					},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	// Create client pointing to mock server
	client := NewLLMClient(ProviderOpenAI, "test-api-key", "gpt-4", server.URL)

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Call Generate
	result, err := client.Generate(ctx, "Generate contract", "RAG context...")

	// Assertions
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if result == "" {
		t.Error("Expected non-empty result")
	}
	if result != "CONTRACT DRAFT CONTENT HERE" {
		t.Errorf("Expected 'CONTRACT DRAFT CONTENT HERE', got %q", result)
	}
}

// ParseReviewResponseTest cases for table-driven test
type ParseReviewResponseTest struct {
	name    string
	input   string
	wantErr bool
	want    ReviewResponse
}

func TestReviewContract_Parsing(t *testing.T) {
	tests := []ParseReviewResponseTest{
		{
			name: "clean JSON",
			input: `{"summary":"ok","risks":[],"missing_clauses":[],"overall_risk":"low"}`,
			wantErr: false,
			want: ReviewResponse{
				Summary:        "ok",
				Risks:          []RiskItem{},
				MissingClauses: []string{},
				OverallRisk:    "low",
			},
		},
		{
			name: "JSON with markdown fences",
			input: "```json\n{\"summary\":\"ok\",\"risks\":[],\"missing_clauses\":[],\"overall_risk\":\"low\"}\n```",
			wantErr: false,
			want: ReviewResponse{
				Summary:        "ok",
				Risks:          []RiskItem{},
				MissingClauses: []string{},
				OverallRisk:    "low",
			},
		},
		{
			name:    "invalid JSON",
			input:   "{invalid json",
			wantErr: true,
		},
		{
			name: "JSON with risks and missing clauses",
			input: `{"summary":"needs work","risks":[{"clause":"Payment","risk":"high","suggestion":"Add late fees"}],"missing_clauses":["Indemnification"],"overall_risk":"medium"}`,
			wantErr: false,
			want: ReviewResponse{
				Summary: "needs work",
				Risks: []RiskItem{
					{Clause: "Payment", Risk: "high", Suggestion: "Add late fees"},
				},
				MissingClauses: []string{"Indemnification"},
				OverallRisk:    "medium",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseReviewResponse(tt.input)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ParseReviewResponse() error = nil, want error")
				}
				return
			}

			if err != nil {
				t.Errorf("ParseReviewResponse() unexpected error = %v", err)
				return
			}

			if got.Summary != tt.want.Summary {
				t.Errorf("Summary mismatch: got %q, want %q", got.Summary, tt.want.Summary)
			}
			if got.OverallRisk != tt.want.OverallRisk {
				t.Errorf("OverallRisk mismatch: got %q, want %q", got.OverallRisk, tt.want.OverallRisk)
			}
			if len(got.Risks) != len(tt.want.Risks) {
				t.Errorf("Risks length mismatch: got %d, want %d", len(got.Risks), len(tt.want.Risks))
			}
			if len(got.MissingClauses) != len(tt.want.MissingClauses) {
				t.Errorf("MissingClauses length mismatch: got %d, want %d", len(got.MissingClauses), len(tt.want.MissingClauses))
			}
		})
	}
}
