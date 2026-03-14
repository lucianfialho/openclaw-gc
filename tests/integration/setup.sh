#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=== OpenClaw GC Integration Test (Docker) ==="
echo ""

# Build and run in Docker — nothing touches the host machine
docker build -t openclaw-gc-test -f "$PROJECT_DIR/tests/integration/Dockerfile" "$PROJECT_DIR"
docker run --rm openclaw-gc-test

echo ""
echo "=== Done! Nothing was installed on your machine. ==="
