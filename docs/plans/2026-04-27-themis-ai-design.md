# Themis AI Integration Design - PACTA

**Date:** 2026-04-27  
**Status:** Approved  
**Author:** AI Assistant (Kilo)

## 1. Overview

Themis is an AI assistant to be integrated into PACTA as an optional, experimental feature. It acts as a legal co-pilot that helps users:

1. **Generate Contracts:** Create contract drafts using AI based on user inputs and learning from existing contracts (RAG - Retrieval Augmented Generation)
2. **Review Contracts:** Analyze uploaded contracts, identify risks, suggest alternative clauses, and provide preliminary legal assessments

The design maintains PACTA's "local-first" philosophy by implementing AI as a pluggable module that communicates with external LLM services via user-configured API keys.

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    PACTA Frontend (React)         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Settings Page │  │ New Contract │  │ Contract      │  │
│  │ (AI Config)  │  │ (with AI)    │  │ Details/Edit │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │           │
│         └──────────────────┼──────────────────┘           │
│                            │                                    │
│                    ┌───────▼────────┐                     │
│                    │  AI Service API │                     │
│                    │  (TypeScript)  │                     │
│                    └───────┬────────┘                     │
└────────────────────────────┼──────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────┐
│              PACTA Backend (Go)                      │
│  ┌──────────────────────────────────────────┐      │
│  │         New AI Handlers (/api/ai/*)            │      │
│  │  - POST /api/ai/generate-contract              │      │
│  │  - POST /api/ai/review-contract                │      │
│  │  - POST /api/ai/chat                           │      │
│  └────────────────┬─────────────────────────┘      │
│                   │                                          │
│  ┌───────────────▼──────────────────────────────┐          │
│  │     AI Service (internal/ai/)                 │          │
│  │  - LLM Client (OpenAI, Groq, etc.)          │          │
│  │  - Prompt Templates (legal-specific)           │          │
│  │  - Contract Retrieval (from SQLite)           │          │
│  │  - PDF Text Extraction (rsc/pdf)             │          │
│  └───────────────┬──────────────────────────────┘          │
│                   │                                          │
│  ┌───────────────▼──────────────────────────────┐          │
│  │         SQLite Database                       │          │
│  │  - contracts, clients, suppliers, etc.       │          │
│  │  - system_settings (API key storage)          │          │
│  └───────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  External LLM API     │
                  │  (OpenAI/Groq/etc)   │
                  │  via user's API key   │
                  └──────────────────────┘
```

### 2.2 Key Design Decisions

- **Approach:** Simple API Key + Context Stuffing (Option 1 from brainstorming)
- **RAG Strategy:** Basic RAG using SQLite context stuffing (no vector database initially)
- **LLM Provider:** Configurable via API key (OpenAI, Groq, Anthropic, OpenRouter, Custom)
- **Privacy:** API key encrypted at rest, data sent to user-chosen LLM provider
- **Deployment:** Single binary philosophy maintained - no microservices

## 3. Components and Data Flow

### 3.1 AI Configuration in Settings

**Location:** `/pacta_appweb/src/pages/SettingsPage/AISection.tsx` (new component)

**Fields:**
- `LLM Provider`: Dropdown with options (OpenAI, Groq, Anthropic, OpenRouter, Custom)
- `API Key`: Password input (encrypted before saving)
- `Model`: Text input (e.g., "gpt-4o", "llama3-70b-8192")
- `Endpoint URL` (optional): For custom providers
- `Test Connection`: Button to verify API key works

**Backend Storage:**
- Settings keys: `ai_provider`, `ai_api_key` (encrypted), `ai_model`, `ai_endpoint`
- Stored in existing `system_settings` table
- API key encrypted using AES-256-GCM encryption

---

### 3.2 New Contract with AI (RAG Flow)

**Location:** New option "New Contract with AI" in ContractsPage (with "Experimental" badge)

**Step-by-Step Flow:**

```
1. User clicks "New Contract with AI" button (experimental)
2. ContractFormWrapper opens with AI mode enabled
3. User inputs:
   - Contract type (services, purchase-sale, etc.)
   - Key data (amount, dates, client/supplier)
   - Free-form description (optional)
4. User clicks "Generate Draft with AI"
5. Frontend sends POST /api/ai/generate-contract:
   {
     "contract_type": "services",
     "amount": 50000,
     "start_date": "2026-05-01",
     "end_date": "2026-12-31",
     "client_id": 123,
     "supplier_id": 456,
     "description": "Consulting services..."
   }
6. Backend (Go):
   a. Validate API key is configured
   b. Retrieve similar contracts from SQLite:
      - Search by contract type
      - Search by client/supplier
      - Limit to 3-5 most relevant contracts
   c. Extract text from those contracts (if they have attached documents)
   d. Build prompt with:
      - Context: "You are a legal expert assistant..."
      - Previous contracts (RAG context stuffing)
      - New contract data
      - Instructions: "Generate a formal contract..."
   e. Call external LLM via HTTP using configured API key
   f. Receive response and return to frontend
7. Frontend displays generated text in an editor:
   - Option to edit before saving
   - Button "Accept and Create Contract"
   - Button "Regenerate" (with user feedback)
```

---

### 3.3 Contract Review (Suggestions)

**Location:** In `ContractDetailsPage.tsx`, button "Review with Themis"

**Flow:**
1. User uploads or selects an existing contract
2. User clicks "Review with Themis"
3. Frontend sends text/document to POST /api/ai/review-contract
4. Backend:
   - Extract text from PDF/DOCX if necessary
   - Build legal review prompt:
     - "Analyze this contract and detect: abusive clauses, legal risks, missing standard clauses..."
   - Send to LLM
   - Receive structured analysis (JSON):
     ```json
     {
       "summary": "Services contract for $50,000...",
       "risks": [
         {"clause": "Renewal clause", "risk": "high", "suggestion": "Add notification..."}
       ],
       "missing_clauses": ["Confidentiality", "Liability limitation"],
       "overall_risk": "medium"
     }
     ```
5. Frontend displays analysis in a new panel:
   - List of risks with colors (red/amber/green)
   - Suggestions for missing clauses
   - Option to "Apply Suggestion" (adds clause to contract)

---

## 4. Technical Implementation (Backend - Go)

### 4.1 New Directory Structure

```
internal/
  ai/
    client.go          # LLM client (OpenAI, Groq, etc.)
    prompts.go         # Legal-specific prompt templates
    rag.go             # Contract retrieval from SQLite (RAG)
    extractors.go      # PDF/DOCX text extraction
    types.go           # Shared types (requests/responses)
    encryption.go      # API key encryption/decryption
  handlers/
    ai.go              # HTTP handlers for /api/ai/*
```

---

### 4.2 LLM Client (internal/ai/client.go)

```go
package ai

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
)

type LLMProvider string

const (
    ProviderOpenAI    LLMProvider = "openai"
    ProviderGroq      LLMProvider = "groq"
    ProviderAnthropic LLMProvider = "anthropic"
    ProviderCustom    LLMProvider = "custom"
)

type LLMClient struct {
    Provider  LLMProvider
    APIKey   string
    Model    string
    Endpoint string // For custom providers
    HTTPClient *http.Client
}

type GenerateRequest struct {
    Prompt  string `json:"prompt"`
    Context string `json:"context,omitempty"`
    MaxTokens int  `json:"max_tokens,omitempty"`
}

type GenerateResponse struct {
    Text  string `json:"text"`
    Error string `json:"error,omitempty"`
}

func (c *LLMClient) Generate(ctx context.Context, prompt string, context string) (string, error) {
    switch c.Provider {
    case ProviderOpenAI:
        return c.callOpenAI(ctx, prompt, context)
    case ProviderGroq:
        return c.callGroq(ctx, prompt, context)
    // ... other providers
    default:
        return "", fmt.Errorf("unsupported provider: %s", c.Provider)
    }
}
```

---

### 4.3 RAG - Contract Retrieval (internal/ai/rag.go)

```go
package ai

import (
    "database/sql"
    "fmt"
    "strings"
)

type ContractRetriever struct {
    DB *sql.DB
}

type SimilarContract struct {
    ID      int
    Title   string
    Type    string
    Content string // Extracted text from document
}

func (r *ContractRetriever) GetSimilarContracts(contractType string, clientID, supplierID int, limit int) ([]SimilarContract, error) {
    query := `
        SELECT c.id, c.title, c.type, c.object
        FROM contracts c
        WHERE c.type = ? 
          AND c.deleted_at IS NULL
          AND (c.client_id = ? OR c.supplier_id = ?)
        ORDER BY c.created_at DESC
        LIMIT ?
    `
    
    rows, err := r.DB.Query(query, contractType, clientID, supplierID, limit)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var contracts []SimilarContract
    for rows.Next() {
        var c SimilarContract
        if err := rows.Scan(&c.ID, &c.Title, &c.Type, &c.Content); err != nil {
            continue
        }
        contracts = append(contracts, c)
    }
    
    return contracts, nil
}
```

---

### 4.4 Text Extraction (internal/ai/extractors.go)

```go
package ai

import (
    "fmt"
    "io"
)

// ExtractTextFromPDF extracts text from PDF bytes
func ExtractTextFromPDF(reader io.Reader) (string, error) {
    // Implementation using: github.com/rsc/pdf
    return "", fmt.Errorf("not implemented yet")
}

// ExtractTextFromDOCX extracts text from DOCX bytes
func ExtractTextFromDOCX(reader io.Reader) (string, error) {
    // Implementation using a pure Go DOCX library
    return "", fmt.Errorf("not implemented yet")
}
```

---

### 4.5 Prompt Templates (internal/ai/prompts.go)

```go
package ai

const (
    SystemPromptLegal = `You are a legal expert assistant specialized in civil and commercial law.
Your task is to help draft and review contracts professionally,
using formal language and standard clauses for the legal domain.`

    GenerateContractPrompt = `Based on the following similar contracts as reference:

{{.Context}}

Please generate a contract draft with the following characteristics:
- Type: {{.Type}}
- Amount: {{.Amount}}
- Start Date: {{.StartDate}}
- End Date: {{.EndDate}}
- Description: {{.Description}}

The contract should include standard clauses for this type of agreement.`

    ReviewContractPrompt = `Analyze the following contract and provide a preliminary assessment.

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
}`
)
```

---

## 5. Frontend Implementation (React/TypeScript)

### 5.1 AI Configuration in SettingsPage

**New file:** `pacta_appweb/src/pages/SettingsPage/AISection.tsx`

Features:
- Dropdown for LLM provider selection
- Password input for API key
- Text input for model name
- Optional endpoint URL for custom providers
- Test Connection button
- Save Settings button

**Integration in SettingsPage.tsx:**
```tsx
{isAdmin && <AISection />}
```

---

### 5.2 New Contract with AI - Option in ContractsPage

**Modification to:** `pacta_appweb/src/pages/ContractsPage.tsx`

Add new button with "Experimental" badge:
```tsx
<Button 
  variant="outline" 
  onClick={() => setShowNewContractWithAI(true)}
  className="border-dashed"
>
  <Sparkles className="mr-2 h-4 w-4" />
  New Contract with AI
  <Badge variant="secondary" className="ml-2">Experimental</Badge>
</Button>
```

**New component:** `pacta_appweb/src/components/contracts/ContractAIForm.tsx`

Similar to `ContractFormWrapper` but includes:
- Additional fields for free-form description
- "Generate Draft with AI" button
- Text editor (textarea or rich text) to display generated draft
- "Regenerate" and "Accept and Create" options

---

### 5.3 Contract Review - Themis AI Panel

**Modification to:** `pacta_appweb/src/pages/ContractDetailsPage.tsx`

Add "Review with Themis" button and results panel:

```tsx
// Review results panel
{reviewResult && (
  <Card className="mt-6">
    <CardHeader>
      <CardTitle>Themis Assessment</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <h4 className="font-semibold">Summary:</h4>
        <p>{reviewResult.summary}</p>
      </div>
      
      <div>
        <h4 className="font-semibold">Overall Risk:
          <Badge 
            variant={reviewResult.overall_risk === 'high' ? 'destructive' : 'default'}
          >
            {reviewResult.overall_risk}
          </Badge>
        </h4>
      </div>
      
      <div>
        <h4 className="font-semibold">Risk Clauses:</h4>
        <ul className="space-y-2">
          {reviewResult.risks.map((risk: any, i: number) => (
            <li key={i} className="border-l-4 border-red-500 pl-4">
              <p className="font-medium">{risk.clause}</p>
              <p className="text-sm text-muted-foreground">{risk.risk}</p>
              <p className="text-sm">{risk.suggestion}</p>
            </li>
          ))}
        </ul>
      </div>
    </CardContent>
  </Card>
)}
```

---

## 6. Security, Privacy, and Error Handling

### 6.1 API Key Security

- **Encryption at Rest:** API keys encrypted using AES-256-GCM before storing in `system_settings`
- **Decryption:** Keys are decrypted in memory only when needed for API calls
- **No Logging:** API keys are never logged or exposed in error messages
- **Encryption Key:** Loaded from environment variable on startup

---

### 6.2 Privacy and Data Sovereignty

**UI Warnings:**
- Display warning when AI is not configured to use local LLM (Ollama)
- Recommend local processing for sensitive contracts
- Show data destination (which LLM provider will receive the data)

**Disclaimer:**
- Themis is an assistance tool, NOT a substitute for a lawyer
- All AI-generated/modified documents require human review
- AI may hallucinate or make legal errors

---

### 6.3 Error Handling

**Backend (Go):**
- Validate AI configuration before processing requests
- Use timeouts (30 seconds) for LLM API calls
- Return user-friendly error messages (don't expose internal details)
- Log errors server-side only

**Frontend (TypeScript):**
- Show specific error messages for:
  - AI not configured
  - Invalid API key
  - Request timeout
  - Rate limiting
- Provide actionable next steps in error messages

---

### 6.4 Rate Limiting and Cost Control

**Problem:** LLM APIs charge per token. Need to protect against excessive usage.

**Solution:** Rate limiting per company/user

```go
// Check rate limits before processing
func (h *Handler) checkAILimits(companyID int) error {
    key := fmt.Sprintf("ai_usage:%d:%s", companyID, time.Now().Format("2006-01-02"))
    
    // Example: 100 requests per day per company
    usage, _ := h.Redis.Get(key).Int()
    if usage >= 100 {
        return fmt.Errorf("daily AI request limit reached")
    }
    
    h.Redis.Incr(key)
    h.Redis.Expire(key, 24*time.Hour)
    
    return nil
}
```

**Cost Estimation in UI:**
```tsx
<div className="text-sm text-muted-foreground">
  Estimated: ~2000 tokens ($0.06 USD with GPT-4o)
</div>
```

---

## 7. Future Enhancements (Not in Initial Scope)

1. **Vector Database:** Migrate from context stuffing to true semantic search using embeddings
2. **Fine-tuned Models:** Train/fine-tune models specifically for legal domain
3. **Local LLM Support:** First-class support for Ollama with local models
4. **Advanced RAG:** Chunking strategies for large contracts, hybrid search
5. **Multi-modal:** Support for images, scanned documents (OCR)
6. **Collaborative Features:** Share AI-generated drafts with team members for review

---

## 8. Summary

Themis AI integration brings powerful legal assistance capabilities to PACTA while maintaining its core principles:

✅ **Optional:** Users choose whether to enable AI features  
✅ **Configurable:** API key-based integration with multiple LLM providers  
✅ **RAG-Enabled:** Learns from user's existing contract library  
✅ **Experimental:** Clearly marked as experimental features  
✅ **Secure:** API keys encrypted, no unnecessary data exposure  
✅ **User-Friendly:** Clear error messages, cost estimates, and disclaimers  

The design uses a pragmatic approach (Option 1: Simple API + Context Stuffing) that can evolve into more sophisticated RAG implementations in the future.
