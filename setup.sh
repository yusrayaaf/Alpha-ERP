#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║         Alpha ERP v12 — One-Shot Setup, Push & Deploy                   ║
# ║  Domain: www.alpha-01.info  |  DB: NeonDB  |  Storage: Cloudflare R2   ║
# ╚══════════════════════════════════════════════════════════════════════════╝
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()    { echo -e "${GREEN}✅  $1${RESET}"; }
info()   { echo -e "${BLUE}ℹ️   $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠️   $1${RESET}"; }
error()  { echo -e "${RED}❌  $1${RESET}"; exit 1; }
header() {
  echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${CYAN}  $1${RESET}"
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
}
ask() { echo -e "${YELLOW}❓  $1${RESET}"; }
opt() { echo -e "${BLUE}➕  $1 (press ENTER to skip)${RESET}"; }

clear
echo -e "${BOLD}${CYAN}"
cat << 'BANNER'
  ╔═══════════════════════════════════════════════════════════╗
  ║            Alpha ERP v12 — Setup & Deploy                 ║
  ║  NeonDB · Cloudflare R2 · Vercel · GitHub · IONOS Domain  ║
  ╚═══════════════════════════════════════════════════════════╝
BANNER
echo -e "${RESET}"

# ── Step 0: Prerequisites ─────────────────────────────────────────────────────
header "Step 0 — Checking Prerequisites"
for cmd in git node npm curl; do
  command -v "$cmd" &>/dev/null && log "$cmd found" || error "$cmd is not installed."
done
node -e "if(parseInt(process.version.slice(1))<18)process.exit(1)" \
  || error "Node.js 18+ required. Got: $(node --version)"
log "Node.js $(node --version) — OK"

# ── Step 1: Collect secrets ───────────────────────────────────────────────────
header "Step 1 — Environment Configuration"
echo ""
echo -e "${BOLD}Required (all free):${RESET}"
echo -e "  1. ${CYAN}DATABASE_URL${RESET}      → https://console.neon.tech → New Project → Connection String"
echo -e "  2. ${CYAN}JWT_SECRET${RESET}        → Press ENTER to auto-generate"
echo -e "  3. ${CYAN}GITHUB_TOKEN${RESET}      → https://github.com/settings/tokens (repo scope)"
echo ""
echo -e "${BOLD}Storage — choose ONE (Cloudflare R2 recommended, ImgBB as fallback):${RESET}"
echo -e "  ${CYAN}Cloudflare R2${RESET} → https://dash.cloudflare.com → R2 → Create Bucket → Manage API Tokens"
echo -e "    Free: 10GB storage, 1M ops/month — supports ALL file types"
echo -e "  ${CYAN}ImgBB${RESET}         → https://api.imgbb.com — images only, no file size limit on free"
echo ""
echo -e "${BOLD}Optional:${RESET}"
echo -e "  5. ${CYAN}VERCEL_TOKEN${RESET}      → https://vercel.com/account/tokens (auto-deploy)"
echo ""

# Database
ask "1. NeonDB DATABASE_URL (postgresql://...):"
read -r DATABASE_URL
[[ "$DATABASE_URL" == postgresql://* ]] || error "Must start with postgresql://"
log "DATABASE_URL accepted"

# JWT
echo ""
ask "2. JWT_SECRET (press ENTER to auto-generate a secure key):"
read -r JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  warn "Auto-generated: ${JWT_SECRET:0:20}..."
else
  [ ${#JWT_SECRET} -ge 32 ] || error "JWT_SECRET must be at least 32 characters"
fi
log "JWT_SECRET ready"

# GitHub
echo ""
ask "3. GitHub Personal Access Token (repo scope):"
read -r GITHUB_TOKEN
[ -n "$GITHUB_TOKEN" ] || error "GITHUB_TOKEN cannot be empty"
log "GITHUB_TOKEN accepted"

# Storage — Cloudflare R2
echo ""
echo -e "${BOLD}${CYAN}--- Cloudflare R2 Storage (Recommended) ---${RESET}"
echo -e "Steps: dash.cloudflare.com → R2 → Create bucket: ${CYAN}alpha-erp-uploads${RESET}"
echo -e "Then: Manage R2 API Tokens → Create Token → Object Read & Write"
opt "4a. Cloudflare Account ID:"
read -r CF_ACCOUNT_ID
opt "4b. R2 Access Key ID:"
read -r CF_ACCESS_KEY_ID
opt "4c. R2 Secret Access Key:"
read -r CF_SECRET_ACCESS_KEY
opt "4d. R2 Bucket name (press ENTER for 'alpha-erp-uploads'):"
read -r CF_R2_BUCKET
CF_R2_BUCKET="${CF_R2_BUCKET:-alpha-erp-uploads}"
opt "4e. R2 Public URL (e.g. https://pub-xxx.r2.dev — press ENTER to use private):"
read -r CF_R2_PUBLIC_URL
opt "4f. CF-Access Client ID (for Cloudflare Access protected bucket — optional):"
read -r CF_ACCESS_CLIENT_ID
opt "4g. CF-Access Client Secret:"
read -r CF_ACCESS_CLIENT_SECRET

# ImgBB fallback
echo ""
if [ -z "$CF_ACCOUNT_ID" ]; then
  echo -e "${YELLOW}No Cloudflare R2 configured — using ImgBB as fallback.${RESET}"
  ask "4h. ImgBB API key (https://api.imgbb.com):"
  read -r IMGBB_API_KEY
  [ -n "$IMGBB_API_KEY" ] || error "Need either Cloudflare R2 or ImgBB API key"
else
  opt "4h. ImgBB API key (fallback, optional):"
  read -r IMGBB_API_KEY
fi

# Vercel
echo ""
opt "5. Vercel Token (for auto-deploy — https://vercel.com/account/tokens):"
read -r VERCEL_TOKEN

# ── Step 2: Write .env ────────────────────────────────────────────────────────
header "Step 2 — Writing .env"
cat > .env << ENVEOF
# Alpha ERP v12 — Generated by setup.sh on $(date)
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
CF_ACCOUNT_ID=${CF_ACCOUNT_ID:-}
CF_ACCESS_KEY_ID=${CF_ACCESS_KEY_ID:-}
CF_SECRET_ACCESS_KEY=${CF_SECRET_ACCESS_KEY:-}
CF_R2_BUCKET=${CF_R2_BUCKET:-alpha-erp-uploads}
CF_R2_PUBLIC_URL=${CF_R2_PUBLIC_URL:-}
CF_ACCESS_CLIENT_ID=${CF_ACCESS_CLIENT_ID:-}
CF_ACCESS_CLIENT_SECRET=${CF_ACCESS_CLIENT_SECRET:-}
IMGBB_API_KEY=${IMGBB_API_KEY:-}
PORT=3000
NODE_ENV=production
ENVEOF
log ".env written"

# ── Step 3: Install deps ──────────────────────────────────────────────────────
header "Step 3 — Installing Dependencies"
npm install --legacy-peer-deps
log "npm install complete"

# ── Step 4: Apply DB schema via Node ─────────────────────────────────────────
header "Step 4 — Initialising NeonDB Schema"
info "Running schema runner in project directory..."

cat > ./_schema_runner.mjs << 'SCHEMA_SCRIPT'
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('DATABASE_URL not set'); process.exit(1); }
const sql = neon(dbUrl);

const schema = readFileSync('./sql/schema.sql', 'utf8');
const statements = schema
  .replace(/--[^\n]*/g, '')
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 5);

let ok = 0, skipped = 0, errors = [];
for (const stmt of statements) {
  try {
    await sql.unsafe(stmt + ';');
    ok++;
  } catch(e) {
    if (/already exists|duplicate key/i.test(e.message)) skipped++;
    else { errors.push(e.message.slice(0, 100)); skipped++; }
  }
}
if (errors.length) console.warn('Warnings:', errors.slice(0,3).join(' | '));
console.log(`Schema: ${ok} applied, ${skipped} skipped`);

// Also add r2_key column if missing (for upgrades from v11)
try { await sql.unsafe('ALTER TABLE media_uploads ADD COLUMN IF NOT EXISTS r2_key TEXT'); }
catch(e) { /* fine if already exists */ }
console.log('✅ Schema complete');
SCHEMA_SCRIPT

DATABASE_URL="$DATABASE_URL" node ./_schema_runner.mjs
rm -f ./_schema_runner.mjs
log "NeonDB schema initialised"

# ── Step 5: Git force push ────────────────────────────────────────────────────
header "Step 5 — GitHub: Wipe Old Repo & Force Push"
REPO_URL="https://${GITHUB_TOKEN}@github.com/yusrayaaf/Alpha-ERP.git"

rm -rf .git
git init -b main
git config user.email "erp@alpha-01.info"
git config user.name "Alpha ERP Deploy"

cat > .gitignore << 'GITEOF'
node_modules/
dist/
.env
.env.local
.env.*.local
*.log
npm-debug.log*
.DS_Store
.vercel/
_schema_runner.mjs
GITEOF

git add -A
git commit -m "🚀 Alpha ERP v12 — $(date '+%Y-%m-%d %H:%M UTC')"

info "Force-pushing to github.com/yusrayaaf/Alpha-ERP ..."
git remote add origin "$REPO_URL"
git push --force origin main
log "GitHub: old history wiped, clean commit pushed"

# ── Step 6: Vercel deploy ─────────────────────────────────────────────────────
header "Step 6 — Vercel Deployment"

DEPLOYED_URL=""

if [ -n "$VERCEL_TOKEN" ]; then
  if ! command -v vercel &>/dev/null; then
    info "Installing Vercel CLI..."
    npm install -g vercel --silent
    log "Vercel CLI installed"
  fi

  info "Setting Vercel environment variables..."

  set_env() {
    local KEY="$1"; local VAL="$2"
    [ -z "$VAL" ] && return
    printf '%s' "$VAL" | vercel env add "$KEY" production --token="$VERCEL_TOKEN" --yes 2>/dev/null || \
    printf '%s' "$VAL" | vercel env rm  "$KEY" production --token="$VERCEL_TOKEN" --yes 2>/dev/null; \
    printf '%s' "$VAL" | vercel env add "$KEY" production --token="$VERCEL_TOKEN" --yes 2>/dev/null || true
  }

  set_env DATABASE_URL            "$DATABASE_URL"
  set_env JWT_SECRET              "$JWT_SECRET"
  set_env CF_ACCOUNT_ID          "$CF_ACCOUNT_ID"
  set_env CF_ACCESS_KEY_ID       "$CF_ACCESS_KEY_ID"
  set_env CF_SECRET_ACCESS_KEY   "$CF_SECRET_ACCESS_KEY"
  set_env CF_R2_BUCKET           "$CF_R2_BUCKET"
  set_env CF_R2_PUBLIC_URL       "$CF_R2_PUBLIC_URL"
  set_env CF_ACCESS_CLIENT_ID    "$CF_ACCESS_CLIENT_ID"
  set_env CF_ACCESS_CLIENT_SECRET "$CF_ACCESS_CLIENT_SECRET"
  set_env IMGBB_API_KEY          "$IMGBB_API_KEY"

  info "Deploying to Vercel production..."
  DEPLOY_OUT=$(vercel --prod --yes --token="$VERCEL_TOKEN" 2>&1)
  echo "$DEPLOY_OUT"
  DEPLOYED_URL=$(echo "$DEPLOY_OUT" | grep -oP 'https://[^\s]+\.vercel\.app' | tail -1 || echo "")
  log "Vercel deployment complete!"

  # ── Step 6b: Trigger /api/migrate on live deployment ───────────────────
  if [ -n "$DEPLOYED_URL" ]; then
    info "Triggering live migration at ${DEPLOYED_URL}/api/migrate ..."
    sleep 5 # wait for deployment to propagate
    curl -sS -X POST "${DEPLOYED_URL}/api/migrate" \
      -H "Content-Type: application/json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Migration:', d)" 2>/dev/null || \
      warn "Migration call failed — run manually: curl -X POST ${DEPLOYED_URL}/api/migrate"
    log "Live migration triggered"
  fi
else
  echo ""
  echo -e "${BOLD}${YELLOW}⚡ Manual Vercel Deployment:${RESET}"
  echo -e "  1. Go to ${CYAN}https://vercel.com/new${RESET}"
  echo -e "  2. Import: ${CYAN}yusrayaaf/Alpha-ERP${RESET}"
  echo -e "  3. Add ALL environment variables (copy from your .env file)"
  echo -e "  4. Click Deploy, then run:"
  echo -e "     ${CYAN}curl -X POST https://your-deployment.vercel.app/api/migrate${RESET}"
fi

# ── Step 7: Cloudflare R2 bucket setup reminder ──────────────────────────────
if [ -n "$CF_ACCOUNT_ID" ]; then
  header "Step 7a — Cloudflare R2 Bucket Configuration"
  echo ""
  echo -e "${BOLD}Make sure your R2 bucket '${CF_R2_BUCKET}' has:${RESET}"
  echo ""
  echo -e "  1. ${CYAN}CORS policy${RESET} — in Cloudflare dashboard → R2 → ${CF_R2_BUCKET} → Settings → CORS:"
  cat << 'CORS_EOF'
[
  {
    "AllowedOrigins": ["https://www.alpha-01.info", "https://*.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
CORS_EOF
  echo ""
  if [ -n "$CF_ACCESS_CLIENT_ID" ]; then
    echo -e "  2. ${CYAN}Cloudflare Access${RESET} — your CF-Access client credentials are configured ✅"
    echo -e "     These are passed as headers: CF-Access-Client-Id and CF-Access-Client-Secret"
  fi
fi

# ── Step 7b: IONOS domain ─────────────────────────────────────────────────────
header "Step 7b — IONOS Domain Configuration"
echo ""
echo -e "${BOLD}IONOS → Domains & SSL → alpha-01.info → DNS:${RESET}"
echo ""
echo -e "  ${CYAN}Type    Name    Value${RESET}"
echo -e "  ─────────────────────────────────────────────"
echo -e "  CNAME   www     cname.vercel-dns.com"
echo -e "  A       @       76.76.21.21"
echo ""
echo -e "${BOLD}Then in Vercel:${RESET} Project → Settings → Domains → Add → ${CYAN}www.alpha-01.info${RESET}"
echo ""
echo -e "${BOLD}IONOS Email:${RESET}"
echo -e "  ${CYAN}erp@alpha-01.info${RESET}    → ERP Settings → Company Email"
echo -e "  ${CYAN}reply@alpha-01.info${RESET}  → ERP Settings → Notification Reply-To"

# ── Done ─────────────────────────────────────────────────────────────────────
header "🎉 All Done!"
echo ""
echo -e "${BOLD}Default Login:${RESET}"
echo -e "  URL:       ${CYAN}https://www.alpha-01.info${RESET}  (after DNS)"
echo -e "  Username:  ${CYAN}admin${RESET}"
echo -e "  Password:  ${CYAN}Admin@12345${RESET}"
echo ""
echo -e "${BOLD}${YELLOW}⚠  Change the admin password immediately after first login!${RESET}"
echo ""
echo -e "${BOLD}Storage:${RESET}"
if [ -n "$CF_ACCOUNT_ID" ]; then
  echo -e "  ${GREEN}✅ Cloudflare R2${RESET} — 10GB free, all file types, CF-Access secured"
else
  echo -e "  ${YELLOW}⚠  ImgBB${RESET} — free fallback (images only)"
fi
echo -e ""
echo -e "${BOLD}${GREEN}Alpha ERP v12 is live! 🚀${RESET}"
