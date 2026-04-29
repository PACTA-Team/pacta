# CI Build Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corregir errores de compilación Go en rama main para que el workflow de Build pase y se desbloquee el Release.

**Architecture:** Solución mínima — eliminar imports no usados y corregir llamada a gofpdf API en generator.go. Sin cambios en interfaces públicas.

**Tech Stack:** Go 1.25, github.com/phpdave11/gofpdf v1.4.3

---

## Prerequisites

- Repositorio en `/home/mowgli/pacta`
- Branch actual: `main`
- Herramientas: `go`, `git`, `gh` configurado
- **NO ejecutar builds locales** — según AGENTS.md: "Local-Write, CI-Build"

---

### Task 1: Eliminar import no usado en `password_reset.go`

**Files:**
- Modify: `internal/handlers/password_reset.go:10`

**Step 1:** Abrir archivo y ubicar bloque de imports

**Step 2:** Eliminar la línea `"time"` del import block

**Antes:**
```go
import (
    "context"
    "database/sql"
    "encoding/json"
    "log"
    "net/http"
    "strings"
    "time"  // ← ELIMINAR ESTA LÍNEA

    "github.com/PACTA-Team/pacta/internal/email"
    ...
)
```

**Después:**
```go
import (
    "context"
    "database/sql"
    "encoding/json"
    "log"
    "net/http"
    "strings"

    "github.com/PACTA-Team/pacta/internal/email"
    ...
)
```

**Step 3:** Guardar archivo

**Step 4:** Commit (parcial, sin push aún)

```bash
git add internal/handlers/password_reset.go
git commit -m "fix: remove unused 'time' import in password_reset.go"
```

**Expected:** Commit creado localmente.

---

### Task 2: Corregir `generator.go` — reemplazar lógica de Output

**Files:**
- Modify: `internal/reports/generator.go:1-58` (import block + función `GenerateContractsPDF`)

**Step 1:** Actualizar imports

**Antes:**
```go
import (
    "bytes"   // ← ELIMINAR
    "fmt"
    "time"

    "github.com/phpdave11/gofpdf"
)
```

**Después:**
```go
import (
    "fmt"
    "io"
    "os"
    "time"

    "github.com/phpdave11/gofpdf"
)
```

**Step 2:** Reemplazar bloque de output PDF (líneas 52-58)

**Antes:**
```go
// Output PDF
var buf bytes.Buffer
if err := pdf.Output(&buf); err != nil {
    return nil, fmt.Errorf("failed to generate PDF: %w", err)
}
return buf.Bytes(), nil
```

**Después:**
```go
// Output PDF to temporary file, then read as bytes
tmpFile, err := os.CreateTemp("", "contracts-*.pdf")
if err != nil {
    return nil, fmt.Errorf("failed to create temp file: %w", err)
}
defer os.Remove(tmpFile.Name())

if err := pdf.OutputFileAndClose(tmpFile.Name()); err != nil {
    return nil, fmt.Errorf("failed to generate PDF: %w", err)
}

// Read generated PDF
data, err := os.ReadFile(tmpFile.Name())
if err != nil {
    return nil, fmt.Errorf("failed to read generated PDF: %w", err)
}
return data, nil
```

**Step 3:** Guardar archivo

**Step 4:** Commit

```bash
git add internal/reports/generator.go
git commit -m "fix: use OutputFileAndClose for gofpdf v1.4.3 compatibility"
```

**Expected:** Archivo compila sin errores de firma.

---

### Task 3: Ejecutar `go mod tidy`

**Step 1:** Sincronizar dependencias (eliminar imports no usados del módulo)

```bash
go mod tidy
```

**Expected Output:**
```
go: downloading...
go: updated ...
```
Sin errores.

**Step 2:** Verificar que `go.mod` y `go.sum` se actualizaron

```bash
git diff go.mod go.sum
```

Debería mostrar cambios menores (posiblemente eliminación de dependencies no usadas, o actualización de checksums).

**Step 3:** Commit

```bash
git add go.mod go.sum
git commit -m "chore: tidy go modules after unused import removals"
```

---

### Task 4: Compilar localmente (verificación previa a CI)

**Step 1:** Compilar todos los paquetes

```bash
go build ./...
```

**Expected:** `go build` exitoso, sin errores.

**Step 2:** Verificar con vet

```bash
go vet ./...
```

**Expected:** Sin problemas críticos. Si hay warnings de `go vet` en otros archivos (no relacionados a nuestros cambios), documentar pero no bloquear.

**Step 3:** Si hay errores, regresar a Task 1-2 y corregir

**Step 4:** Si success, continuar.

---

### Task 5: Preparar rama para PR

**Step 1:** Verificar estado de git

```bash
git status
```

Debería mostrar rama `main` con 3 commits locales (o 2 si combinamos).

**Step 2:** Push a rama feature (para PR)

```bash
git checkout -b fix/ci-build-errors
git push -u origin fix/ci-build-errors
```

**Step 3:** Crear PR desde `fix/ci-build-errors` → `main`

```bash
gh pr create --title "fix: resolve Go build errors (unused imports, gofpdf API)" \
  --body "Fix CI build failures:\n\n- Remove unused imports in password_reset.go\n- Correct gofpdf Output() usage in generator.go (use OutputFileAndClose)\n- Tidy go.mod\n\nFixes: #<ISSUE_NUMBER_IF_ANY>" \
  --base main \
  --head fix/ci-build-errors
```

**Expected:** PR creado, URL impresa.

---

### Task 6: Esperar CI y verificar

**Step 1:** Monitorear CI del PR

```bash
gh pr checks --watch
```

O manual:

```bash
gh run list --limit 3 --json status,conclusion,databaseId
```

**Step 2:** Si CI falla, revisar logs (retroceder a debugging)

**Step 3:** Si CI pasa, proceder a merge

---

### Task 7: Merge a main (via PR)

**Step 1:** Merge PR

```bash
gh pr merge --squash --delete-branch
```

**Step 2:** Verificar que main actualizado

```bash
git checkout main
git pull origin main
```

**Step 3:** Confirmar que latest commit en main incluye los fixes

```bash
git log --oneline -3
```

---

### Task 8: Validación final en main

**Step 1:** Verificar que el workflow de Build en `main` pasa

```bash
gh run list --limit 5 --branch main --json status,name,conclusion | grep Build
```

**Expected:** `Build` → `success`

**Step 2:** Verificar que Release ya no esté fallando por assets faltantes

```bash
gh run list --limit 5 --branch main --json status,name,conclusion | grep Release
```

**Expected:** `Release` → `success` (o al menos no failure por dist/assets)

---

## Testing Strategy

**No se agregan tests nuevos** (alcance mínimo). Sin embargo:

- **Compilación (`go build ./...`)** actúa como prueba de que el código es válido
- **`go vet ./...`** detecta problemas comunes
- **CI pipeline** (Build workflow) ejecuta:
  - `npm ci && npm run build` (frontend)
  - `go mod tidy`
  - `go build ./...`
  - `go vet ./...`
  - `govulncheck` (no relevante para estos cambios)

**Verificación manual (si se desea):**
- Llamar endpoint que use `GenerateContractsPDF` (ej. `/api/reports/contracts`) y validar que retorna PDF bytes (Content-Type: application/pdf)

---

## Commits Esperados

1. `fix: remove unused 'time' import in password_reset.go`
2. `fix: use OutputFileAndClose for gofpdf v1.4.3 compatibility`
3. `chore: tidy go modules after unused import removals`

**Rama:**
- `fix/ci-build-errors` → PR → `main`

---

## Documentación

**No se requiere actualización de docs** — cambios internos, sin cambio de API pública.

---

## Rollback Plan

Si surgen problemas post-merge:

```bash
# Revertir último commit en main (si es necesario)
git revert HEAD
git push origin main
```

Pero dado que los cambios son pequeños y la compilación pasa, riesgo mínimo.

---

## Preguntas Frecuentes

**Q: ¿Por qué no usar `bytes.Buffer` con `pdf.Output(&buf)`?**  
R: El compilador reporta que `pdf.Output` retorna 1 valor, pero el código asume 2. La firma documentada es `Output(io.Writer) error`, pero en la práctica hay conflicto con esta versión de gofpdf. `OutputFileAndClose` es más directo y evita ambigüedad.

**Q: ¿Por qué archivo temporal en disco en vez de memoria?**  
R: `OutputFileAndClose` escribe directo a archivo. No hay método `OutputToBytes()` en esta versión. El costo I/O es aceptable para PDFs pequeños. Podría optimizarse en el futuro si performance es crítica.

**Q: ¿Esto afecta la API de `GenerateContractsPDF`?**  
R: No. Firma pública idéntica: `func (contracts []Contract) ([]byte, error)`. Comportamiento idéntico desde perspectiva del llamador.

**Q: ¿Por qué no agregar tests ahora?**  
R: Alcance mínimo (Opción A). Tests pueden agregarse en trabajo futuro (mejora separada).

---

## Criterios de Éxito

- ✅ `go build ./...` sin errores
- ✅ `go vet ./...` sin errores blockers
- ✅ GitHub Actions Build workflow pasa en `main`
- ✅ Release workflow genera assets correctamente
- ✅ No hay regresión en endpoints que generan PDFs

---

**Plan creado:** 2026-04-28  
**Autor:** Kilo (brainstorming + writing-plans)  
**Design Ref:** `docs/plans/2026-04-28-ci-build-fix-design.md`
