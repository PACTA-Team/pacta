# Themis AI – Manual Testing Guide (Alpha)

## Prerequisites

- PACTA backend running (localhost:3000)
- Admin user credentials
- Valid OpenAI/Groq API key
- Environment variable set: `AI_ENCRYPTION_KEY=16bytekey12345678` (16, 24, or 32 bytes)

## Setup

1. Log in as admin → Settings → AI Configuration
2. Select provider (OpenAI), enter API key, model (gpt-4o), click Save
3. Verify: Key saved (encrypted in DB)

## Test Case 1: Generate Contract with AI

1. Navigate to Contracts page
2. Click "New Contract with AI"
3. Fill form: type=Services, amount=50000, dates, client, supplier, description="IT consulting"
4. Click "Generate Draft with AI"
5. Wait ~20s → draft appears in editor
6. Verify: contract contains standard clauses, dates match, amount mentioned
7. Click "Accept and Create Contract"
8. Verify: contract saved to list

## Test Case 2: Review Contract with AI

1. Open an existing contract (with PDF attached)
2. Click "Review with Themis"
3. Wait ~20s → panel opens with analysis
4. Verify: summary present, risks listed (if any), missing_clauses, overall_risk badge
5. Check JSON structure (browser console):
   ```js
   fetch('/api/ai/review-contract', ...).then(r=>r.json()).then(console.log)
   ```

## Test Case 3: Rate Limiting

1. Using script or Postman, send 101 POST /api/ai/generate-contract requests rapidly (same company)
2. Observe: requests 1-100 succeed, request 101 returns 429
3. Verify response header: `X-RateLimit-Remaining: 0`

## Test Case 4: Multi-Tenant Isolation

Setup: Two companies (A and B), each with contracts.
1. Login as user from Company A
2. Generate contract → RAG uses contracts from Company A only (check logs or DB)
3. Login as user from Company B
4. Generate contract → RAG uses only B's contracts
5. Verify: A never sees B's contracts in RAG context

## Test Case 5: Error Handling

- Invalid API key → "Please check your API key" message
- PDF too large (>10MB) → "PDF exceeds 10 MB limit"
- Missing required field → 400 with specific message
- AI not configured → Service Unavailable (503)

## Expected Performance

- Generation: <30s
- Review: <30s
- No server crashes or panics

## Troubleshooting

Check server logs: `journalctl -u pacta` or console output.
