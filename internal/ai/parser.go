package ai

import (
	"encoding/json"
	"fmt"
	"strings"
)

// ParseReviewResponse parses LLM output into structured ReviewResponse.
// It tolerates markdown code fences and common formatting issues.
func ParseReviewResponse(raw string) (ReviewResponse, error) {
	cleaned := strings.TrimSpace(raw)
	// Remove ```json ... ```
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	var resp ReviewResponse
	if err := json.Unmarshal([]byte(cleaned), &resp); err != nil {
		return ReviewResponse{}, fmt.Errorf("failed to parse AI JSON response: %w (raw[:200]=%q)", err, raw[:min(200, len(raw))])
	}
	return resp, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
