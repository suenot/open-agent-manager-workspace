#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────
# release.sh — Bump version, tag, push, wait for CI, publish
# ──────────────────────────────────────────────────────────────
# Usage:
#   ./scripts/release.sh patch          # 0.1.0 -> 0.1.1
#   ./scripts/release.sh minor          # 0.1.0 -> 0.2.0
#   ./scripts/release.sh major          # 0.1.0 -> 1.0.0
#   ./scripts/release.sh 1.2.3          # explicit version
#   ./scripts/release.sh patch --push   # also push + wait for CI + publish
# ──────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION_FILE="$ROOT_DIR/version"
TAURI_CONF="$ROOT_DIR/app/src-tauri/tauri.conf.json"
CARGO_TOML="$ROOT_DIR/app/src-tauri/Cargo.toml"
APP_PKG="$ROOT_DIR/app/package.json"
WEBSITE_PKG="$ROOT_DIR/website/package.json"
CHANGELOG="$ROOT_DIR/docs/changelog/CHANGELOG.md"

# ── Helpers ───────────────────────────────────────────────────

die() { echo "ERROR: $*" >&2; exit 1; }

current_version() {
  cat "$VERSION_FILE" | tr -d '[:space:]'
}

bump_version() {
  local cur="$1" type="$2"
  local major minor patch
  IFS='.' read -r major minor patch <<< "$cur"

  case "$type" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "${major}.$((minor + 1)).0" ;;
    patch) echo "${major}.${minor}.$((patch + 1))" ;;
    *)     die "Invalid bump type: $type (use major, minor, or patch)" ;;
  esac
}

is_semver() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

update_json_version() {
  local file="$1" version="$2"
  if [ ! -f "$file" ]; then
    echo "  SKIP $file (not found)"
    return
  fi
  # Use node for reliable JSON editing
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$file', 'utf8'));
    pkg.version = '$version';
    fs.writeFileSync('$file', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "  UPDATED $file"
}

update_cargo_version() {
  local file="$1" version="$2"
  if [ ! -f "$file" ]; then
    echo "  SKIP $file (not found)"
    return
  fi
  # Replace the version line under [package] section
  sed -i.bak -E "s/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"/version = \"$version\"/" "$file"
  rm -f "${file}.bak"
  echo "  UPDATED $file"
}

generate_changelog() {
  local version="$1"
  local date_str
  date_str=$(date +%Y-%m-%d)

  # Determine the last tag to diff against
  local last_tag
  last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

  # Collect commit messages since last tag (or all commits if no tag)
  local commits
  if [ -n "$last_tag" ]; then
    commits=$(git log --oneline "${last_tag}..HEAD" --no-decorate 2>/dev/null || echo "")
  else
    commits=$(git log --oneline --no-decorate 2>/dev/null || echo "")
  fi

  if [ -z "$commits" ]; then
    commits="No changes recorded"
  fi

  # Format commits as markdown list (strip short hash prefix)
  local formatted
  formatted=$(echo "$commits" | sed 's/^[0-9a-f]* /- /')

  # Build the new changelog section
  local section
  section="## v${version} (${date_str})

${formatted}
"

  # Ensure docs/changelog directory exists
  mkdir -p "$(dirname "$CHANGELOG")"

  # Prepend to CHANGELOG.md (keep header, insert new section after it)
  if [ -f "$CHANGELOG" ]; then
    # Find the first ## line and insert before it; if none, append after header
    local header body
    header=$(sed '/^## /,$d' "$CHANGELOG")
    body=$(sed -n '/^## /,$p' "$CHANGELOG")
    printf '%s\n\n%s\n\n%s\n' "$header" "$section" "$body" > "$CHANGELOG"
  else
    printf '# Changelog\n\nAll notable changes to Open Agent Manager will be documented in this file.\nThis changelog is automatically generated during the release process.\n\n%s\n' "$section" > "$CHANGELOG"
  fi

  echo "  UPDATED $CHANGELOG"

  # Also write the section to a temp file for use as release notes
  RELEASE_NOTES_FILE=$(mktemp)
  printf '%s\n' "$formatted" > "$RELEASE_NOTES_FILE"
  export RELEASE_NOTES_FILE
}

# ── Parse args ────────────────────────────────────────────────

BUMP_OR_VERSION="${1:-}"
DO_PUSH=false

if [ -z "$BUMP_OR_VERSION" ]; then
  echo "Usage: $0 <patch|minor|major|X.Y.Z> [--push]"
  echo ""
  echo "Options:"
  echo "  patch|minor|major   Bump type"
  echo "  X.Y.Z               Explicit version"
  echo "  --push              Push tag and wait for CI to build, then publish release"
  exit 1
fi

shift
for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=true ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

# ── Compute new version ──────────────────────────────────────

CURRENT=$(current_version)
echo "Current version: $CURRENT"

if is_semver "$BUMP_OR_VERSION"; then
  NEW_VERSION="$BUMP_OR_VERSION"
else
  NEW_VERSION=$(bump_version "$CURRENT" "$BUMP_OR_VERSION")
fi

echo "New version:     $NEW_VERSION"
echo ""

# ── Update all version files ─────────────────────────────────

echo "Updating version files..."

echo "$NEW_VERSION" > "$VERSION_FILE"
echo "  UPDATED $VERSION_FILE"

update_json_version "$TAURI_CONF" "$NEW_VERSION"
update_json_version "$APP_PKG" "$NEW_VERSION"
update_json_version "$WEBSITE_PKG" "$NEW_VERSION"
update_cargo_version "$CARGO_TOML" "$NEW_VERSION"

echo ""

# ── Generate changelog ────────────────────────────────────────

echo "Generating changelog..."

cd "$ROOT_DIR"
generate_changelog "$NEW_VERSION"

echo ""

# ── Git commit and tag ────────────────────────────────────────

echo "Creating git commit and tag..."

git add version app/src-tauri/tauri.conf.json app/src-tauri/Cargo.toml app/package.json website/package.json 2>/dev/null || true
git add docs/changelog/CHANGELOG.md 2>/dev/null || true
git commit -m "release: v${NEW_VERSION}"
git tag "v${NEW_VERSION}"

echo ""
echo "Created commit and tag v${NEW_VERSION}"

# ── Push and wait for CI ──────────────────────────────────────

if [ "$DO_PUSH" = true ]; then
  echo ""
  echo "Pushing to remote..."
  git push
  git push origin "v${NEW_VERSION}"

  echo ""
  echo "Tag v${NEW_VERSION} pushed. Waiting for GitHub Actions build..."
  echo ""

  # Check that gh CLI is available
  if ! command -v gh &> /dev/null; then
    die "GitHub CLI (gh) is required for --push. Install it: https://cli.github.com/"
  fi

  # Wait for the workflow run to appear (may take a few seconds)
  echo "Waiting for workflow run to start..."
  ELAPSED=0
  RUN_ID=""
  while [ -z "$RUN_ID" ] && [ "$ELAPSED" -lt 120 ]; do
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    RUN_ID=$(gh run list --workflow=release.yml --branch="v${NEW_VERSION}" --json databaseId,headBranch --jq ".[0].databaseId" 2>/dev/null || true)
    # Also try matching by tag via event
    if [ -z "$RUN_ID" ]; then
      RUN_ID=$(gh run list --workflow=release.yml --limit=5 --json databaseId,headBranch,createdAt --jq "[.[] | select(.headBranch == \"v${NEW_VERSION}\")][0].databaseId" 2>/dev/null || true)
    fi
    # Fallback: get the most recent run of this workflow
    if [ -z "$RUN_ID" ]; then
      RUN_ID=$(gh run list --workflow=release.yml --limit=1 --json databaseId,status --jq ".[0].databaseId" 2>/dev/null || true)
    fi
  done

  if [ -z "$RUN_ID" ]; then
    die "Could not find GitHub Actions workflow run after 120 seconds. Check manually."
  fi

  echo "Found workflow run: $RUN_ID"
  echo "Watching build progress..."
  echo ""

  # Poll the run status with progress updates
  START_TIME=$(date +%s)
  while true; do
    STATUS=$(gh run view "$RUN_ID" --json status,conclusion --jq '.status' 2>/dev/null || echo "unknown")
    CONCLUSION=$(gh run view "$RUN_ID" --json status,conclusion --jq '.conclusion' 2>/dev/null || echo "")
    NOW=$(date +%s)
    MINS=$(( (NOW - START_TIME) / 60 ))
    SECS=$(( (NOW - START_TIME) % 60 ))

    if [ "$STATUS" = "completed" ]; then
      echo ""
      if [ "$CONCLUSION" = "success" ]; then
        echo "Build completed successfully! (${MINS}m ${SECS}s)"
        echo ""
        echo "Publishing release v${NEW_VERSION}..."
        if [ -n "${RELEASE_NOTES_FILE:-}" ] && [ -f "${RELEASE_NOTES_FILE:-}" ]; then
          gh release edit "v${NEW_VERSION}" --draft=false --notes-file "$RELEASE_NOTES_FILE"
          rm -f "$RELEASE_NOTES_FILE"
        else
          gh release edit "v${NEW_VERSION}" --draft=false
        fi
        echo ""
        echo "Release v${NEW_VERSION} published!"
        echo "https://github.com/$(gh repo view --json nameWithOwner --jq '.nameWithOwner')/releases/tag/v${NEW_VERSION}"
      else
        echo "Build FAILED with conclusion: $CONCLUSION (${MINS}m ${SECS}s)"
        echo ""
        echo "The draft release was NOT published."
        echo "Check the workflow run: gh run view $RUN_ID --web"
        exit 1
      fi
      break
    fi

    printf "\r  Waiting for builds... (%dm %ds elapsed, status: %s)  " "$MINS" "$SECS" "$STATUS"
    sleep 30
  done
else
  echo ""
  echo "Done! To push and trigger the build:"
  echo "  git push && git push origin v${NEW_VERSION}"
  echo ""
  echo "Or re-run with --push:"
  echo "  $0 $BUMP_OR_VERSION --push"
fi
