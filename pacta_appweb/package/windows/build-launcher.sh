#!/usr/bin/env bash
# Build script for PACTA Launcher
# Usage: ./build-launcher.sh
#
# Produces a GUI-mode executable (no console window) with stripped symbols
# for minimal binary size.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHER_DIR="${SCRIPT_DIR}/launcher"
OUTPUT_DIR="${SCRIPT_DIR}"

echo "Building PACTA Launcher..."

cd "${LAUNCHER_DIR}"

# Build with windowsgui subsystem (no console window), stripped and compressed
# -H windowsgui : Windows GUI subsystem (no console window)
# -s            : Strip symbol table
# -w            : Strip DWARF debug information
go build \
  -ldflags="-H windowsgui -s -w" \
  -o "${OUTPUT_DIR}/PACTA.exe" \
  main.go

FILE_SIZE=$(stat -c%s "${OUTPUT_DIR}/PACTA.exe" 2>/dev/null || stat -f%z "${OUTPUT_DIR}/PACTA.exe" 2>/dev/null || echo "unknown")
echo "Build successful: ${OUTPUT_DIR}/PACTA.exe (${FILE_SIZE} bytes)"
