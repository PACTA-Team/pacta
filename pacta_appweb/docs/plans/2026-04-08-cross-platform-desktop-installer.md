# Cross-Platform Desktop Installer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create self-contained desktop installers (Windows MSI, macOS DMG, Linux deb/AppImage) that bundle the Next.js app + Node.js runtime into a single binary per platform, auto-opening the browser on localhost.

**Architecture:** Go binary acts as a launcher — embeds the Next.js standalone build and Node.js runtime, extracts to a runtime dir on first launch, spawns Node.js as a subprocess, polls for readiness, opens the default browser, and manages process lifecycle.

**Tech Stack:** Go 1.23+, GoReleaser, Next.js standalone build, Node.js 22 LTS, GoMSI (Windows), nFPM (Linux)

---

### Task 1: Update LICENSE files to PACTA Team

**Files:**
- Modify: `LICENSE` (line 3)
- Create: `../pacta-backend/LICENSE`

**Step 1: Update pacta_appweb LICENSE**

Change `Copyright (c) 2025 mowgliph` to `Copyright (c) 2025 PACTA Team`

**Step 2: Create pacta-backend LICENSE**

Create MIT License with `Copyright (c) 2025 PACTA Team`

**Step 3: Commit**

```bash
cd /home/mowgli/pacta/pacta_appweb && git add LICENSE && git commit -m "chore: update LICENSE copyright to PACTA Team"
cd /home/mowgli/pacta/pacta-backend && git add LICENSE && git commit -m "chore: add MIT LICENSE with PACTA Team copyright"
```

---

### Task 2: Create Go project structure

**Files:**
- Create: `../pacta-desktop/go.mod`
- Create: `../pacta-desktop/cmd/launcher/main.go`
- Create: `../pacta-desktop/internal/server/server.go`
- Create: `../pacta-desktop/internal/browser/browser.go`
- Create: `../pacta-desktop/internal/config/config.go`
- Create: `../pacta-desktop/scripts/embed-assets.sh`
- Create: `../pacta-desktop/.goreleaser.yml`
- Create: `../pacta-desktop/.gitignore`

**Step 1: Initialize Go module**

```bash
mkdir -p /home/mowgli/pacta/pacta-desktop
cd /home/mowgli/pacta/pacta-desktop
go mod init github.com/PACTA-Team/pacta-desktop
```

**Step 2: Create directory structure**

```bash
mkdir -p cmd/launcher internal/server internal/browser internal/config assets/node assets/standalone scripts build/windows build/darwin build/linux
```

**Step 3: Create go.mod with dependencies**

```go
module github.com/PACTA-Team/pacta-desktop

go 1.23

require (
    golang.org/x/sys v0.28.0  // for runtime dir detection
)
```

**Step 4: Create .gitignore**

```
# Binaries
*.exe
*.app
*.deb
*.dmg
*.msi
*.AppImage
*.tar.gz

# Runtime extracted assets
assets/node/*/
assets/standalone/

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db
```

**Step 5: Commit**

```bash
cd /home/mowgli/pacta/pacta-desktop && git add -A && git commit -m "feat: initialize Go project structure for desktop launcher"
```

---

### Task 3: Implement config package

**Files:**
- Create: `../pacta-desktop/internal/config/config.go`
- Test: `../pacta-desktop/internal/config/config_test.go`

**Step 1: Write tests**

```go
// internal/config/config_test.go
package config

import (
    "os"
    "path/filepath"
    "testing"
)

func TestRuntimeDir_Windows(t *testing.T) {
    if os.Getenv("GOOS") != "windows" {
        t.Skip("Windows only")
    }
    dir := RuntimeDir()
    if dir == "" {
        t.Error("RuntimeDir returned empty string")
    }
    if filepath.Base(filepath.Dir(dir)) != "PACTA" {
        t.Errorf("Expected PACTA in path, got %s", dir)
    }
}

func TestRuntimeDir_Linux(t *testing.T) {
    if os.Getenv("GOOS") != "linux" {
        t.Skip("Linux only")
    }
    home, _ := os.UserHomeDir()
    dir := RuntimeDir()
    expected := filepath.Join(home, ".local", "share", "pacta", "runtime")
    if dir != expected {
        t.Errorf("Expected %s, got %s", expected, dir)
    }
}

func TestRuntimeDir_Darwin(t *testing.T) {
    if os.Getenv("GOOS") != "darwin" {
        t.Skip("macOS only")
    }
    home, _ := os.UserHomeDir()
    dir := RuntimeDir()
    expected := filepath.Join(home, "Library", "Application Support", "PACTA", "runtime")
    if dir != expected {
        t.Errorf("Expected %s, got %s", expected, dir)
    }
}

func TestAppURL(t *testing.T) {
    cfg := Default()
    if cfg.AppURL != "http://127.0.0.1:3000" {
        t.Errorf("Expected http://127.0.0.1:3000, got %s", cfg.AppURL)
    }
}

func TestVersionFile(t *testing.T) {
    dir := t.TempDir()
    cfg := &Config{RuntimeDir: dir, Version: "1.0.0"}
    vf := cfg.VersionFile()
    expected := filepath.Join(dir, ".version")
    if vf != expected {
        t.Errorf("Expected %s, got %s", expected, vf)
    }
}

func TestNeedsExtraction_FreshInstall(t *testing.T) {
    dir := t.TempDir()
    cfg := &Config{RuntimeDir: dir, Version: "1.0.0"}
    if !cfg.NeedsExtraction() {
        t.Error("Expected NeedsExtraction=true for fresh install")
    }
}

func TestNeedsExtraction_SameVersion(t *testing.T) {
    dir := t.TempDir()
    os.WriteFile(filepath.Join(dir, ".version"), []byte("1.0.0"), 0644)
    cfg := &Config{RuntimeDir: dir, Version: "1.0.0"}
    if cfg.NeedsExtraction() {
        t.Error("Expected NeedsExtraction=false for same version")
    }
}

func TestNeedsExtraction_DifferentVersion(t *testing.T) {
    dir := t.TempDir()
    os.WriteFile(filepath.Join(dir, ".version"), []byte("0.9.0"), 0644)
    cfg := &Config{RuntimeDir: dir, Version: "1.0.0"}
    if !cfg.NeedsExtraction() {
        t.Error("Expected NeedsExtraction=true for different version")
    }
}
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/mowgli/pacta/pacta-desktop && go test ./internal/config/ -v
```
Expected: FAIL — config package doesn't exist yet

**Step 3: Implement config**

```go
// internal/config/config.go
package config

import (
    "os"
    "path/filepath"
    "runtime"
    "strings"
)

const (
    AppName    = "PACTA"
    AppVersion = "0.1.0" // Updated by goreleaser ldflags
    DefaultPort = 3000
)

type Config struct {
    RuntimeDir string
    Version    string
    Port       int
    AppURL     string
}

func Default() *Config {
    return &Config{
        RuntimeDir: RuntimeDir(),
        Version:    AppVersion,
        Port:       DefaultPort,
        AppURL:     "http://127.0.0.1:3000",
    }
}

func RuntimeDir() string {
    home, err := os.UserHomeDir()
    if err != nil {
        home = os.TempDir()
    }

    switch runtime.GOOS {
    case "windows":
        localAppData := os.Getenv("LOCALAPPDATA")
        if localAppData == "" {
            localAppData = filepath.Join(home, "AppData", "Local")
        }
        return filepath.Join(localAppData, AppName, "runtime")
    case "darwin":
        return filepath.Join(home, "Library", "Application Support", AppName, "runtime")
    default: // linux
        dataHome := os.Getenv("XDG_DATA_HOME")
        if dataHome == "" {
            dataHome = filepath.Join(home, ".local", "share")
        }
        return filepath.Join(dataHome, "pacta", "runtime")
    }
}

func (c *Config) VersionFile() string {
    return filepath.Join(c.RuntimeDir, ".version")
}

func (c *Config) NeedsExtraction() bool {
    data, err := os.ReadFile(c.VersionFile())
    if err != nil {
        return true // Fresh install
    }
    return strings.TrimSpace(string(data)) != c.Version
}

func (c *Config) WriteVersion() error {
    return os.WriteFile(c.VersionFile(), []byte(c.Version), 0644)
}

func (c *Config) NodeBinary() string {
    switch runtime.GOOS {
    case "windows":
        return filepath.Join(c.RuntimeDir, "node.exe")
    default:
        return filepath.Join(c.RuntimeDir, "node")
    }
}

func (c *Config) ServerScript() string {
    return filepath.Join(c.RuntimeDir, "server.js")
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/mowgli/pacta/pacta-desktop && go test ./internal/config/ -v
```
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
cd /home/mowgli/pacta/pacta-desktop && git add -A && git commit -m "feat: implement config package with runtime dir and version tracking"
```

---

### Task 4: Implement browser package

**Files:**
- Create: `../pacta-desktop/internal/browser/browser.go`
- Test: `../pacta-desktop/internal/browser/browser_test.go`

**Step 1: Write tests**

```go
// internal/browser/browser_test.go
package browser

import "testing"

func TestOpenURL_EmptyURL(t *testing.T) {
    err := OpenURL("")
    if err == nil {
        t.Error("Expected error for empty URL")
    }
}

func TestBuildCommand_Windows(t *testing.T) {
    if goos != "windows" {
        t.Skip("Windows only")
    }
    cmd := buildCommand("http://localhost:3000")
    if cmd.Path != "cmd" {
        t.Errorf("Expected cmd, got %s", cmd.Path)
    }
}

func TestBuildCommand_Darwin(t *testing.T) {
    if goos != "darwin" {
        t.Skip("macOS only")
    }
    cmd := buildCommand("http://localhost:3000")
    if cmd.Path != "open" {
        t.Errorf("Expected open, got %s", cmd.Path)
    }
}

func TestBuildCommand_Linux(t *testing.T) {
    if goos != "linux" {
        t.Skip("Linux only")
    }
    cmd := buildCommand("http://localhost:3000")
    if cmd.Path != "xdg-open" {
        t.Errorf("Expected xdg-open, got %s", cmd.Path)
    }
}
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/mowgli/pacta/pacta-desktop && go test ./internal/browser/ -v
```
Expected: FAIL — browser package doesn't exist

**Step 3: Implement browser**

```go
// internal/browser/browser.go
package browser

import (
    "errors"
    "os/exec"
    "runtime"
)

var goos = runtime.GOOS

func OpenURL(url string) error {
    if url == "" {
        return errors.New("browser: empty URL")
    }

    cmd := buildCommand(url)
    cmd.Stdout = nil
    cmd.Stderr = nil
    return cmd.Start()
}

func buildCommand(url string) *exec.Cmd {
    switch goos {
    case "windows":
        return exec.Command("cmd", "/c", "start", url)
    case "darwin":
        return exec.Command("open", url)
    default:
        return exec.Command("xdg-open", url)
    }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/mowgli/pacta/pacta-desktop && go test ./internal/browser/ -v
```
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
cd /home/mowgli/pacta/pacta-desktop && git add -A && git commit -m "feat: implement browser package with cross-platform URL opening"
```

---

### Task 5: Implement server package

**Files:**
- Create: `../pacta-desktop/internal/server/server.go`
- Test: `../pacta-desktop/internal/server/server_test.go`

**Step 1: Write tests**

```go
// internal/server/server_test.go
package server

import (
    "context"
    "net"
    "net/http"
    "net/http/httptest"
    "testing"
    "time"
)

func TestWaitForServer_Timeout(t *testing.T) {
    ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
    defer cancel()

    err := WaitForServer(ctx, "http://127.0.0.1:19999", 50*time.Millisecond)
    if err == nil {
        t.Error("Expected timeout error, got nil")
    }
}

func TestWaitForServer_Immediate(t *testing.T) {
    // Start a test server
    srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    }))
    defer srv.Close()

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    err := WaitForServer(ctx, srv.URL, 50*time.Millisecond)
    if err != nil {
        t.Errorf("Expected no error, got %v", err)
    }
}

func TestIsPortAvailable(t *testing.T) {
    // Find an available port
    listener, err := net.Listen("tcp", "127.0.0.1:0")
    if err != nil {
        t.Fatal(err)
    }
    addr := listener.Addr().(*net.TCPAddr)
    listener.Close()

    if !IsPortAvailable(addr.Port) {
        t.Errorf("Expected port %d to be available", addr.Port)
    }
}
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/mowgli/pacta/pacta-desktop && go test ./internal/server/ -v
```
Expected: FAIL — server package doesn't exist

**Step 3: Implement server**

```go
// internal/server/server.go
package server

import (
    "context"
    "fmt"
    "net"
    "net/http"
    "os"
    "os/exec"
    "path/filepath"
    "time"
)

func Start(runtimeDir string, nodeBinary string, port int) (*exec.Cmd, error) {
    cmd := exec.Command(nodeBinary, "server.js")
    cmd.Dir = runtimeDir
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    cmd.Env = append(os.Environ(),
        fmt.Sprintf("PORT=%d", port),
        "NODE_ENV=production",
    )

    if err := cmd.Start(); err != nil {
        return nil, fmt.Errorf("server: failed to start node: %w", err)
    }

    return cmd, nil
}

func WaitForServer(ctx context.Context, url string, interval time.Duration) error {
    client := &http.Client{Timeout: 2 * time.Second}
    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return fmt.Errorf("server: timed out waiting for %s: %w", url, ctx.Err())
        case <-ticker.C:
            resp, err := client.Get(url)
            if err == nil {
                resp.Body.Close()
                return nil
            }
        }
    }
}

func IsPortAvailable(port int) bool {
    addr := fmt.Sprintf("127.0.0.1:%d", port)
    listener, err := net.Listen("tcp", addr)
    if err != nil {
        return false
    }
    listener.Close()
    return true
}

func Cleanup(cmd *exec.Cmd) error {
    if cmd == nil || cmd.Process == nil {
        return nil
    }
    // Try graceful shutdown first
    cmd.Process.Signal(os.Interrupt)

    // Wait up to 5 seconds
    done := make(chan error, 1)
    go func() { done <- cmd.Wait() }()

    select {
    case <-done:
        return nil
    case <-time.After(5 * time.Second):
        return cmd.Process.Kill()
    }
}

// ExtractAssets extracts embedded assets to the runtime directory
func ExtractAssets(embedFS interface{}, runtimeDir string) error {
    // Create runtime dir
    if err := os.MkdirAll(runtimeDir, 0755); err != nil {
        return fmt.Errorf("server: failed to create runtime dir: %w", err)
    }

    // Assets are extracted by the main package using embed.FS
    // This function is a placeholder for the extraction logic
    // that will be implemented in the launcher main
    return nil
}

// WriteEnv writes the .env file to the runtime directory
func WriteEnv(runtimeDir string, port int, jwtSecret string) error {
    envContent := fmt.Sprintf("PORT=%d\nNODE_ENV=production\nJWT_SECRET=%s\n", port, jwtSecret)
    return os.WriteFile(filepath.Join(runtimeDir, ".env"), []byte(envContent), 0644)
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/mowgli/pacta/pacta-desktop && go test ./internal/server/ -v
```
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
cd /home/mowgli/pacta/pacta-desktop && git add -A && git commit -m "feat: implement server package with lifecycle management"
```

---

### Task 6: Implement main launcher

**Files:**
- Create: `../pacta-desktop/cmd/launcher/main.go`

**Step 1: Write the launcher**

```go
// cmd/launcher/main.go
package main

import (
    "context"
    "embed"
    "fmt"
    "io/fs"
    "log"
    "os"
    "os/signal"
    "path/filepath"
    "syscall"
    "time"

    "github.com/PACTA-Team/pacta-desktop/internal/browser"
    "github.com/PACTA-Team/pacta-desktop/internal/config"
    "github.com/PACTA-Team/pacta-desktop/internal/server"
)

//go:embed assets/node/* assets/standalone/*
var embeddedAssets embed.FS

func main() {
    cfg := config.Default()

    log.Printf("%s v%s starting...", config.AppName, cfg.Version)

    // Check if extraction is needed
    if cfg.NeedsExtraction() {
        log.Println("Extracting assets...")
        if err := extractAssets(cfg.RuntimeDir); err != nil {
            log.Fatalf("Failed to extract assets: %v", err)
        }
        if err := cfg.WriteVersion(); err != nil {
            log.Fatalf("Failed to write version file: %v", err)
        }
    }

    // Write .env
    jwtSecret := os.Getenv("JWT_SECRET")
    if jwtSecret == "" {
        jwtSecret = "pacta-local-dev-secret"
    }
    if err := server.WriteEnv(cfg.RuntimeDir, cfg.Port, jwtSecret); err != nil {
        log.Fatalf("Failed to write .env: %v", err)
    }

    // Start Node.js server
    log.Println("Starting PACTA server on port %d...", cfg.Port)
    nodeCmd, err := server.Start(cfg.RuntimeDir, cfg.NodeBinary(), cfg.Port)
    if err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }

    // Wait for server to be ready
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    log.Println("Waiting for server to be ready...")
    if err := server.WaitForServer(ctx, cfg.AppURL, 500*time.Millisecond); err != nil {
        nodeCmd.Process.Kill()
        log.Fatalf("Server failed to start: %v", err)
    }

    log.Println("Server ready! Opening browser...")

    // Open browser
    if err := browser.OpenURL(cfg.AppURL); err != nil {
        log.Printf("Warning: could not open browser: %v", err)
    }

    // Handle signals for clean shutdown
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

    log.Printf("%s is running. Press Ctrl+C to stop.", config.AppName)

    select {
    case sig := <-sigCh:
        log.Printf("Received %s, shutting down...", sig)
    case err := <-waitChan(nodeCmd):
        log.Printf("Node process exited with code: %v", err)
    }

    // Cleanup
    log.Println("Stopping server...")
    if err := server.Cleanup(nodeCmd); err != nil {
        log.Printf("Warning: error during cleanup: %v", err)
    }
    log.Println("Goodbye!")
}

func waitChan(cmd *os/exec.Cmd) chan error {
    ch := make(chan error, 1)
    go func() { ch <- cmd.Wait() }()
    return ch
}

func extractAssets(runtimeDir string) error {
    // Extract Node.js binary
    nodePlatform := nodePlatformDir()
    nodePath := fmt.Sprintf("assets/node/%s", nodePlatform)

    // Extract node binary
    entries, err := embeddedAssets.ReadDir(nodePath)
    if err != nil {
        return fmt.Errorf("failed to read node assets: %w", err)
    }

    for _, entry := range entries {
        src := fmt.Sprintf("%s/%s", nodePath, entry.Name())
        dst := filepath.Join(runtimeDir, entry.Name())
        if err := extractFile(src, dst); err != nil {
            return err
        }
    }

    // Extract standalone build
    standEntries, err := embeddedAssets.ReadDir("assets/standalone")
    if err != nil {
        return fmt.Errorf("failed to read standalone assets: %w", err)
    }

    for _, entry := range standEntries {
        src := fmt.Sprintf("assets/standalone/%s", entry.Name())
        dst := filepath.Join(runtimeDir, entry.Name())
        if err := extractFile(src, dst); err != nil {
            return err
        }
    }

    // Make node executable on Unix
    if runtime.GOOS != "windows" {
        nodeBin := filepath.Join(runtimeDir, "node")
        if err := os.Chmod(nodeBin, 0755); err != nil {
            return fmt.Errorf("failed to chmod node: %w", err)
        }
    }

    return nil
}

func extractFile(src, dst string) error {
    data, err := embeddedAssets.ReadFile(src)
    if err != nil {
        return fmt.Errorf("failed to read %s: %w", src, err)
    }

    // Create parent dir
    if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
        return err
    }

    return os.WriteFile(dst, data, 0644)
}

func nodePlatformDir() string {
    arch := runtime.GOARCH
    if arch == "amd64" {
        arch = "amd64"
    } else if arch == "arm64" {
        arch = "arm64"
    }

    switch runtime.GOOS {
    case "windows":
        return fmt.Sprintf("windows-%s", arch)
    case "darwin":
        return fmt.Sprintf("darwin-%s", arch)
    default:
        return fmt.Sprintf("linux-%s", arch)
    }
}
```

**Note:** The `embed.FS` approach with `ReadFile` on individual files works for single files but not for recursive directory trees with nested node_modules. We need a different approach for the standalone build which has thousands of files. Let me revise the extraction strategy:

**Revised approach for standalone extraction:** Instead of embedding every file individually (which would blow up the binary size and compilation time), we'll:

1. Create a tarball of the standalone build + Node.js during the CI build
2. Embed the tarball as a single file
3. Extract the tarball at runtime

This is much more efficient. Let me update the main.go:

```go
// cmd/launcher/main.go
package main

import (
    "archive/tar"
    "compress/gzip"
    "context"
    _ "embed"
    "fmt"
    "io"
    "log"
    "os"
    "os/exec"
    "os/signal"
    "path/filepath"
    "runtime"
    "syscall"
    "time"

    "github.com/PACTA-Team/pacta-desktop/internal/browser"
    "github.com/PACTA-Team/pacta-desktop/internal/config"
    "github.com/PACTA-Team/pacta-desktop/internal/server"
)

//go:embed assets/pacta-assets.tar.gz
var embeddedAssets []byte

func main() {
    cfg := config.Default()

    log.Printf("%s v%s starting...", config.AppName, cfg.Version)

    // Check if extraction is needed
    if cfg.NeedsExtraction() {
        log.Println("Extracting assets...")
        if err := extractTarball(cfg.RuntimeDir); err != nil {
            log.Fatalf("Failed to extract assets: %v", err)
        }
        if err := cfg.WriteVersion(); err != nil {
            log.Fatalf("Failed to write version file: %v", err)
        }
    }

    // Write .env
    jwtSecret := os.Getenv("JWT_SECRET")
    if jwtSecret == "" {
        jwtSecret = "pacta-local-dev-secret"
    }
    if err := server.WriteEnv(cfg.RuntimeDir, cfg.Port, jwtSecret); err != nil {
        log.Fatalf("Failed to write .env: %v", err)
    }

    // Start Node.js server
    log.Println("Starting PACTA server on port %d...", cfg.Port)
    nodeCmd, err := server.Start(cfg.RuntimeDir, cfg.NodeBinary(), cfg.Port)
    if err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }

    // Wait for server to be ready
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    log.Println("Waiting for server to be ready...")
    if err := server.WaitForServer(ctx, cfg.AppURL, 500*time.Millisecond); err != nil {
        nodeCmd.Process.Kill()
        log.Fatalf("Server failed to start: %v", err)
    }

    log.Println("Server ready! Opening browser...")

    // Open browser
    if err := browser.OpenURL(cfg.AppURL); err != nil {
        log.Printf("Warning: could not open browser: %v", err)
    }

    // Handle signals for clean shutdown
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

    log.Printf("%s is running. Press Ctrl+C to stop.", config.AppName)

    select {
    case sig := <-sigCh:
        log.Printf("Received %s, shutting down...", sig)
    case err := <-waitChan(nodeCmd):
        log.Printf("Node process exited with code: %v", err)
    }

    // Cleanup
    log.Println("Stopping server...")
    if err := server.Cleanup(nodeCmd); err != nil {
        log.Printf("Warning: error during cleanup: %v", err)
    }
    log.Println("Goodbye!")
}

func waitChan(cmd *os/exec.Cmd) chan error {
    ch := make(chan error, 1)
    go func() { ch <- cmd.Wait() }()
    return ch
}

func extractTarball(destDir string) error {
    gr, err := gzip.NewReader(bytes.NewReader(embeddedAssets))
    if err != nil {
        return fmt.Errorf("failed to create gzip reader: %w", err)
    }
    defer gr.Close()

    tr := tar.NewReader(gr)

    for {
        header, err := tr.Next()
        if err == io.EOF {
            break
        }
        if err != nil {
            return fmt.Errorf("failed to read tar header: %w", err)
        }

        target := filepath.Join(destDir, header.Name)

        switch header.Typeflag {
        case tar.TypeDir:
            if err := os.MkdirAll(target, os.FileMode(header.Mode)); err != nil {
                return fmt.Errorf("failed to create dir %s: %w", target, err)
            }
        case tar.TypeReg:
            if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
                return err
            }
            f, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY, os.FileMode(header.Mode))
            if err != nil {
                return fmt.Errorf("failed to create file %s: %w", target, err)
            }
            if _, err := io.Copy(f, tr); err != nil {
                f.Close()
                return fmt.Errorf("failed to write file %s: %w", target, err)
            }
            f.Close()
        }
    }

    // Make node executable on Unix
    if runtime.GOOS != "windows" {
        nodeBin := filepath.Join(destDir, "node")
        if err := os.Chmod(nodeBin, 0755); err != nil {
            return fmt.Errorf("failed to chmod node: %w", err)
        }
    }

    return nil
}
```

Add the missing import:
```go
import (
    "bytes"
    // ... other imports
)
```

**Step 2: Commit**

```bash
cd /home/mowgli/pacta/pacta-desktop && git add -A && git commit -m "feat: implement main launcher with asset extraction and browser launch"
```

---

### Task 7: Create embed-assets.sh script

**Files:**
- Create: `../pacta-desktop/scripts/embed-assets.sh`

**Step 1: Create the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_DIR="$(dirname "$PROJECT_DIR")/pacta_appweb"
ASSETS_DIR="$PROJECT_DIR/assets"

echo "=== Embedding assets for PACTA Desktop ==="

# 1. Build Next.js standalone
echo "[1/4] Building Next.js standalone..."
cd "$APP_DIR"
npm ci
NODE_ENV=production npm run build

# Verify standalone build
if [ ! -f ".next/standalone/server.js" ]; then
    echo "ERROR: .next/standalone/server.js not found!"
    exit 1
fi
echo "  Standalone build verified."

# 2. Download Node.js binaries for all target platforms
echo "[2/4] Downloading Node.js binaries..."
NODE_VERSION="22.14.0"
NODE_DIR="$ASSETS_DIR/node"

declare -A NODE_URLS=(
    ["windows-amd64"]="https://nodejs.org/dist/v${NODE_VERSION}/win-x64/node.exe"
    ["darwin-amd64"]="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-x64/bin/node"
    ["darwin-arm64"]="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64/bin/node"
    ["linux-amd64"]="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64/bin/node"
    ["linux-arm64"]="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64/bin/node"
)

for platform in "${!NODE_URLS[@]}"; do
    mkdir -p "$NODE_DIR/$platform"
    url="${NODE_URLS[$platform]}"
    filename="node"
    if [[ "$platform" == windows* ]]; then
        filename="node.exe"
    fi
    echo "  Downloading $platform..."
    curl -fsSL "$url" -o "$NODE_DIR/$platform/$filename"
    chmod +x "$NODE_DIR/$platform/$filename"
done

echo "  Node.js binaries ready."

# 3. Create tarball of standalone + Node.js
echo "[3/4] Creating asset tarball..."
TARBALL="$ASSETS_DIR/pacta-assets.tar.gz"

# Create a temp dir for the tarball contents
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Copy standalone build
cp -r "$APP_DIR/.next/standalone/"* "$TMPDIR/"
# Copy .next/static
cp -r "$APP_DIR/.next/static" "$TMPDIR/.next/" 2>/dev/null || true
# Copy public if exists
cp -r "$APP_DIR/public" "$TMPDIR/" 2>/dev/null || true

# Copy Node.js binary for current platform
CURRENT_OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
CURRENT_ARCH="$(uname -m)"
if [ "$CURRENT_ARCH" = "x86_64" ]; then
    CURRENT_ARCH="amd64"
elif [ "$CURRENT_ARCH" = "aarch64" ]; then
    CURRENT_ARCH="arm64"
fi

PLATFORM="${CURRENT_OS}-${CURRENT_ARCH}"
NODE_BIN="$NODE_DIR/$PLATFORM"
if [ -d "$NODE_BIN" ]; then
    if [ "$CURRENT_OS" = "windows" ]; then
        cp "$NODE_BIN/node.exe" "$TMPDIR/"
    else
        cp "$NODE_BIN/node" "$TMPDIR/"
    fi
fi

# Create tarball
tar -czf "$TARBALL" -C "$TMPDIR" .

echo "  Tarball created: $(du -h "$TARBALL" | cut -f1)"

# 4. Clean up old platform-specific node dirs (we use tarball now)
echo "[4/4] Cleaning up..."
# Keep the node dirs for CI cross-compilation, remove any stale ones

echo "=== Assets embedded successfully ==="
```

**Step 2: Make executable**

```bash
chmod +x /home/mowgli/pacta/pacta-desktop/scripts/embed-assets.sh
```

**Step 3: Test the script**

```bash
cd /home/mowgli/pacta/pacta-desktop && bash scripts/embed-assets.sh
```
Expected: Downloads Node.js, builds Next.js, creates tarball

**Step 4: Commit**

```bash
cd /home/mowgli/pacta/pacta-desktop && git add -A && git commit -m "feat: add embed-assets.sh script for bundling Node.js and Next.js"
```

---

### Task 8: Create GoReleaser configuration

**Files:**
- Create: `../pacta-desktop/.goreleaser.yml`

**Step 1: Create .goreleaser.yml**

```yaml
version: 2
project_name: pacta

before:
  hooks:
    - bash -c 'cd ../pacta_appweb && npm ci && NODE_ENV=production npm run build'
    - bash -c 'scripts/embed-assets.sh'

builds:
  - id: pacta-windows
    main: ./cmd/launcher
    binary: pacta
    env:
      - CGO_ENABLED=0
    goos:
      - windows
    goarch:
      - amd64
    ldflags:
      - -s -w -X github.com/PACTA-Team/pacta-desktop/internal/config.AppVersion={{.Version}}

  - id: pacta-darwin
    main: ./cmd/launcher
    binary: pacta
    env:
      - CGO_ENABLED=0
    goos:
      - darwin
    goarch:
      - amd64
      - arm64
    ldflags:
      - -s -w -X github.com/PACTA-Team/pacta-desktop/internal/config.AppVersion={{.Version}}
    universal_binary: true

  - id: pacta-linux
    main: ./cmd/launcher
    binary: pacta
    env:
      - CGO_ENABLED=0
    goos:
      - linux
    goarch:
      - amd64
    ldflags:
      - -s -w -X github.com/PACTA-Team/pacta-desktop/internal/config.AppVersion={{.Version}}

archives:
  - id: pacta-archive
    format: tar.gz
    name_template: "{{ .ProjectName }}_{{ .Version }}_{{ .Os }}_{{ .Arch }}"
    files:
      - README.md
      - LICENSE

nfpms:
  - id: pacta-deb
    package_name: pacta
    vendor: "PACTA Team"
    maintainer: "PACTA Team <maintainer@pacta.app>"
    description: "PACTA Contract Management System - Local-first contract management"
    license: "MIT"
    homepage: "https://github.com/PACTA-Team/pacta"
    formats:
      - deb
    bindir: /opt/pacta
    contents:
      - src: /opt/pacta/pacta
        dst: /usr/local/bin/pacta
        type: symlink
    scripts:
      postinstall: build/linux/postinst.sh
      preremove: build/linux/prerm.sh

msi:
  - id: pacta-msi
    name: pacta_{{ .Version }}_windows_amd64
    xml: build/windows/pacta.wxs
    extra_files:
      - from: dist/pacta-windows/pacta.exe
        dst: pacta.exe

release:
  github:
    owner: PACTA-Team
    name: pacta
  draft: true
  prerelease: auto
  name_template: "PACTA {{ .Version }}"
```

**Step 2: Commit**

```bash
cd /home/mowgli/pacta/pacta-desktop && git add -A && git commit -m "feat: add GoReleaser configuration for cross-platform builds"
```

---

### Task 9: Create installer scripts (Windows MSI, Linux deb)

**Files:**
- Create: `../pacta-desktop/build/windows/pacta.wxs`
- Create: `../pacta-desktop/build/linux/postinst.sh`
- Create: `../pacta-desktop/build/linux/prerm.sh`

**Step 1: Create Windows WiX XML**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" Name="PACTA" Language="1033" Version="$(var.Version)"
           Manufacturer="PACTA Team" UpgradeCode="A1B2C3D4-E5F6-7890-ABCD-EF1234567890">
    <Package InstallerVersion="500" Compressed="yes" InstallScope="perMachine" Platform="x64" />

    <MajorUpgrade DowngradeErrorMessage="A newer version of PACTA is already installed." />

    <MediaTemplate EmbedCab="yes" />

    <Feature Id="ProductFeature" Title="PACTA" Level="1">
      <ComponentGroupRef Id="ProductComponents" />
    </Feature>

    <Icon Id="PactaIcon" SourceFile="build/windows/pacta.ico" />
    <Property Id="ARPPRODUCTICON" Value="PactaIcon" />
  </Product>

  <Fragment>
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFiles64Folder">
        <Directory Id="INSTALLFOLDER" Name="PACTA" />
      </Directory>
      <Directory Id="ProgramMenuFolder">
        <Directory Id="ApplicationProgramsFolder" Name="PACTA" />
      </Directory>
      <Directory Id="DesktopFolder" Name="Desktop" />
    </Directory>
  </Fragment>

  <Fragment>
    <ComponentGroup Id="ProductComponents" Directory="INSTALLFOLDER">
      <Component Id="PactaExe" Guid="*">
        <File Id="PactaExeFile" Source="dist/pacta-windows/pacta.exe" KeyPath="yes" />
      </Component>

      <Component Id="StartMenuShortcut" Guid="*" Directory="ApplicationProgramsFolder">
        <Shortcut Id="StartMenuShortcut" Name="PACTA" Target="[INSTALLFOLDER]pacta.exe"
                  WorkingDirectory="INSTALLFOLDER" />
        <RemoveFolder Id="RemoveStartMenuFolder" Directory="ApplicationProgramsFolder" On="uninstall" />
        <RegistryValue Root="HKCU" Key="Software\PACTA" Name="StartMenu" Type="integer" Value="1" KeyPath="yes" />
      </Component>

      <Component Id="DesktopShortcut" Guid="*" Directory="DesktopFolder">
        <Shortcut Id="DesktopShortcut" Name="PACTA" Target="[INSTALLFOLDER]pacta.exe"
                  WorkingDirectory="INSTALLFOLDER" />
        <RemoveFolder Id="RemoveDesktopFolder" Directory="DesktopFolder" On="uninstall" />
        <RegistryValue Root="HKCU" Key="Software\PACTA" Name="Desktop" Type="integer" Value="1" KeyPath="yes" />
      </Component>
    </ComponentGroup>
  </Fragment>
</Wix>
```

**Step 2: Create Linux postinst script**

```bash
#!/bin/bash
set -e

# Create desktop entry
cat > /usr/share/applications/pacta.desktop << 'EOF'
[Desktop Entry]
Name=PACTA
Comment=Contract Management System
Exec=/opt/pacta/pacta
Icon=/opt/pacta/pacta.png
Terminal=false
Type=Application
Categories=Office;
EOF

# Create data directories
mkdir -p /opt/pacta/data /opt/pacta/uploads /opt/pacta/config /opt/pacta/logs

echo "PACTA installed successfully. Launch from Applications menu or run 'pacta'."
```

**Step 3: Create Linux prerm script**

```bash
#!/bin/bash
set -e

# Remove desktop entry
rm -f /usr/share/applications/pacta.desktop

# Clean up runtime data
rm -rf ~/.local/share/pacta/runtime

echo "PACTA removed successfully."
```

**Step 4: Make scripts executable**

```bash
chmod +x /home/mowgli/pacta/pacta-desktop/build/linux/postinst.sh
chmod +x /home/mowgli/pacta/pacta-desktop/build/linux/prerm.sh
```

**Step 5: Commit**

```bash
cd /home/mowgli/pacta/pacta-desktop && git add -A && git commit -m "feat: add installer scripts for Windows MSI and Linux deb"
```

---

### Task 10: Create GitHub Actions workflow

**Files:**
- Create: `../pacta-desktop/.github/workflows/release.yml`
- Modify: `../pacta_appweb/.github/workflows/build-binaries.yml` (deprecate/remove)

**Step 1: Create release workflow**

```yaml
name: Release Desktop Apps

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag (e.g., v0.1.0)'
        required: true
        type: string

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'
          cache: true

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: ../pacta_appweb/package-lock.json

      - name: Install GoReleaser
        uses: goreleaser/goreleaser-action@v6
        with:
          distribution: goreleaser
          version: '~> v2'
          args: release --clean

      - name: Upload artifacts
        uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/*.msi
            dist/*.deb
            dist/*.tar.gz
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Step 2: Commit**

```bash
cd /home/mowgli/pacta/pacta-desktop && git add -A && git commit -m "ci: add GitHub Actions release workflow for desktop apps"
```

---

### Task 11: Initial build test (local)

**Files:** No new files — verification step

**Step 1: Run embed-assets.sh**

```bash
cd /home/mowgli/pacta/pacta-desktop && bash scripts/embed-assets.sh
```
Expected: Downloads Node.js, builds Next.js, creates tarball in assets/

**Step 2: Build Go binary for Linux**

```bash
cd /home/mowgli/pacta/pacta-desktop && go build -o pacta-test ./cmd/launcher
```
Expected: Binary compiles successfully

**Step 3: Run tests**

```bash
cd /home/mowgli/pacta/pacta-desktop && go test ./... -v
```
Expected: All tests pass

**Step 4: Quick smoke test (optional)**

```bash
./pacta-test
```
Expected: Extracts assets, starts Node.js, opens browser to localhost:3000

**Step 5: Commit any fixes**

```bash
cd /home/mowgli/pacta/pacta-desktop && git add -A && git commit -m "fix: address issues from initial build test"
```

---

### Task 12: Push pacta-desktop to GitHub

**Step 1: Initialize remote repo**

Create the `PACTA-Team/pacta-desktop` repo on GitHub (or verify it exists).

**Step 2: Push**

```bash
cd /home/mowgli/pacta/pacta-desktop
git remote add origin git@github.com:PACTA-Team/pacta-desktop.git
git branch -M main
git push -u origin main
```

---

### Task 13: Update pacta_appweb build-binaries.yml to reference new approach

**Files:**
- Modify: `../pacta_appweb/.github/workflows/build-binaries.yml`

**Step 1: Deprecate old workflow**

Add a header comment and simplify to just reference the new desktop repo:

```yaml
# DEPRECATED: Use PACTA-Team/pacta-desktop for desktop installers
# This workflow is kept for server-only deployments.
# See: https://github.com/PACTA-Team/pacta-desktop
```

**Step 2: Commit**

```bash
cd /home/mowgli/pacta/pacta_appweb && git add -A && git commit -m "chore: deprecate build-binaries.yml in favor of pacta-desktop"
```

---

### Task 14: Final verification and tag

**Step 1: Verify all repos are clean**

```bash
cd /home/mowgli/pacta/pacta_appweb && git status
cd /home/mowgli/pacta/pacta-backend && git status
cd /home/mowgli/pacta/pacta-desktop && git status
```

**Step 2: Create tag on pacta-desktop**

```bash
cd /home/mowgli/pacta/pacta-desktop
git tag v0.1.0
git push origin v0.1.0
```

**Step 3: Verify GitHub Actions runs**

Check the Actions tab on `PACTA-Team/pacta-desktop` for the release workflow.

---

## Summary

| Task | Description | Estimated Files |
|------|-------------|-----------------|
| 1 | Update LICENSE files | 2 files |
| 2 | Create Go project structure | 8 files |
| 3 | Implement config package | 2 files |
| 4 | Implement browser package | 2 files |
| 5 | Implement server package | 2 files |
| 6 | Implement main launcher | 1 file |
| 7 | Create embed-assets.sh | 1 file |
| 8 | Create GoReleaser config | 1 file |
| 9 | Create installer scripts | 3 files |
| 10 | Create GitHub Actions workflow | 1 file |
| 11 | Initial build test | 0 files |
| 12 | Push to GitHub | 0 files |
| 13 | Deprecate old workflow | 1 file |
| 14 | Final verification and tag | 0 files |
