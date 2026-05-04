# Fix sqlc Generation Errors in PR 301

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three sqlc parse errors in PR 301's database queries so CI build passes.

**Architecture:** Database query layer — `sqlc` generates Go code from SQL files. Errors in `.sql` files block code generation and cause CI failure. Fix SQL syntax/column mismatches to align with actual schema.

**Tech Stack:** SQLite, sqlc, Go

---

## Context

PR 301 (`feature/minirag-hybrid-integration`) fails at `sqlc generate` step with:

```
queries/ai_rate_limits.sql:22:27: column "created_at" does not exist
queries/authorized_signers.sql:51:7: column reference "id" is ambiguous
queries/authorized_signers.sql:62:7: column reference "id" is ambiguous
```

Root causes already identified via systematic-debugging:

1. **ai_rate_limits** table has NO `created_at` column (only `date`). Queries misuse `created_at`.
2. **authorized_signers** queries contain unqualified column references in subqueries; sqlc parser finds them ambiguous. Must qualify with table alias.

**Important:** Do NOT run `go build` locally (CI-only). Safe to run `sqlc generate` locally if installed; otherwise rely on CI verification after commit.

---

## Tasks

### Task 1: Fix ai_rate_limits.sql — replace `created_at` with `date`

**Files:**
- Modify: `internal/db/queries/ai_rate_limits.sql`

**Changes needed:**
- Line 15: `date(created_at) = date('now')` → `date = date('now')`
- Lines 18-19: `INSERT INTO ai_rate_limits (company_id, count, created_at)` → `(company_id, date, count)`; `CURRENT_TIMESTAMP` → `date('now')`
- Lines 22-26: SELECT list `created_at` → `date`; `ORDER BY created_at DESC` → `ORDER BY date DESC`
- Line 30: `WHERE created_at < datetime('now', '-30 days')` → `WHERE date < date('now', '-30 days')`

**Step 1 — Open file:** `internal/db/queries/ai_rate_limits.sql`

**Step 2 — Edit lines:**

```diff
 -- name: GetTodayRateLimitCount :one
-SELECT COALESCE(SUM(count), 0) FROM ai_rate_limits
-WHERE company_id = ? AND date(created_at) = date('now');
+SELECT COALESCE(SUM(count), 0) FROM ai_rate_limits
+WHERE company_id = ? AND date = date('now');

-- name: IncrementRateLimitCount :exec
-INSERT INTO ai_rate_limits (company_id, count, created_at)
-VALUES (?, 1, CURRENT_TIMESTAMP);
+INSERT INTO ai_rate_limits (company_id, date, count)
+VALUES (?, date('now'), 1);

-- name: GetRateLimitInfo :many
-SELECT company_id, count, created_at
+SELECT company_id, count, date
 FROM ai_rate_limits
 WHERE company_id = ?
-ORDER BY created_at DESC
+ORDER BY date DESC
 LIMIT ?;

-- name: CleanupOldRateLimits :exec
-DELETE FROM ai_rate_limits
-WHERE created_at < datetime('now', '-30 days');
+DELETE FROM ai_rate_limits
+WHERE date < date('now', '-30 days');
```

**Step 3 — Save file**

**Step 4 — (Optional) Validate sqlc locally:**  
`sqlc generate` from `internal/db` should exit 0. If sqlc not installed, skip and rely on CI.

**Step 5 — Commit:**

```bash
git add internal/db/queries/ai_rate_limits.sql
git commit -m "fix(ai_rate_limits): replace created_at with date column in queries"
```

---

### Task 2: Fix authorized_signers.sql — qualify all ambiguous columns

**Files:**
- Modify: `internal/db/queries/authorized_signers.sql`

**Changes needed:**

- Add table alias `a` for `authorized_signers` in FROM clause for affected queries.
- Qualify outer `id`, `deleted_at`, `company_id` as `a.id`, `a.deleted_at`, `a.company_id`.
- Inside subqueries, qualify `clients.company_id` as `cl.company_id`, `suppliers.company_id` as `s.company_id`.

**Step 1 — Open file:** `internal/db/queries/authorized_signers.sql`

**Step 2 — Edit GetSignerForContractValidation (lines 48–57):**

```diff
-- name: GetSignerForContractValidation :one
-SELECT company_id, company_type, first_name, last_name
-FROM authorized_signers
-WHERE id = ? AND deleted_at IS NULL
-  AND company_id IN (
-    SELECT cl.id FROM clients cl WHERE company_id = ? AND deleted_at IS NULL
-    UNION ALL
-    SELECT s.id FROM suppliers s WHERE company_id = ? AND deleted_at IS NULL
-  )
-LIMIT 1;
+SELECT a.company_id, a.company_type, a.first_name, a.last_name
+FROM authorized_signers a
+WHERE a.id = ? AND a.deleted_at IS NULL
+  AND a.company_id IN (
+    SELECT cl.id FROM clients cl WHERE cl.company_id = ? AND cl.deleted_at IS NULL
+    UNION ALL
+    SELECT s.id FROM suppliers s WHERE s.company_id = ? AND s.deleted_at IS NULL
+  )
+LIMIT 1;
```

**Step 3 — Edit GetSignerWithValidation (lines 59–68):**

```diff
-- name: GetSignerWithValidation :one
-SELECT id, company_id, company_type, first_name, last_name, position, phone, email, created_at, updated_at
-FROM authorized_signers
-WHERE id = ? AND deleted_at IS NULL
-  AND company_id IN (
-    SELECT cl.id FROM clients cl WHERE company_id = ? AND deleted_at IS NULL
-    UNION ALL
-    SELECT s.id FROM suppliers s WHERE company_id = ? AND deleted_at IS NULL
-  )
-LIMIT 1;
+SELECT a.id, a.company_id, a.company_type, a.first_name, a.last_name,
+       a.position, a.phone, a.email, a.created_at, a.updated_at
+FROM authorized_signers a
+WHERE a.id = ? AND a.deleted_at IS NULL
+  AND a.company_id IN (
+    SELECT cl.id FROM clients cl WHERE cl.company_id = ? AND cl.deleted_at IS NULL
+    UNION ALL
+    SELECT s.id FROM suppliers s WHERE s.company_id = ? AND s.deleted_at IS NULL
+  )
+LIMIT 1;
```

**Step 4 — Save file**

**Step 5 — (Optional) Validate sqlc locally:**

```bash
cd internal/db
sqlc generate
```

**Step 6 — Commit:**

```bash
git add internal/db/queries/authorized_signers.sql
git commit -m "fix(authorized_signers): qualify column references to avoid ambiguity"
```

---

### Task 3: Verify sqlc generates clean Go code

**Goal:** Ensure no further sqlc errors remain in any `.sql` file.

**Step 1 — Run sqlc generate locally if sqlc available:**

```bash
cd internal/db
sqlc generate
```

Expected: exit code 0, no error messages.

**Step 2 — If sqlc missing or errors persist:**
- Re-check modified files for missed column references
- Scan other `.sql` files for similar patterns (grep for `created_at` in ai queries, or ambiguous `id` patterns). Use:

```bash
grep -n "created_at" internal/db/queries/*.sql
```

Only `authorized_signers` and `users` etc should have `created_at`.

**Step 3 — If clean, proceed. Else iterate on fixes.**

---

### Task 4: Push branch and verify CI

**Step 1 — Push commits to remote:**

```bash
git push origin feature/minirag-hybrid-integration
```

**Step 2 — Wait for GitHub Actions to run (or trigger manually).**

**Step 3 — Monitor run:**

```bash
gh run list --branch feature/minirag-hybrid-integration --limit 3
```

Check that latest run status = `completed`.

**Step 4 — If CI passes:** Task complete. PR 301 ready for review/merge.

**Step 5 — If CI fails:** Repeat diagnosis:
- Fetch logs: `gh run view <RUN_ID> --log`
- Identify new errors
- Create follow-up plan or loop back to Task 1/2

---

### Task 5: Post-fix cleanup

**Step 1 — Ensure no leftover generated code mismatches:**  
If `sqlc generate` was run locally, generated files are already updated. Commit any changes if not already staged:

```bash
git status
# If internal/db/sqlc.gen or models changed:
git add internal/db/sqlc.gen/
git commit -m "chore: regenerate sqlc code after query fixes"
```

**Step 2 — Open PR and request review** (if not already open)

PR 301 already exists. Push fixes directly to branch; CI will re-run on same PR.

---

## Expected Outcomes

- `sqlc generate` succeeds without errors.
- CI build completes: frontend builds, Go compiles, tests pass.
- PR 301 can be merged once review approved.

---

**Plan complete and saved to `docs/plans/2026-05-02-fix-sqlc-errors.md`.**

**Three execution options:**

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration.  
**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints.  
**3. Plan-to-Issues (team workflow)** — Convert plan tasks to GitHub issues for team distribution.

**Which approach?**
