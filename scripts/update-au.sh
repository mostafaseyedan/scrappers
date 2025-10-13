#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="$ROOT_DIR/vendor"
AU_DIR="$ROOT_DIR/../au"

mkdir -p "$VENDOR_DIR"

# Build au library dist
pnpm -C "$AU_DIR" run build:lib

# Pack au and place the tarball into recon/vendor
pnpm -C "$AU_DIR" pack --pack-destination "$VENDOR_DIR"

# Rename to a stable filename
LATEST_TGZ="$(ls -t "$VENDOR_DIR"/au-*.tgz | head -n1)"
mv "$LATEST_TGZ" "$VENDOR_DIR/au.tgz"

echo "Updated $VENDOR_DIR/au.tgz"
