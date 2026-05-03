#!/usr/bin/env bash
# Build native dependencies for MiniRAG: FAISS-CPU and llama.cpp
# Run from repository root: ./scripts/build_deps.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== MiniRAG Native Dependencies Build ==="
echo "Repository root: $REPO_ROOT"

# Ensure llama.cpp submodule is present
if [ ! -d "$REPO_ROOT/internal/ai/minirag/llama.cpp" ]; then
  echo "ERROR: llama.cpp submodule not found. Run:"
  echo "  git submodule update --init --recursive internal/ai/minirag/llama.cpp"
  exit 1
fi

# --- Build FAISS-CPU ---
echo ""
echo "--- Building FAISS-CPU ---"
cd "$REPO_ROOT/internal/ai/minirag/vector/faiss"

if [ ! -f "build_faiss.sh" ]; then
  echo "ERROR: build_faiss.sh not found in vector/faiss/"
  exit 1
fi

./build_faiss.sh

FAISS_LIB="$(ls -1 build/libfaiss.* 2>/dev/null | head -n1)"
if [ -z "$FAISS_LIB" ]; then
  echo "ERROR: FAISS library not found after build. Expected: build/libfaiss.*"
  exit 1
fi
echo "FAISS built: $REPO_ROOT/internal/ai/minirag/vector/faiss/$FAISS_LIB"

# --- Build llama.cpp ---
echo ""
echo "--- Building llama.cpp ---"
cd "$REPO_ROOT/internal/ai/minirag/llama.cpp"

if [ ! -d "build" ]; then
  mkdir build
fi

cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j"$(nproc)"

if [ ! -f "build/libllama.a" ]; then
  echo "ERROR: llama.cpp static library not found at build/libllama.a"
  exit 1
fi
echo "llama.cpp built: $REPO_ROOT/internal/ai/minirag/llama.cpp/build/libllama.a"

echo ""
echo "=== All dependencies built successfully ==="
echo ""
echo "Next: go build ./cmd/pacta"
echo "      (ensure CGO_CFLAGS and CGO_LDFLAGS point to these locations)"
