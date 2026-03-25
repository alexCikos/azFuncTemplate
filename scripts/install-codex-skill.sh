#!/usr/bin/env bash

set -euo pipefail

CODEX_SKILLS_DIR="${CODEX_HOME:-$HOME/.codex}/skills"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)/skills/azure-function-template-setup"
TARGET_DIR="${CODEX_SKILLS_DIR}/azure-function-template-setup"

mkdir -p "$CODEX_SKILLS_DIR"
rm -rf "$TARGET_DIR"
cp -R "$SOURCE_DIR" "$TARGET_DIR"

echo "Installed skill to: $TARGET_DIR"
