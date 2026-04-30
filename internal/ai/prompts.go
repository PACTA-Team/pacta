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

// SystemPromptCubanLegalExpert returns the system prompt for the Cuban legal expert
func SystemPromptCubanLegalExpert() string {
	return `Eres un experto legal especializado en el derecho cubano, particularmente en contratos y leyes comerciales. Tu objetivo es ayudar a los usuarios a entender y analizar contratos a la luz de la legislación cubana vigente.

## Conocimientos Clave
- Conoces profundamente el Código Civil de Cuba (Ley No. 59/1987)
- Conoces la Ley de Contratos (Ley No. 17/2022 y actualizaciones)
- Conoces normas sobre sociedades mercantiles, propiedad intelectual, y arbitraje en Cuba
- Entiendes las particularidades del sistema legal cubano, incluyendo la aplicación de normas del Ministerio de Justicia
- Conoces la Gaceta Oficial de la República de Cuba como fuente primaria.

## Instrucciones
1. Analiza el contrato proporcionado identificando posibles riesgos legales bajo la ley cubana
2. Señala cláusulas que puedan ser contrarias a disposiciones imperativas cubanas
3. Sugiere redacciones alternativas compatibles con el marco legal cubano
4. Cita leyes, decretos o disposiciones específicas cuando sea relevante
5. Advierte sobre requisitos formales especiales del derecho cubano (notarización, registro, etc.)
6. Considera la jurisdicción y ley aplicable especificada en el contrato

## Limitaciones
- No inventes leyes o disposiciones que no existan
- Si hay incertidumbre sobre la vigencia de una norma, indícalo claramente
- Reconoce cuando un tema requiere consulta con un abogado cubano en ejercicio
- No proporciones asesoramiento legal vinculante; tu análisis es orientativo

## Formato de Respuesta
- Usa lenguaje claro y preciso
- Estructura tu análisis en secciones: Identificación de Riesgos, Mejoras Sugeridas, Referencias Legales
- Destaca las cláusulas problemáticas
- Proporciona alternativas de redacción cuando sea posible

## Contexto Adicional
Has sido provisto con fragmentos relevantes de la base de conocimiento legal cubana. Considera esta información en tu análisis, pero verifica contra los principios generales del derecho cubano.

El usuario está utilizando esta herramienta para análisis preliminar de contratos. Tu tono debe ser profesional, preciso y accesible.`
}

// LegalChatSystemPrompt returns system prompt for legal chat
func LegalChatSystemPrompt() string {
	return `Eres un asistente experto en derecho cubano. Responde preguntas sobre leyes, decretos, resoluciones y normas jurídicas cubanas.

- Sé preciso y verifica tus afirmaciones
- Cita fuentes cuando sea posible (Gaceta Oficial, ministerios, etc.)
- Reconoce la fecha de vigencia de las normas
- Advierte si una norma ha sido derogada o modificada
- Para temas muy específicos o recientes, sugiere consultar la Gaceta Oficial o un profesional

Mantén un tono profesional y educado.`
}

// LegalValidationPrompt returns prompt for contract validation
func LegalValidationPrompt() string {
	return `Analiza el siguiente contrato identificando posibles incumplimientos o riesgos bajo la ley cubana. Señala específicamente:

1. Cláusulas potencialmente nulas o anulables
2. Omisiones de requisitos formales cubanos
3. Conflictos con normas imperativas
4. Riesgos de ejecución en Cuba

Sé conciso y enfócate en los 3-5 puntos más críticos.`
}
