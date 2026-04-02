# Release Process

## Overview

Releases follow a tag-based workflow:

1. Run `scripts/release.sh` to bump the version, generate a changelog, commit, and tag
2. Push the tag to trigger the GitHub Actions CI/CD pipeline
3. CI builds native binaries for all platforms and creates a draft GitHub release
4. The release script (with `--push`) waits for CI and publishes the release automatically

## Version File

The single source of truth for the app version is the `version` file at the repository root. It contains a plain semver string (e.g., `0.1.1`).

The release script propagates this version to:
- `version` (root)
- `app/src-tauri/tauri.conf.json` (Tauri product version)
- `app/src-tauri/Cargo.toml` (Rust crate version)
- `app/package.json` (npm package version)
- `website/package.json` (website package version)

## Release Script

Located at `scripts/release.sh`.

### Usage

```bash
# Bump patch version (0.1.0 -> 0.1.1)
./scripts/release.sh patch

# Bump minor version (0.1.0 -> 0.2.0)
./scripts/release.sh minor

# Bump major version (0.1.0 -> 1.0.0)
./scripts/release.sh major

# Set an explicit version
./scripts/release.sh 1.2.3

# Bump + push + wait for CI + publish release
./scripts/release.sh patch --push
```

### What the Script Does

1. **Read current version** from the `version` file
2. **Compute new version** based on bump type or explicit value
3. **Update all version files** (version, tauri.conf.json, Cargo.toml, package.json files)
4. **Generate changelog** -- collects commit messages since the last tag, formats them as a markdown list, and prepends them to `docs/changelog/CHANGELOG.md`
5. **Create git commit** with message `release: vX.Y.Z`
6. **Create git tag** `vX.Y.Z`

With `--push`:

7. **Push** commit and tag to the remote
8. **Wait for GitHub Actions** workflow to start (polls for up to 120 seconds)
9. **Monitor build progress** with status updates every 30 seconds
10. **Publish the release** -- on success, marks the draft release as published using `gh release edit`

### Manual Push (Without --push)

If you run without `--push`, the script prints instructions:

```bash
git push && git push origin vX.Y.Z
```

You can then manually publish the draft release from the GitHub Releases page.

## GitHub Actions CI/CD

The workflow is defined in `.github/workflows/release.yml`. It triggers on any tag push matching `v*`.

### Pipeline Stages

#### 1. get-version
Extracts the version number from the git tag (strips the `v` prefix).

#### 2. build-tauri
Runs in parallel on a build matrix:

| Platform | Target | Suffix |
|---|---|---|
| macos-latest | aarch64-apple-darwin | macos-arm64 |
| macos-latest | x86_64-apple-darwin | macos-x64 |
| ubuntu-22.04 | (native) | linux-x64 |
| windows-latest | (native) | windows-x64 |

Each build:
1. Checks out the repo with submodules
2. Sets up Node.js 20 and Rust stable
3. Installs platform-specific system dependencies (Linux only)
4. Installs frontend npm dependencies
5. Builds the Tauri app using `tauri-apps/tauri-action@v0`
6. Renames artifacts with version and platform suffix

**Artifacts produced:**
- macOS: `open-agent-manager-{version}-macos-arm64.dmg`, `open-agent-manager-{version}-macos-x64.dmg`
- Linux: `open-agent-manager-{version}-linux-x64.deb`, `open-agent-manager-{version}-linux-x64.AppImage`
- Windows: `open-agent-manager-{version}-windows-x64.msi`, `open-agent-manager-{version}-windows-x64-setup.exe`

#### 3. create-release
After all builds complete:
1. Downloads all build artifacts
2. Extracts release notes from `docs/changelog/CHANGELOG.md` for the current version
3. Creates a **draft** GitHub release using `softprops/action-gh-release@v2` with all artifacts attached

The release is created as a draft so the release script (or a human) can review and publish it.

## Changelog

The changelog lives at `docs/changelog/CHANGELOG.md`. Each release appends a new section at the top with the version, date, and commit messages since the previous tag.

Format:

```markdown
## vX.Y.Z (YYYY-MM-DD)

- commit message one
- commit message two
- ...
```

## Checklist for a Release

1. Ensure all changes are committed and pushed to master
2. Run `./scripts/release.sh <bump-type> --push`
3. Wait for the script to report success
4. Verify the release at `https://github.com/suenot/open-agent-manager/releases`
5. Optionally download and test the built artifacts
