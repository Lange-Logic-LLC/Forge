#!/bin/bash
set -euo pipefail

# ============================================================
# Start all Forge services for development
# Usage: bash scripts/dev.sh
# ============================================================

GREEN='\033[0;32m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Check Redis
if ! redis-cli ping &>/dev/null 2>&1; then
    info "Starting Redis..."
    brew services start redis
    sleep 1
fi

info "Redis: $(redis-cli ping)"

# Build shared package if needed
if [ ! -d "packages/shared/dist" ]; then
    info "Building shared package..."
    pnpm --filter @forge/shared build
fi

info "Starting API server, worker, and dashboard..."
echo ""
echo "  API:       http://localhost:3000"
echo "  Dashboard: http://localhost:3001"
echo "  Worker:    Running in background"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# Run all three in parallel
pnpm dev
