#!/usr/bin/env bash
# Miii installer (OpenClaw-style): clone or update repo, install deps, register global `miii`.
#
#   curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/OWNER/REPO/main/scripts/install.sh | bash
#
# Override defaults:
#   MIII_REPO_URL   Git clone URL (default: https://github.com/maruakshay/miii.git)
#   MIII_HOME       Base dir (default: ~/.miii)
#   MIII_BRANCH     Git branch (default: main)
#
set -euo pipefail

MIII_REPO_URL="${MIII_REPO_URL:-https://github.com/maruakshay/miii.git}"
MIII_HOME="${MIII_HOME:-$HOME/.miii}"
MIII_BRANCH="${MIII_BRANCH:-main}"
CHECKOUT="${MIII_HOME}/checkout"

DRY_RUN=0

usage() {
  cat <<'EOF'
Miii install

  curl -fsSL --proto '=https' --tlsv1.2 <install.sh URL> | bash

Options (pass to bash):
  --dry-run     Print actions without running install commands
  -h, --help    Show this help

Environment:
  MIII_REPO_URL   Git remote (default: see script)
  MIII_HOME       Install under this directory (default: ~/.miii)
  MIII_BRANCH     Branch to checkout (default: main)
EOF
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -n "${NO_COLOR:-}" ]]; then
  BOLD='' DIM='' OK='' ERR='' NC=''
else
  BOLD='\033[1m'
  DIM='\033[2m'
  OK='\033[0;32m'
  ERR='\033[0;31m'
  NC='\033[0m'
fi

log() { printf '%b\n' "${OK}▸${NC} $*"; }
warn() { printf '%b\n' "${DIM}!${NC} $*" >&2; }
die() { printf '%b\n' "${ERR}error:${NC} $*" >&2; exit 1; }

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '%s\n' "+ $*"
    return 0
  fi
  "$@"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

need_cmd git

if command -v node >/dev/null 2>&1; then
  major="$(node -p "parseInt(process.versions.node.split('.')[0],10)")"
  [[ "$major" -ge 20 ]] || die "Node.js 20+ required (found $(node -v))"
else
  die "Node.js 20+ required — install from https://nodejs.org or use your version manager"
fi

need_cmd npm

mkdir -p "$MIII_HOME"

if [[ -d "$CHECKOUT/.git" ]]; then
  log "Updating existing checkout: $CHECKOUT"
  run git -C "$CHECKOUT" fetch origin
  run git -C "$CHECKOUT" checkout "$MIII_BRANCH"
  run git -C "$CHECKOUT" pull --ff-only origin "$MIII_BRANCH"
else
  if [[ -e "$CHECKOUT" ]]; then
    die "Path exists but is not a git repo: $CHECKOUT — move it away or set MIII_HOME"
  fi
  log "Cloning $MIII_REPO_URL (branch $MIII_BRANCH) → $CHECKOUT"
  run git clone --branch "$MIII_BRANCH" --depth 1 "$MIII_REPO_URL" "$CHECKOUT"
fi

if [[ "$DRY_RUN" -eq 1 ]] && [[ ! -f "$CHECKOUT/package.json" ]]; then
  printf '+ (cd %q && npm install)\n' "$CHECKOUT"
  printf '+ (cd %q && npm install -g .)\n' "$CHECKOUT"
  printf '\n%s\n' "Dry run: clone was not executed — paths above are what a full install would run after a successful clone."
  exit 0
fi

[[ -f "$CHECKOUT/package.json" ]] || die "No package.json in $CHECKOUT — wrong repo?"

log "Installing npm dependencies"
if [[ "$DRY_RUN" -eq 1 ]]; then
  printf '+ (cd %q && npm install)\n' "$CHECKOUT"
else
  ( cd "$CHECKOUT" && npm install )
fi

log "Linking global command: miii"
if [[ "$DRY_RUN" -eq 1 ]]; then
  printf '+ (cd %q && npm install -g .)\n' "$CHECKOUT"
else
  ( cd "$CHECKOUT" && npm install -g . )
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  if command -v miii >/dev/null 2>&1; then
    printf '\n%b\n' "${BOLD}Done.${NC} Try: ${BOLD}miii help${NC} · ${BOLD}miii web${NC} · ${BOLD}miii tui${NC}"
  else
    warn "miii not found on PATH. Add npm’s global bin to PATH, then open a new terminal:"
    prefix="$(npm config get prefix)"
    printf '  export PATH=%q/bin:$PATH\n' "$prefix"
  fi
fi
