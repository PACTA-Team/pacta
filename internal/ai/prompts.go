package ai

import (
	"fmt"
	"strings"
)

const (
	// SystemPromptLegal is the system prompt for legal AI assistant
	SystemPromptLegal = `You are a legal expert assistant specialized in civil and commercial law.
Your task is to help draft and review contracts professionally,
using formal language and standard clauses for the legal domain.
Always provide accurate, well-structured legal content.`

	// GenerateContractPromptTemplate is the template for generating contracts
	GenerateContractPromptTemplate = `Based on the following similar contracts as reference:

{{.Context}}

Please generate a contract draft with the following characteristics:
- Type: {{.Type}}
- Amount: {{.Amount}}
- Start Date: {{.StartDate}}
- End Date: {{.EndDate}}
- Description: {{.Description}}

The contract should include standard clauses for this type of agreement.
Output the complete contract text in formal legal language.`

	// ReviewContractPromptTemplate is the template for reviewing contracts
	ReviewContractPromptTemplate = `Analyze the following contract and provide a preliminary legal assessment.

Contract:
{{.ContractText}}

Please provide the analysis in JSON format with the following structure:
{
  "summary": "Executive summary of the contract",
  "risks": [
    {"clause": "clause name", "risk": "high/medium/low", "suggestion": "suggestion"}
  ],
  "missing_clauses": ["missing clause 1", "missing clause 2"],
  "overall_risk": "high/medium/low"
}

IMPORTANT: Respond ONLY with the JSON, no markdown formatting or additional text.`
)

// BuildContractPrompt builds the full prompt for contract generation
func BuildContractPrompt(req GenerateContractRequest, context string) string {
	prompt := strings.ReplaceAll(GenerateContractPromptTemplate, "{{.Context}}", context)
	prompt = strings.ReplaceAll(prompt, "{{.Type}}", req.ContractType)
	prompt = strings.ReplaceAll(prompt, "{{.Amount}}", fmt.Sprintf("%.2f", req.Amount))
	prompt = strings.ReplaceAll(prompt, "{{.StartDate}}", req.StartDate)
	prompt = strings.ReplaceAll(prompt, "{{.EndDate}}", req.EndDate)
	prompt = strings.ReplaceAll(prompt, "{{.Description}}", req.Description)
	return prompt
}

// BuildReviewPrompt builds the full prompt for contract review
func BuildReviewPrompt(contractText string) string {
	return strings.ReplaceAll(ReviewContractPromptTemplate, "{{.ContractText}}", contractText)
}
