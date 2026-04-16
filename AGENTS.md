# AGENTS.md - Pacta Project Rules

## Development Philosophy

This project follows a **local-write, CI-build** workflow:

### Local Development
- **DO**: Write code, create features, fix bugs
- **DO NOT**: Run `go build`, `go mod tidy`, `npm run build`, compile, or test locally
- **REASON**: Local environment is not configured for builds; Go, Node, and all tooling is only available in GitHub Actions CI

### CI-Driven Build Process
- All compilation happens in GitHub Actions
- Errors discovered in CI are resolved by:
  1. Analyzing the error message
  2. Fixing the code locally
  3. Pushing to trigger CI again
- Use the skill `ci-debug-workflow` to diagnose and fix CI failures

## Workflow Rules

1. **Never run build commands locally** - No `go build`, `npm run build`, `cargo build`, etc.
2. **Code changes go directly to remote** - Push commits; CI validates everything
3. **Fix errors via CI feedback** - Read CI logs, understand error, fix locally, push again
4. **Version updates** - Research correct versions using Context7 or web search before updating dependencies

## Skill Usage

- **ci-debug-workflow**: Required for diagnosing any CI failure
- **systematic-debugging**: Use for root cause analysis of build errors
- **brainstorming**: Use when solution is unclear

## Examples

### DO
```bash
# Edit code
vim internal/email/sendmail.go

# Commit and push
git add -A && git commit -m "fix: ..." && git push
```

### DO NOT
```bash
# These should NEVER be run locally
go build ./...
go mod tidy
npm run build
cargo build
```
