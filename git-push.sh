#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║    Alpha Ultimate ERP v13 — Git Force Push Script               ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'
log()  { echo -e "${GREEN}✅  $1${RESET}"; }
info() { echo -e "${CYAN}ℹ️   $1${RESET}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║    Alpha Ultimate ERP v13 — Git Force Push           ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# Check for git
command -v git &>/dev/null || { echo "git not found. Install git first."; exit 1; }

# Check if git repo exists
if [ ! -d ".git" ]; then
  info "Initializing git repository..."
  git init
  git checkout -b main 2>/dev/null || git checkout -b master 2>/dev/null || true
  log "Git repo initialized"
fi

# Get or confirm remote URL
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$CURRENT_REMOTE" ]; then
  echo ""
  echo -e "${YELLOW}Enter your GitHub/GitLab repository URL:${RESET}"
  echo -e "  Example: https://github.com/yourusername/alpha-erp.git"
  read -r -p "  > " REPO_URL
  [ -z "$REPO_URL" ] && { echo "Repo URL required!"; exit 1; }
  git remote add origin "$REPO_URL"
  log "Remote 'origin' set to $REPO_URL"
else
  info "Remote: $CURRENT_REMOTE"
  read -r -p "  Change remote URL? (y/N): " CHANGE
  if [[ "$CHANGE" =~ ^[Yy]$ ]]; then
    read -r -p "  New URL: " NEW_URL
    git remote set-url origin "$NEW_URL"
    log "Remote updated to $NEW_URL"
  fi
fi

# Ensure .env is in .gitignore
grep -q "^\.env$" .gitignore 2>/dev/null || echo ".env" >> .gitignore
grep -q "^dist/$" .gitignore 2>/dev/null || echo "dist/" >> .gitignore
grep -q "^node_modules/$" .gitignore 2>/dev/null || echo "node_modules/" >> .gitignore
grep -q "^logs/$" .gitignore 2>/dev/null || echo "logs/" >> .gitignore

# Stage all files
info "Staging all files..."
git add -A

# Check if there's anything to commit
if git diff --cached --quiet 2>/dev/null; then
  info "No changes to commit. Force pushing current HEAD..."
else
  COMMIT_MSG="Alpha Ultimate ERP v13 — $(date '+%Y-%m-%d %H:%M')"
  echo ""
  echo -e "${YELLOW}Commit message (press ENTER for default):${RESET}"
  echo -e "  Default: $COMMIT_MSG"
  read -r -p "  > " CUSTOM_MSG
  COMMIT_MSG="${CUSTOM_MSG:-$COMMIT_MSG}"
  git commit -m "$COMMIT_MSG"
  log "Committed: $COMMIT_MSG"
fi

# Determine branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
info "Pushing to branch: $BRANCH"

echo ""
echo -e "${YELLOW}⚠  Force push will OVERWRITE the remote branch '${BRANCH}'.${RESET}"
read -r -p "  Proceed? (y/N): " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }

# Force push
info "Force pushing..."
git push -u origin "$BRANCH" --force
log "Force push complete! ✓"

echo ""
echo -e "${BOLD}${GREEN}  Repository pushed successfully!${RESET}"
REMOTE_URL=$(git remote get-url origin)
echo -e "  ${CYAN}${REMOTE_URL}${RESET}"
echo ""
