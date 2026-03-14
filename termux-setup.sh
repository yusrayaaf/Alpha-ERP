#!/data/data/com.termux/files/usr/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║          Alpha Ultimate ERP v13 — Universal Setup Script                    ║
# ║  Works on: Termux (Android) | Ubuntu/Debian VPS | Any Linux                ║
# ║  Stack: Node.js + NeonDB PostgreSQL + Cloudflare R2 / ImgBB                ║
# ║  Default login after setup: admin / Admin@12345                             ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()    { echo -e "${GREEN}✅  $1${RESET}"; }
info()   { echo -e "${BLUE}ℹ️   $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠️   $1${RESET}"; }
error()  { echo -e "${RED}❌  $1${RESET}"; exit 1; }
header() { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════${RESET}\n${BOLD}${CYAN}  $1${RESET}\n${BOLD}${CYAN}══════════════════════════════════════════════${RESET}"; }

clear
echo -e "${BOLD}${CYAN}"
echo "  ╔═════════════════════════════════════════════════════════════╗"
echo "  ║       Alpha Ultimate ERP v13 — Setup Script                ║"
echo "  ║  Finance · HR · CRM · Projects · Assets · Analytics        ║"
echo "  ╚═════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  ${BLUE}Default login after setup: ${BOLD}admin / Admin@12345${RESET}\n"

IS_TERMUX=false
[ -d "/data/data/com.termux" ] || [ -n "${TERMUX_VERSION:-}" ] && IS_TERMUX=true
IS_ROOT=false
[ "$(id -u)" = "0" ] && IS_ROOT=true
[ "$IS_TERMUX" = true ] && info "Environment: Termux (Android)" || info "Environment: Linux / VPS"

# ── Step 0: System Dependencies ───────────────────────────────────────────────
header "Step 0 — System Dependencies"

if [ "$IS_TERMUX" = true ]; then
  info "Updating Termux packages..."
  pkg update -y 2>/dev/null || warn "pkg update had warnings (continuing)"
  for p in nodejs git curl unzip; do
    command -v "$p" &>/dev/null && log "$p already installed" || { pkg install -y "$p" 2>/dev/null && log "$p installed" || warn "Could not install $p"; }
  done
  NODE_VER=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
  [ "$NODE_VER" -lt 18 ] && { warn "Upgrading Node.js..."; pkg install -y nodejs-lts 2>/dev/null || warn "Could not upgrade"; }
elif command -v apt-get &>/dev/null; then
  command -v curl &>/dev/null || { [ "$IS_ROOT" = true ] && apt-get install -y curl || sudo apt-get install -y curl; }
  if ! command -v node &>/dev/null || [ "$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)" -lt 18 ]; then
    info "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | { [ "$IS_ROOT" = true ] && bash - || sudo bash -; } 2>/dev/null || true
    { [ "$IS_ROOT" = true ] && apt-get install -y nodejs || sudo apt-get install -y nodejs; }
  fi
fi

command -v node &>/dev/null || error "Node.js not found. Install Node.js 18+ from https://nodejs.org"
NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
[ "$NODE_VER" -ge 18 ] || error "Node.js 18+ required. Got: $(node --version)"
log "Node.js $(node --version) ✓"
log "npm $(npm --version) ✓"

# ── Step 1: Project check ─────────────────────────────────────────────────────
header "Step 1 — Project Verification"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
[ -f "package.json" ] || error "Run this script from inside the alpha-ultimate-erp-v13 folder"
[ -f "server.js"    ] || error "server.js not found"
[ -f "api/index.js" ] || error "api/index.js not found"
mkdir -p logs
log "Project structure verified ✓"

# ── Step 2: Configuration ─────────────────────────────────────────────────────
header "Step 2 — Configuration"

SKIP_ENV=false
if [ -f ".env" ]; then
  warn ".env already exists."
  read -r -p "  Reconfigure? (y/N): " RECONFIG
  [[ "$RECONFIG" =~ ^[Yy]$ ]] || SKIP_ENV=true
fi

if [ "$SKIP_ENV" = false ]; then
  echo ""
  echo -e "${BOLD}NeonDB PostgreSQL (FREE):${RESET}"
  echo -e "  Get at: ${CYAN}https://console.neon.tech${RESET} → New Project → Connection String"
  echo ""
  read -r -p "  DATABASE_URL (postgresql://...): " DATABASE_URL
  [ -z "$DATABASE_URL" ] && error "DATABASE_URL is required!"
  [[ "$DATABASE_URL" =~ ^postgresql:// ]] || error "Must start with postgresql://"

  echo ""
  echo -e "${BOLD}JWT Secret:${RESET} (press ENTER to auto-generate)"
  read -r -p "  > " JWT_INPUT
  DEFAULT_JWT=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null || echo "alpha-erp-$(date +%s)-secret")
  JWT_SECRET="${JWT_INPUT:-$DEFAULT_JWT}"

  echo ""
  echo -e "${BOLD}File Storage:${RESET}"
  echo -e "  A) Cloudflare R2 — 10GB free (recommended)"
  echo -e "  B) ImgBB — free images"
  echo -e "  C) Skip (uploads disabled)"
  read -r -p "  Choice [A/B/C]: " STOR
  CF_ACCOUNT_ID=""; CF_ACCESS_KEY_ID=""; CF_SECRET_ACCESS_KEY=""; CF_R2_BUCKET=""; CF_R2_PUBLIC_URL=""; IMGBB_API_KEY=""

  case "${STOR^^}" in
    A)
      read -r -p "  CF Account ID: "          CF_ACCOUNT_ID
      read -r -p "  R2 Access Key ID: "       CF_ACCESS_KEY_ID
      read -r -p "  R2 Secret Access Key: "   CF_SECRET_ACCESS_KEY
      read -r -p "  R2 Bucket Name: "         CF_R2_BUCKET
      read -r -p "  R2 Public URL: "          CF_R2_PUBLIC_URL
      log "Cloudflare R2 configured";;
    B)
      read -r -p "  ImgBB API Key: " IMGBB_API_KEY
      log "ImgBB configured";;
    *)
      warn "No storage — uploads disabled";;
  esac

  read -r -p "  Port [default 3000]: " PORT_INPUT
  APP_PORT="${PORT_INPUT:-3000}"

  cat > .env << ENVEOF
# Alpha Ultimate ERP v13
# Generated: $(date)
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
PORT=${APP_PORT}
NODE_ENV=production
CF_ACCOUNT_ID=${CF_ACCOUNT_ID}
CF_ACCESS_KEY_ID=${CF_ACCESS_KEY_ID}
CF_SECRET_ACCESS_KEY=${CF_SECRET_ACCESS_KEY}
CF_R2_BUCKET=${CF_R2_BUCKET}
CF_R2_PUBLIC_URL=${CF_R2_PUBLIC_URL}
IMGBB_API_KEY=${IMGBB_API_KEY}
ENVEOF
  log ".env created ✓"
fi

set -o allexport; source .env 2>/dev/null || true; set +o allexport
APP_PORT="${PORT:-3000}"

# ── Step 3: Install dependencies ──────────────────────────────────────────────
header "Step 3 — Installing npm Dependencies"
info "Running npm install (takes 2-5 minutes)..."
[ "$IS_TERMUX" = true ] && NPM_FLAGS="--prefer-offline --no-audit --no-fund" || NPM_FLAGS="--no-audit --no-fund"
npm install $NPM_FLAGS || error "npm install failed"
log "Dependencies installed ✓"

# ── Step 4: Build frontend ────────────────────────────────────────────────────
header "Step 4 — Building Frontend"
info "Building React/Vite production bundle..."
[ "$IS_TERMUX" = true ] && NODE_OPTIONS="--max-old-space-size=1024" npm run build || npm run build
[ -f "dist/index.html" ] || error "Build failed — dist/index.html not found"
log "Frontend built ✓  ($(du -sh dist/ 2>/dev/null | cut -f1))"

# ── Step 5: Database test ─────────────────────────────────────────────────────
header "Step 5 — Database Connection Test"
info "Testing NeonDB connection..."
if node --input-type=module << 'DBTEST'
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const [r] = await sql`SELECT NOW()::text AS t, current_database() AS db`;
console.log('  DB:', r.db, '| Time:', r.t);
DBTEST
then
  log "Database connected ✓"
  info "Schema migrations run automatically on first server start"
else
  warn "DB test failed — check DATABASE_URL in .env"
  warn "Server will retry on startup"
fi

# ── Step 6: Start server ──────────────────────────────────────────────────────
header "Step 6 — Starting Server"
pkill -f "node server.js" 2>/dev/null || true; sleep 1
nohup node server.js > logs/server.log 2>&1 &
echo $! > logs/server.pid
info "Server PID: $(cat logs/server.pid)"
info "Waiting for server to be ready..."
READY=false
for i in {1..20}; do
  sleep 1
  curl -sf "http://localhost:${APP_PORT}/health" > /dev/null 2>&1 && { READY=true; break; }
  printf "."
done
echo ""
[ "$READY" = true ] && log "Server is running! ✓" || warn "Server starting... check: tail -f logs/server.log"

# ── Success ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}"
echo "  ╔═════════════════════════════════════════════════════════════╗"
echo "  ║                ✅  SETUP COMPLETE!                         ║"
echo "  ╚═════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  ${BOLD}URL:${RESET}           ${CYAN}http://localhost:${APP_PORT}${RESET}"
echo -e "  ${BOLD}Username:${RESET}      ${GREEN}admin${RESET}"
echo -e "  ${BOLD}Password:${RESET}      ${GREEN}Admin@12345${RESET}"
echo ""
echo -e "  ${BOLD}ERP Modules:${RESET}"
echo "    💰 Finance (Expenses, Invoices, Wallet, Budget)"
echo "    🏗️  Assets (Assets, Investments, Liabilities)"
echo "    👷 HR (Workers, Salary, Timesheet, Attendance)"
echo "    🏢 CRM (Customers, Leads with Kanban pipeline)"
echo "    📁 Projects & Tasks (Kanban board)"
echo "    📋 Reports, Audit Log, Notifications"
echo "    🔐 Users, Roles, Permissions Matrix"
echo ""
echo -e "  ${BOLD}Management:${RESET}"
echo -e "    ${CYAN}npm run start:bg${RESET}  — Start in background"
echo -e "    ${CYAN}npm run stop${RESET}      — Stop server"
echo -e "    ${CYAN}npm run restart${RESET}   — Restart server"
echo -e "    ${CYAN}npm run logs${RESET}      — View live logs"
echo ""
echo -e "  ${BOLD}Health check:${RESET} ${CYAN}curl http://localhost:${APP_PORT}/health${RESET}"
echo ""
echo -e "  ${BOLD}${YELLOW}── Git Force Push ──────────────────────────────────────────${RESET}"
echo "  Run: bash git-push.sh"
echo ""
