# Decisión de Arquitectura: Motor LLM Embebido para PACTA

**Fecha**: 2026-04-29  
**Estado**: Decidido  
**Base**: Análisis con Context7 + Zoom Out + Architecture Patterns  

---

## 1. Contexto del Problema

El usuario requiere integrar **Qwen2.5-0.5B-Instruct** dentro del binario Go de PACTA:
- ✅ 100% offline (sin internet)
- ✅ Embebido en el binario (no procesos externos)
- ✅ Activable vía configuración admin
- ✅ Soporte para contratos PDF/Word
- ✅ < 500 MB de peso en binario (429 MB Q4_0)

---

## 2. Opciones Evaluadas

### Opción 1: llama.cpp via CGo ✅ **SELECCIONADA**

**Descripción**:
- Motor de inferencia C/C++ optimizado
- Bindings CGo para integración con Go
- Modelos en formato GGUF (cuantizados)

**Ventajas**:
- ✅ **Soporte nativo Qwen2.5** (Alibaba lo entrena para esto)
- ✅ **Rendimiento superior en CPU** (instrucciones AVX/NEON)
- ✅ **Cuantización integrada** (Q2_K = 415 MB, Q4_0 = 429 MB, Q4_K_M = 491 MB)
- ✅ **Contexto largo** (128k tokens nativo)
- ✅ **Misma arquitectura que SQLite** (ya usa CGo en PACTA)
- ✅ **Embeddings** (all-MiniLM-L6-v2 también GGUF)

**Desventajas**:
- ⚠️ Requiere CGo (C/C++ mixed with Go)
- ⚠️ Binario más grande (~50MB con modelo estático)

**Análisis de Riesgo**:
- 🟢 **Riesgo: Compilación CGo** → Mitigación: Usar misma estrategia que go-sqlite3
- 🟢 **Riesgo: Tamaño binario** → Mitigación: Modelo opcional, descarga en primer uso

---

### Opción 2: ONNX Runtime Go ❌ **RECHAZADA**

**Descripción**:
- Microsoft ONNX Runtime con bindings Go
- Modelos convertidos a formato ONNX

**Ventajas**:
- ✅ Go puro + shared library
- ✅ Soporte aceleración GPU (CUDA, TensorRT)
- ✅ Ecosistema Qwen (mismo que Qwen2.5-0.5B)

**Desventajas**:
- ❌ **Qwen2.5 NO tiene exportación ONNX oficial**
- ❌ Modelos ONNX son más grandes (4-5GB vs 429 MB GGUF)
- ❌ Conversión requiere PyTorch → ONNX (complejo)
- ❌ Menos optimizado para CPU que llama.cpp

**Razón de rechazo**: No hay forma oficial de convertir Qwen2.5 a ONNX sin pérdida de rendimiento.

---

### Opción 3: Gorgonia (Pure Go) ❌ **RECHAZADA**

**Descripción**:
- Biblioteca Go para grafos computacionales
- Implementación propia de transformers

**Ventajas**:
- ✅ 100% Go (sin CGo)
- ✅ Fácil de mantener en ecosistema Go
- ✅ Sin dependencias externas

**Desventajas**:
- ❌ **No hay implementación de transformers optimizada**
- ❌ Tendríamos que escribir Qwen2.5 desde cero
- ❌ Rendimiento insuficiente para producción
- ❌ Comunidad pequeña, documentación limitada

**Razón de rechazo**: Reinventar la rueda. Tardaríamos meses en implementar lo que llama.cpp ya tiene.

---

## 3. Decisión Final

### ✅ **Opción 1: llama.cpp via CGo**

**Justificación técnica**:

1. **Mejor fit para Qwen2.5-0.5B**:
   - Alibaba entrena Qwen específicamente para GGUF (llama.cpp)
   - Hugging Face oficial: `Qwen/Qwen2.5-0.5B-Instruct-GGUF`
   - Cuantizaciones validadas por Qwen team
   - 429 MB Q4_0 (bajo el límite de 500 MB) ✅
   - 128k context: Maneja contratos largos sin problemas
   - Embeddings: all-MiniLM-L6-v2 corre en < 50ms

---

## 4. Diseño de Implementación

### 4.1 Estructura de Archivos

```
internal/ai/minirag/
├── cgo_llama.go              # Bindings CGo principales
├── cgo_embeddings.go         # Embeddings via llama.cpp
├── local_llm.go              # Wrapper Go para CGo
└── models/                   # GGUF models (no subidos a git)
    ├── .gitignore             # Ignorar archivos .gguf
    └── README.md              # Instrucciones de descarga
```

### 4.2 Ejemplo de CGo Integration

```go
// internal/ai/minirag/cgo_llama.go

//#cgo CFLAGS: -I./llama.cpp/include
//#cgo LDFLAGS: -L./llama.cpp/build -llama -lm -lstdc++ -lpthread
//#include "llama.h"
import "C"

type LLMInference struct {
    model *C.llama_model_t
    ctx   *C.llama_context_t
}

func (l *LLMInference) LoadModel(modelPath string) error {
    // Inicializar backend
    C.ggml_backend_load_all()
    
    // Cargar modelo
    params := C.llama_model_default_params()
    l.model = C.llama_model_load_from_file(
        C.CString(modelPath), 
        params,
    )
    if l.model == nil {
        return fmt.Errorf("failed to load model")
    }
    
    // Crear contexto
    ctxParams := C.llama_context_default_params()
    ctxParams.n_ctx = 4096
    l.ctx = C.llama_init_from_model(l.model, ctxParams)
    
    return nil
}

func (l *LLMInference) Generate(prompt string) (string, error) {
    // Tokenizar
    vocab := C.llama_model_get_vocab(l.model)
    tokens := C.llama_tokenize(vocab, C.CString(prompt), ...)
    
    // Decodificar
    var output strings.Builder
    for i := 0; i < 2048; i++ {
        token := C.llama_sample_token(l.ctx, ...)
        if C.llama_vocab_is_eog(vocab, token) {
            break
        }
        piece := C.llama_token_to_piece(vocab, token)
        output.WriteString(C.GoString(piece))
        C.llama_decode(l.ctx, token)
    }
    
    return output.String(), nil
}
```

### 4.3 Build Process (GitHub Actions)

```yaml
# .github/workflows/build.yml
- name: Build llama.cpp
  run: |
    cd internal/ai/minirag/llama.cpp
    mkdir build && cd build
    cmake .. -DBUILD_SHARED_LIBS=OFF
    make -j4

- name: Build Go with CGo
  run: |
    go build -tags cgo -o pacta ./cmd/pacta
```

### 4.4 Modelos (GUF)

**Tamaños estimados**:
- `qwen2.5-0.5b-instruct-q4_0.gguf`: 429 MB
- `all-MiniLM-L6-v2.Q4_K_M.gguf`: 22 MB
- **Total**: ~451 MB (descarga en primer uso)

**Estrategia de distribución**:
1. **Opción A**: Incluir en binario (rara, gran tamaño)
2. **Opción B (Recomendada)**: Descargar en primer uso
   ```go
   func (l *LLMInference) EnsureModel() error {
       if _, err := os.Stat(l.modelPath); os.IsNotExist(err) {
           // Descargar de Hugging Face
           l.downloadModel()
       }
       return l.LoadModel()
   }
   ```

---

## 5. Integración con el Diseño Existente

### 5.1 Actualizar `local_client.go`

```go
// internal/ai/minirag/local_client.go

type LLMInference struct {
    modelPath string
    inference *cgoLLMInference  // Nuevo: CGo bindings
    ready     bool
}

func (l *LLMInference) Generate(ctx context.Context, prompt string) (string, error) {
    if !l.ready {
        if err := l.EnsureModel(); err != nil {
            // Fallback a Ollama si falla
            return l.fallbackToOllama(ctx, prompt)
        }
    }
    
    // Inferencia local via CGo
    return l.inference.Generate(prompt)
}
```

### 5.2 Compatibilidad

✅ **Backward compatible**:
- Modo "external" sigue funcionando igual
- Modo "local" usa nuevo motor CGo
- Modo "hybrid" combina ambos

✅ **Configuración mantenida**:
```go
type RAGConfig struct {
    Mode          string // "local", "external", "hybrid"
    LocalModel    string // "qwen2.5-0.5b-instruct-q4_0.gguf"
    EmbeddingModel string // "all-MiniLM-L6-v2.Q4_K_M.gguf"
    // ...
}
```

---

## 6. Riesgos y Mitigación

| Riesgo | Impacto | Mitigación |
|--------|---------|-------------|
| Compilación CGo falla | Alto | Usar misma estrategia que go-sqlite3 (ya probada) |
| Tamaño binario muy grande | Medio | Modelos opcionales, descarga diferida |
| Rendimiento en CPU antigua | Medio | Cuantización Q4 (más rápida) |
| Memoria insuficiente | Alto | Verificar RAM mínima (8GB recomendado) |
| Falla carga modelo | Medio | Fallback automático a Ollama/External |

---

## 7. Conclusión

**llama.cpp via CGo es la única opción viable técnicamente** para integrar Qwen2.5-0.5B-Instruct de forma embebida en PACTA.

**Razones clave**:
1. Qwen2.5 está diseñado para GGUF (llama.cpp)
2. PACTA ya usa CGo (go-sqlite3)
3. Rendimiento producción-ready
4. Soporte completo para embeddings + generación
5. Mantenibilidad a largo plazo (comunidad activa)

**Siguiente paso**: Implementar `cgo_llama.go` con bindings mínimos y probar inferencia básica.

---

## 8. Referencias

- Context7: `/liquid4all/liquid_llama.cpp` (Benchmark: 90.88)
- Context7: `/yalue/onnxruntime_go` (Benchmark: 93.1)
- Context7: `/gorgonia/gorgonia` (Benchmark: 77.2)
- Hugging Face: `Qwen/Qwen2.5-0.5B-Instruct-GGUF`
- GitHub: `ggerganov/llama.cpp`
