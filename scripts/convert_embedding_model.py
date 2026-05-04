#!/usr/bin/env python3
"""
Convert sentence-transformers/paraphrase-MiniLM-L3-v2 to GGUF Q8_0 format.

This script downloads the model, converts it using llama.cpp's convert.py,
and places the resulting GGUF file in internal/ai/minirag/models/.

Dependencies:
    pip install transformers torch llama-cpp-python

One-time conversion — the output file will be committed to the repository
and embedded via go:embed in the Go binary.
"""

import argparse
import os
import sys
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Optional

try:
    from transformers import AutoModel
    import torch
except ImportError as e:
    print("ERROR: Missing dependencies. Install with:")
    print("  pip install transformers torch llama-cpp-python")
    sys.exit(1)


def detect_llama_cpp_convert() -> Optional[Path]:
    """Find llama.cpp conversion script for HuggingFace models."""
    repo_root = Path(__file__).resolve().parents[1]  # scripts/ -> repo root
    possible_paths = [
        repo_root / "internal" / "ai" / "minirag" / "llama.cpp" / "convert_hf_to_gguf.py",
        repo_root / "llama.cpp" / "convert_hf_to_gguf.py",
    ]
    for p in possible_paths:
        if p.exists():
            return p
    return None


def convert_model(force: bool = False) -> bool:
    """Convert the embedding model to GGUF Q8_0 format."""
    model_name = "sentence-transformers/paraphrase-MiniLM-L3-v2"
    output_filename = "paraphrase-MiniLM-L3-v2-Q8_0.gguf"
    output_dir = Path(__file__).resolve().parents[1] / "internal" / "ai" / "minirag" / "models"
    output_path = output_dir / output_filename

    print(f"Converting model: {model_name}")
    print(f"Output directory: {output_dir}")
    print(f"Output file: {output_path}")

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Check if output already exists
    if output_path.exists() and not force:
        print(f"\nOutput file already exists: {output_path}")
        response = input("Overwrite? (y/N): ").strip().lower()
        if response != 'y':
            print("Conversion cancelled.")
            return False

    # Find llama.cpp convert.py
    convert_script = detect_llama_cpp_convert()
    if convert_script is None:
        print("\nERROR: llama.cpp convert_hf_to_gguf.py not found.")
        print("Clone llama.cpp first:")
        print("  git clone https://github.com/ggerganov/llama.cpp internal/ai/minirag/llama.cpp")
        sys.exit(1)

    print(f"\nUsing converter: {convert_script}")

    # Create temporary directory for downloaded model files
    temp_dir = Path(tempfile.mkdtemp(prefix="minirag_convert_"))
    print(f"  Temporary model dir: {temp_dir}")

    # Step 1: Download model via transformers
    print("\nStep 1/2: Downloading model from Hugging Face...")
    try:
        print(f"  Loading {model_name}...")
        model = AutoModel.from_pretrained(model_name)
        print(f"  Model loaded: {type(model)}")
        print(f"  Model dtype: {model.dtype}")
        print(f"  Saving to {temp_dir}...")
        model.save_pretrained(temp_dir)
    except Exception as e:
        print(f"  ERROR downloading model: {e}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        sys.exit(1)

    # Step 2: Run llama.cpp convert.py
    print("\nStep 2/2: Converting to GGUF with llama.cpp...")
    llama_cpp_dir = convert_script.parent

    cmd = [
        sys.executable,  # Use same Python interpreter
        str(convert_script),
        str(temp_dir),   # Model directory as positional argument
        "--outfile", str(output_path),
        "--outtype", "q8_0",
    ]

    print(f"  Running: {' '.join(cmd)}")
    print(f"  Working dir: {llama_cpp_dir}")

    try:
        result = subprocess.run(
            cmd,
            cwd=llama_cpp_dir,
            capture_output=False,  # Stream output to console
            check=True,
        )
        print(f"\nSUCCESS: Model converted to {output_path}")
        try:
            size_mb = output_path.stat().st_size / 1024 / 1024
            print(f"File size: {size_mb:.1f} MB")
        except Exception:
            pass
        # Cleanup temp dir
        shutil.rmtree(temp_dir, ignore_errors=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"\nERROR: Conversion failed with exit code {e.returncode}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {e}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Convert paraphrase-MiniLM-L3-v2 to GGUF Q8_0 for MiniRAG embedding",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python3 scripts/convert_embedding_model.py           # Interactive (prompts if exists)
    python3 scripts/convert_embedding_model.py --force  # Overwrite without prompt
        """
    )
    parser.add_argument("--force", action="store_true", help="Overwrite output if it exists")
    args = parser.parse_args()

    print("=" * 70)
    print("MiniRAG Model Conversion Script")
    print("=" * 70)

    success = convert_model(force=args.force)

    if success:
        print("\n" + "=" * 70)
        print("Next steps:")
        print("  1. Verify the .gguf file in internal/ai/minirag/models/")
        print("  2. git add internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf")
        print("  3. git commit -m 'chore(minirag): add embedding model'")
        print("=" * 70)


if __name__ == "__main__":
    main()
