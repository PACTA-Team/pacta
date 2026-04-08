# Design: PACTA Cross-Platform Desktop Installer

## Context

PACTA is currently deployed as a Next.js web app served via systemd + Caddy reverse proxy on a VPS. The goal is to create self-contained desktop installers that bundle the entire application (Next.js build + Node.js runtime) into a single binary per platform, which launches the app on localhost and opens the browser automatically.

The Python backend remains separate (future migration to Go is out of scope).

## Architecture

```
pacta-desktop/
├── cmd/
│   └── launcher/
│       └── main.go          # Entry point: starts Next.js, opens browser
├── internal/
│   ├── server/              # Manages Next.js process lifecycle
│   ├── browser/             # Cross-platform browser opening
│   └── config/              # App config (port, data dir)
├── assets/
│   ├── node/                # Embedded Node.js binaries (per platform)
│   │   ├── windows-amd64/node.exe
│   │   ├── darwin-amd64/node
│   │   ├── darwin-arm64/node
│   │   ├── linux-amd64/node
│   │   └── linux-arm64/node
│   └── standalone/          # Embedded Next.js standalone build
│       ├── server.js
│       ├── .next/
│       ├── node_modules/
│       └── public/
├── scripts/
│   └── embed-assets.sh      # Pre-build script to download Node.js + copy standalone
├── build/
│   ├── windows/             # MSI config (GoMSI)
│   ├── darwin/              # .app bundle config
│   └── linux/               # .deb + AppImage config
├── .goreleaser.yml          # CI build orchestration
├── go.mod
└── go.sum
```

## Go Launcher Implementation

### Startup Flow

1. **Extract embedded assets** to OS runtime dir (only if version hash changed):
   - Windows: `%LOCALAPPDATA%\PACTA\runtime\`
   - macOS: `~/Library/Application Support/PACTA/runtime/`
   - Linux: `~/.local/share/pacta/runtime/`

2. **Locate Node.js** — uses the bundled binary from `assets/node/<platform>/`

3. **Spawn subprocess**: `<runtime_dir>/node server.js`

4. **Poll localhost:3000** until ready (30s timeout, 500ms intervals)

5. **Open default browser**:
   - Windows: `exec.Command("cmd", "/c", "start", url)`
   - macOS: `exec.Command("open", url)`
   - Linux: `exec.Command("xdg-open", url)`

6. **Block on subprocess** — on exit, kill node process and exit cleanly

### Key Design Decisions

- **Node.js is bundled** — zero external dependencies. User installs one file, everything works.
- **Next.js standalone build is embedded** via `//go:embed`
- **Version-based re-extraction** — a `.version` file tracks whether assets need re-extraction (fast startup after first run)
- **CGO_ENABLED=0** — static Go binary, no system library dependencies

## Installer Packages

### Windows (MSI via GoMSI)

- Package: `pacta-<version>-windows-amd64.msi`
- Install location: `C:\Program Files\PACTA\pacta.exe`
- Creates: Start Menu shortcut, Desktop shortcut
- Registers in Add/Remove Programs
- Uninstaller cleans up `%LOCALAPPDATA%\PACTA\runtime\`

### macOS (.app bundle)

- Package: `pacta-<version>-darwin-universal.dmg`
- Standard `.app` with icon, drag-to-Applications experience
- Universal binary (amd64 + arm64)
- Code-signing and notarization optional (requires Apple Developer cert)

### Linux (.deb + AppImage)

- `.deb`: `pacta_<version>_amd64.deb`
  - Installs to `/opt/pacta/`
  - Creates `.desktop` entry in applications menu
- `.AppImage`: `pacta-<version>-x86_64.AppImage`
  - Portable, no install needed
  - User downloads and runs directly

## CI/CD Pipeline

### GoReleaser Configuration (`.goreleaser.yml`)

```yaml
version: 2
project_name: pacta

builds:
  - id: pacta
    main: ./cmd/launcher
    binary: pacta
    env:
      - CGO_ENABLED=0
    goos:
      - windows
      - darwin
      - linux
    goarch:
      - amd64
      - arm64
    hooks:
      pre:
        - bash -c 'cd pacta_appweb && npm ci && NODE_ENV=production npm run build'
        - bash -c 'pacta-desktop/scripts/embed-assets.sh'

archives:
  - id: pacta-archive
    format: tar.gz
    name_template: "{{ .ProjectName }}_{{ .Version }}_{{ .Os }}_{{ .Arch }}"

nfpms:
  - id: pacta-deb
    package_name: pacta
    vendor: "PACTA Team"
    maintainer: "PACTA Team"
    description: "PACTA Contract Management System"
    license: "MIT"
    formats:
      - deb
    bindir: /opt/pacta
    contents:
      - src: /opt/pacta/pacta
        dst: /usr/bin/pacta
        type: symlink

release:
  github:
    owner: PACTA-Team
    name: pacta
  draft: true
  prerelease: auto
```

### GitHub Actions Workflow

Replaces existing `build-binaries.yml`. Triggers on `v*` tags:

1. Checkout code
2. Setup Go + Node.js
3. Run GoReleaser (builds all platforms in parallel)
4. Create GitHub Release on `PACTA-Team/pacta` repo
5. Upload `.msi`, `.dmg`, `.deb`, `.AppImage` artifacts

## License Updates

- `pacta_appweb/LICENSE`: Update copyright from `mowgliph` to `PACTA Team`
- `pacta-backend/LICENSE`: Create new MIT License with `PACTA Team`
- `pacta-desktop/LICENSE`: New MIT License with `PACTA Team`

## Out of Scope

- Python backend bundling (remains separate deployment)
- Auto-update mechanism (future consideration)
- Backend migration to Go (future consideration)

## Success Criteria

1. User downloads one installer per platform
2. Installs/launches with zero external dependencies
3. Browser opens automatically to `http://localhost:3000`
4. All three platforms (Windows, macOS, Linux) produce working binaries
5. CI pipeline produces all artifacts on tag push
