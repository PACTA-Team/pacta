# Fix SQLC Schema Mismatches for PR 301

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix sqlc generate failures by aligning query files with actual database schema

**Architecture:** Incremental fixes: (1) remove dead queries referencing removed tables, (2) fix column mismatches, (3) resolve ambiguous column references, (4) add missing column or adjust query to match schema. All changes are backward-compatible schema adjustments.

**Tech Stack:** SQLite, sqlc, Go, GitHub Actions CI

---

### Task 1: Remove dead document_chunks query from ai_legal.sql

**Files:**
- Modify: `internal/db/queries/ai_legal.sql:47-49`

**Step 1: Remove the document_chunks query**

The `GetLegalDocumentChunkCount` query references `document_chunks` table which no longer exists (replaced by VectorDB JSON storage). Delete lines 47-49.

```sql
-- DELETE these lines:
-- -- name: GetLegalDocumentChunkCount :one
-- SELECT COUNT(*) FROM document_chunks
-- WHERE document_id = ? AND source = 'legal';
```

**Step 2: Verify file integrity**

Ensure file ends correctly with the ai_legal_chat_history section (line 51 onward).

**Step 3: Commit**

```bash
git add internal/db/queries/ai_legal.sql
git commit -m "fix(queries): remove dead document_chunks query no longer used"
```

---

### Task 2: Fix ai_rate_limits.sql SELECT id column mismatch

**Files:**
- Modify: `internal/db/queries/ai_rate_limits.sql:21-26`

**Step 1: Remove non-existent `id` column**

Schema definition (`006_ai_rate_limits.sql` + test helpers) only has `(company_id, date, count)`. The `GetRateLimitInfo` query incorrectly selects `id`.

Replace:
```sql
SELECT id, company_id, count, created_at
FROM ai_rate_limits
WHERE company_id = ?
ORDER BY created_at DESC
LIMIT ?;
```

With:
```sql
SELECT company_id, count, created_at
FROM ai_rate_limits
WHERE company_id = ?
ORDER BY created_at DESC
LIMIT ?;
```

**Step 2: Update query name comment if needed**

Keep name `GetRateLimitInfo` (unchanged).

**Step 3: Commit**

```bash
git add internal/db/queries/ai_rate_limits.sql
git commit -m "fix(queries): remove id from GetRateLimitInfo (schema mismatch)"
```

---

### Task 3: Resolve ambiguous `id` in GetSignerForContractValidation queries

**Files:**
- Modify: `internal/db/queries/authorized_signers.sql:48-68`

**Step 1: Qualify subquery column references**

Two queries (`GetSignerForContractValidation`, `GetSignerWithValidation`) have:
```sql
WHERE id = ? AND company_id IN (
  SELECT id FROM clients WHERE company_id = ? ...
  UNION ALL
  SELECT id FROM suppliers WHERE company_id = ? ...
)
```

Inner `SELECT id` refers to `clients.id` / `suppliers.id`, but `id` alone is ambiguous across union. Explicitly qualify: `SELECT cl.id` / `SELECT s.id`.

Replace both occurrences:
```sql
-- GetSignerForContractValidation (lines 48-57):
SELECT id FROM clients → SELECT cl.id
SELECT id FROM suppliers → SELECT s.id

-- GetSignerWithValidation (lines 59-68):
Same replacement
```

**Step 2: Commit**

```bash
git add internal/db/queries/authorized_signers.sql
git commit -m "fix(queries): qualify ambiguous id in authorized_signers subqueries"
```

---

### Task 4: Fix GetContractForRAG content column reference

**Files:**
- Modify: `internal/db/queries/contracts.sql:175-183`

**Step 1: Check schema — does contracts.content exist?**

Schema from `001_initial_schema.sql` shows NO `content` column in contracts. The RAG query should use existing columns: `description`, `object`, or join `legal_documents` if content lives there.

**Investigation:** Check Go code usage.

Run:
```bash
grep -n "GetContractForRAG" internal/ai/minirag/indexer.go
```

Read that section to determine intended output. Likely candidates:
- Replace `c.content` with `c.description` or `c.object`
- If content from legal documents is needed, join `legal_documents` table instead

**Step 2: Choose minimal fix**

If `c.object` is the main textual content for contracts, change:
```sql
COALESCE(c.content, '') as content
```
to
```sql
COALESCE(c.object, '') as content
```

OR if `description` is intended:
```sql
COALESCE(c.description, '') as content
```

Decision based on indexer.go usage. After change, ensure column alias `content` still provided for downstream code expecting that field name.

**Step 3: Commit**

```bash
git add internal/db/queries/contracts.sql
git commit -m "fix(queries): replace nonexistent c.content with c.object in GetContractForRAG"
```

---

### Task 5: Run sqlc generate locally to verify

**Files:**
- Touch none (verification only)

**Step 1: Run sqlc generate**

```bash
cd internal/db
sqlc generate
```

**Expected:** Zero errors. All queries compile against current migrations.

**Step 2: If new errors appear, loop back to Tasks 1-4**

Fix any remaining mismatches following same pattern.

**Step 3: Build Go code to catch generated code errors**

```bash
go build ./...
```

**Expected:** Successful build.

**Step 4: Run DB-related tests**

```bash
go test ./internal/db/... -v
```

**Expected:** All tests pass (or at least compile and run without sqlc-generated code failures).

**Step 5: Commit if all green**

```bash
git add .
git commit -m "build: sqlc generate and tests pass after query fixes"
```

---

### Task 6: Push and verify CI passes

**Files:**
- None

**Step 1: Push branch to trigger CI**

```bash
git push origin feature/minirag-hybrid-integration
```

**Step 2: Wait for CI, then verify**

```bash
gh run list --limit 5 --json status,databaseId,displayTitle
```

Confirm run status: `completed` (not `failure`).

**Step 3: If CI fails, diagnose new error**

Use `gh run view <id> --log` to read error and loop back to Tasks 1-5.

**Step 4: On CI success, mark PR ready**

Add comment on PR 301: "✅ CI fixed — sqlc schema mismatches resolved. Ready for review."

---

### Task 7: Post-fix cleanup and docs (optional but recommended)

**Files:**
- Create: `docs/db/query-maintenance.md` (if not exists) or append to existing doc

**Step 1: Document common sqlc pitfalls discovered**

Add section:
```markdown
## Common Pitfalls

- Keep query files in sync with `internal/db/migrations/*.sql`
- Never reference columns not in migration definition
- Removing a table? Remove all queries referencing it or add back compatibility view
- Subqueries in UNION must fully qualify column names to avoid ambiguity errors
```

**Step 2: Commit**

```bash
git add docs/
git commit -m "docs(db): add sqlc maintenance tips learned from PR 301"
```

---

## Execution Order

Tasks 1→4 (query fixes) → Task 5 (local verification) → Task 6 (CI) → Task 7 (docs).

**Each task committed separately** to enable bisectability and clear code review.

---

## Testing Strategy

- Local: `sqlc generate` (must exit 0)
- Local: `go build ./...` (no compile errors)
- Local: `go test ./internal/db/...` (runs)
- CI: Full build + sqlc generate + tests

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Removing query breaks Go code | Tests in `internal/ai/` and `internal/handlers/` will catch compile errors |
| Wrong column substitution (object vs description) | Check `indexer.go` usage before change; both are TEXT, downstream code only cares about `content` alias name |
| Ambiguous id fix changes semantics | Qualifying `cl.id` / `s.id` preserves semantics; only removes ambiguity |

---

**Ready to dispatch implementation via subagent-driven-development or convert to GitHub issues.**

Base directory for this skill: file:///home/mowgli/.agents/skills/writing-plans
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>

</skill_files>
</skill_content>