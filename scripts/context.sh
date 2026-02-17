#!/usr/bin/env bash
set -euo pipefail

# context.sh - Shell wrapper for context.mjs
#
# Usage: context.sh [project-dir] [--scope <path>] [--title "<title>"] [--output json|md]
# Gathers: git status, recent commits, diff stat, directory tree, keyword search
#
# Delegates entirely to context.mjs. This wrapper exists for convenience
# in shell-based workflows and hook integrations.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "${SCRIPT_DIR}/context.mjs" "$@"
