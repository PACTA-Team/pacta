#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
# Clone faiss if not present
if [ ! -d "faiss" ]; then
  git clone --depth 1 https://github.com/facebookresearch/faiss.git .
fi
mkdir -p build && cd build
cmake -DCMAKE_BUILD_TYPE=Release -DFAISS_ENABLE_GPU=OFF -DFAISS_ENABLE_PYTHON=OFF -DBUILD_SHARED_LIBS=OFF ..
make -j$(nproc) faiss
# Copy static lib to project root for linking
cp libfaiss.a ../../../../../.. || true
echo "FAISS static lib built at $(pwd)/libfaiss.a"
