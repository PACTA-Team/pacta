# Themis AI – Deployment Guide

## Environment Variables

- `AI_ENCRYPTION_KEY` (required for AI features): 16/24/32 byte string
  Example: `export AI_ENCRYPTION_KEY=mysecretkey12345678` (16 bytes)

## Pre-Deployment Checks

1. Ensure Go 1.25+ and Node 22+ in CI
2. Verify migrations folder includes `005_ai_settings.sql`
3. Confirm `internal/server/server.go` applies migrations on startup

## Deployment Steps

1. Merge PR #295 to `main`
2. CI builds binary and frontend assets
3. Deploy binary to server
4. Set `AI_ENCRYPTION_KEY` in systemd service or env file
5. Restart service
6. Check logs for: `AI_ENCRYPTION_KEY validated` or similar
7. Access PACTA → Settings → AI Configuration
8. Enter provider, API key, model, save
9. Test: generate a contract (smoke test)

## Rollback

If issues arise:
1. Set `ai_provider` setting to empty string via API or DB:
   ```sql
   UPDATE system_settings SET value='' WHERE key='ai_provider';
   ```
2. Restart service – AI endpoints will return 503 (disabled)
3. Binary rollback to previous version if needed

## Monitoring

Watch logs for:
- `[AI]` prefixed entries
- Rate limit warnings
- Encryption errors

Metrics (future): Add Prometheus counters for `ai_requests_total`, `ai_errors_total`.
