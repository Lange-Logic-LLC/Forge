#!/bin/bash
set -euo pipefail

# ============================================================
# Forge Build Platform — Mac Setup Script
# Run this on a fresh Mac to get everything installed and running.
# Usage: bash scripts/setup.sh
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo "=========================================="
echo "  Forge Build Platform — Setup"
echo "=========================================="
echo ""

# ============================================================
# 1. Homebrew
# ============================================================
if ! command -v brew &>/dev/null; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add to PATH for Apple Silicon
    if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    fi
else
    info "Homebrew already installed: $(brew --version | head -1)"
fi

# ============================================================
# 2. Node.js
# ============================================================
if ! command -v node &>/dev/null; then
    info "Installing Node.js..."
    brew install node
else
    info "Node.js already installed: $(node --version)"
fi

# ============================================================
# 3. pnpm
# ============================================================
if ! command -v pnpm &>/dev/null; then
    info "Installing pnpm..."
    npm install -g pnpm
else
    info "pnpm already installed: $(pnpm --version)"
fi

# ============================================================
# 4. Redis
# ============================================================
if ! command -v redis-cli &>/dev/null; then
    info "Installing Redis..."
    brew install redis
fi

if ! redis-cli ping &>/dev/null 2>&1; then
    info "Starting Redis..."
    brew services start redis
    sleep 2
fi

if redis-cli ping &>/dev/null 2>&1; then
    info "Redis is running: $(redis-cli ping)"
else
    error "Redis failed to start. Run: brew services restart redis"
fi

# ============================================================
# 5. Docker Desktop
# ============================================================
if ! command -v docker &>/dev/null; then
    warn "Docker Desktop not found."
    echo "  Download from: https://www.docker.com/products/docker-desktop/"
    echo "  (Free for personal and small business use)"
    echo "  Install it, then re-run this script."
    echo ""
else
    info "Docker found: $(docker --version)"
    if ! docker info &>/dev/null 2>&1; then
        warn "Docker daemon not running. Start Docker Desktop first."
    else
        info "Docker is running."

        # Build the Android builder image
        info "Building Android builder Docker image..."
        docker build -t forge/android-builder:latest docker/android-builder/ || {
            warn "Android Docker image build failed — you can build it later with:"
            echo "  docker build -t forge/android-builder:latest docker/android-builder/"
        }
    fi
fi

# ============================================================
# 6. Xcode
# ============================================================
if ! xcode-select -p &>/dev/null; then
    warn "Xcode Command Line Tools not installed."
    echo "  Run: xcode-select --install"
    echo "  Then: sudo xcodebuild -license accept"
else
    info "Xcode tools found: $(xcode-select -p)"
fi

if command -v xcodebuild &>/dev/null; then
    info "Xcode version: $(xcodebuild -version | head -1)"
else
    warn "xcodebuild not found — install Xcode from the App Store for iOS builds."
fi

# ============================================================
# 7. Cloudflare Tunnel (optional at this stage)
# ============================================================
if ! command -v cloudflared &>/dev/null; then
    info "Installing cloudflared..."
    brew install cloudflare/cloudflare/cloudflared
else
    info "cloudflared already installed: $(cloudflared --version)"
fi

# ============================================================
# 8. Supabase CLI (optional — for local development)
# ============================================================
if ! command -v supabase &>/dev/null; then
    info "Installing Supabase CLI..."
    brew install supabase/tap/supabase
else
    info "Supabase CLI: $(supabase --version)"
fi

# ============================================================
# 9. Install project dependencies
# ============================================================
info "Installing project dependencies..."
pnpm install

# ============================================================
# 10. Generate .env files
# ============================================================
ENCRYPTION_KEY=$(openssl rand -hex 32)

if [ ! -f packages/api/.env ]; then
    info "Creating packages/api/.env..."
    cat > packages/api/.env <<EOF
# Supabase — get these from your Supabase project dashboard
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# Redis (local)
REDIS_URL=redis://localhost:6379

# Encryption key for signing credentials (auto-generated)
CREDENTIAL_ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Stripe (optional — leave blank to run without billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_TEAM_PRICE_ID=

# Email (optional — logs to console if not set)
RESEND_API_KEY=

# Cloudflare service token for workers (optional in dev)
CF_SERVICE_TOKEN_ID=
CF_SERVICE_TOKEN_SECRET=

# Server
PORT=3000
NODE_ENV=development
DASHBOARD_URL=http://localhost:3001
EOF
    warn "Edit packages/api/.env with your Supabase credentials!"
else
    info "packages/api/.env already exists, skipping."
fi

if [ ! -f packages/worker/.env ]; then
    info "Creating packages/worker/.env..."
    cat > packages/worker/.env <<EOF
# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Redis (local)
REDIS_URL=redis://localhost:6379

# Must match the key in api/.env
CREDENTIAL_ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Worker identity
WORKER_ID=mac-local
WORKER_PLATFORM=ios
WORKER_CONCURRENCY=1
BUILD_TMPDIR=/tmp/forge-builds

# Cloudflare service token (optional in dev)
CF_SERVICE_TOKEN_ID=
CF_SERVICE_TOKEN_SECRET=
EOF
    warn "Edit packages/worker/.env with your Supabase credentials!"
else
    info "packages/worker/.env already exists, skipping."
fi

if [ ! -f apps/dashboard/.env.local ]; then
    info "Creating apps/dashboard/.env.local..."
    cat > apps/dashboard/.env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_API_URL=http://localhost:3000

# Stripe (optional)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EOF
    warn "Edit apps/dashboard/.env.local with your Supabase credentials!"
else
    info "apps/dashboard/.env.local already exists, skipping."
fi

# ============================================================
# 11. Build shared package
# ============================================================
info "Building shared package..."
pnpm --filter @forge/shared build

# ============================================================
# Summary
# ============================================================
echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "  1. Create a Supabase project at https://supabase.com"
echo "     (Free tier works for development)"
echo ""
echo "  2. Run the migration in Supabase SQL Editor:"
echo "     Copy supabase/migrations/00001_initial_schema.sql"
echo "     and paste it into the SQL Editor"
echo ""
echo "  3. Update .env files with your Supabase credentials:"
echo "     - packages/api/.env"
echo "     - packages/worker/.env"
echo "     - apps/dashboard/.env.local"
echo ""
echo "  4. Start the services:"
echo "     pnpm dev:api          # API server on :3000"
echo "     pnpm dev:worker       # Build worker"
echo "     pnpm dev:dashboard    # Dashboard on :3001"
echo ""
echo "  5. (Optional) Set up Cloudflare Tunnel:"
echo "     cloudflared tunnel login"
echo "     cloudflared tunnel create forge"
echo ""
echo "  6. (Optional) Set up Stripe for billing"
echo ""
info "Happy building!"
