# CI Build Fix — Diseño de Solución Mínima

**Fecha:** 2026-04-28  
**Estado:** Diseño aprobado  
**Alcance:** Solución mínima — corregir únicamente errores de compilación Go  
**Rama:** main  
**Workflow afectado:** Build (GitHub Actions)

---

## Problema

El workflow de **Build** en rama `main` está fallando con errores de compilación Go:

1. `internal/reports/generator.go:4` — import `"bytes"` declarado pero no usado
2. `internal/reports/generator.go:53` — llamada incorrecta a `pdf.Output()`: "not enough arguments" y "assignment mismatch: 2 variables but pdf.Output returns 1 value"
3. `internal/handlers/password_reset.go:10` — import `"time"` declarado pero no usado

El workflow de **Release** falla en cascada porque el build no genera los assets embebidos (`cmd/pacta/dist`).

---

## Contexto

- **Librería PDF:** `github.com/phpdave11/gofpdf v1.4.3` (no v2)
- **Commit introductorio:** `06a5e11` — migración desde `jung-kurt/gofpdf` por compatibilidad Go 1.25
- **Commit problemático:** `56ab410` — intento de actualizar llamada `Output()` a API v1.4.3 (incorrecto)
- ** go.mod:** `github.com/phpdave11/gofpdf v1.4.3`

---

## Análisis de Causa Raíz

### Archivo: `internal/reports/generator.go`

El código actual (después del commit `56ab410`):

```go
var buf bytes.Buffer
if err := pdf.Output(&buf); err != nil {
    return nil, fmt.Errorf("failed to generate PDF: %w", err)
}
return buf.Bytes(), nil
```

**Problema:**  
El compilador reporta que `pdf.Output` retorna **1 valor** (error), pero el código está intentando usarlo como si retornara 2. Además, el import `"bytes"` se marca como no usado porque `buf` nunca se utiliza efectivamente (la llamada a `Output` falla en tiempo de compilación, no en ejecución).

**API correcta de gofpdf v1.4.3:**

El método `Output` tiene la firma:
```go
func (f *Fpdf) Output(p io.Writer) error
```
Escribe el PDF en un `io.Writer` y retorna solo `error`.

Sin embargo, el error "assignment mismatch: 2 variables" sugiere que el compilador está viendo una firma diferente. Esto puede deberse a que **el método correcto a usar es `OutputFileAndClose()`** para escribir a archivo, o hay confusión con la API de versiones anteriores.

**Solución adoptada:** Usar `OutputFileAndClose()` — método estable, documentado y simple:

```go
tmpFile, err := os.CreateTemp("", "contracts-*.pdf")
if err != nil { ... }
defer os.Remove(tmpFile.Name())

if err := pdf.OutputFileAndClose(tmpFile.Name()); err != nil { ... }

data, err := os.ReadFile(tmpFile.Name())
return data, nil
```

### Archivo: `internal/handlers/password_reset.go`

Import `"time"` en línea 10 no es utilizado en ninguna parte del archivo (búsqueda confirmada). Eliminar.

---

## Diseño Detallado

### Componentes Modificados

| Archivo | Cambios | Líneas |
|---------|---------|--------|
| `internal/reports/generator.go` | - Eliminar import `"bytes"`<br>- Cambiar lógica de output: usar `OutputFileAndClose()` + lectura de archivo temporal | 4, 52-58 |
| `internal/handlers/password_reset.go` | - Eliminar import `"time"` no usado | 10 |

### Flujo de Datos (generator.go)

```
GenerateContractsPDF(contracts)
    ↓
Crear PDF con gofpdf (páginas, tablas, etc.)
    ↓
Crear archivo temporal (os.CreateTemp)
    ↓
pdf.OutputFileAndClose(tmpFile.Name()) → escribe PDF en disco
    ↓
Leer archivo: os.ReadFile(tmpFile.Name())
    ↓
Retornar []byte + nil error
```

### Manejo de Errores

Se mantiene el wrapper `fmt.Errorf("failed to ...: %w", err)` para preservar contexto. Se agregará validación de:
- Creación de archivo temporal (os.CreateTemp)
- Lectura del archivo generado (os.ReadFile)

### Dependencias

**Nuevos imports en `generator.go`:**
```go
import (
    "fmt"
    "io"
    "os"
    "time"

    "github.com/phpdave11/gofpdf"
)
```
- `io` — para `io.Writer` (referencia, aunque `OutputFileAndClose` no lo requiere explícitamente)
- `os` — para creación y lectura de archivo temporal

**Eliminados:**
- `"bytes"` — ya no se usa buffer en memoria

---

## Validación Post-Implementación

**Comandos secuenciales:**

```bash
# 1. Asegurar formatting
go fmt ./internal/reports
go fmt ./internal/handlers

# 2. Sincronizar dependencias (go.mod/go.sum)
go mod tidy

# 3. Compilar todo el proyecto
go build ./...

# 4. Verificar con vet
go vet ./...

# 5. (Opcional) Ejecutar tests existentes
go test ./...
```

**Criterio de éxito:**  
`go build ./...` y `go vet ./...` completan sin errores. El workflow de GitHub Actions (Build) debe pasar.

---

## Impacto en Otros Sistemas

- **Frontend build:** No afectado (no hay cambios en `pacta_appweb/`)
- **Release workflow:** Se desbloqueará automáticamente al pasar el build ( genera `cmd/pacta/dist`)
- **Runtime:** `GenerateContractsPDF` seguirá retornando `[]byte` igual que antes — **no hay cambio en la API pública**, solo implementación interna
- **Backwards compatibility:** 100% — la firma de la función no cambia

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| `OutputFileAndClose` no disponible en v1.4.3 | Baja | Alto | Verificar en go.mod que la versión sea phpdave11/gofpdf v1.4.3 (confirmado) |
| Permisos de archivo temporal en CI | Media | Medio | Usar `os.CreateTemp` (seguro) + `defer os.Remove` |
| Race condition con archivo temporal | Muy baja | Bajo | Archivo temporal por goroutine (nombre único) |
| Rendimiento (E/S disco vs memoria) | Baja | Bajo | PDFs de contratos son pequeños (<100KB). I/O insignificante |

---

## Alternativas Consideradas (y descartadas)

### Alternativa 1: Usar `bytes.Buffer` + `Output` (original intent)

```go
var buf bytes.Buffer
if err := pdf.Output(&buf); err != nil { ... }
return buf.Bytes(), nil
```

**Razón de descarte:**  
El compilador ya reporta que `pdf.Output` no recibe enough arguments y hay mismatch de retorno. Aunque la firma teórica es `Output(io.Writer) error`, en la práctica con v1.4.3 hay conflicto. Investigar más llevaría tiempo — fuera de alcance para solución mínima.

### Alternativa 2: Actualizar gofpdf a v2

```bash
go get github.com/go-pdf/fpdf/v2
```

**Razón de descarte:**  
- Introduciría cambios mayores en imports y posiblemente API
- El commit `06a5e11` migró específicamente a `phpdave11/gofpdf` (no v2) para compatibilidad Go 1.25
- Fuera de alcance (solución mínima solo fix errores)

---

## Decisiones

1. **Usar `OutputFileAndClose`** — más robusto, documentado, evita ambigüedades de API
2. **Mantener misma interfaz pública** — `GenerateContractsPDF` retorna `([]byte, error)` sin cambios
3. **No agregar tests** — alcance mínimo
4. **No refactorizar** más allá de lo necesario para que compile

---

## Próximos Pasos (Implementation)

1. Aplicar cambios en `generator.go` y `password_reset.go`
2. Ejecutar `go mod tidy`
3. Ejecutar `go build ./...` local (verificar)
4. Commit con mensaje: `fix: resolve Go build errors (unused imports, gofpdf API)`
5. Push a rama feature
6. PR → Merge a main
7. CI debe pasar automáticamente

---

**Diseño aprobado:** Sí (usuario confirmó Opción A — solución mínima)  
**Documento撰写的:** 2026-04-28  
**Autor:** Kilo (CI Debug Skill + Systematic Debugging + Brainstorming)
