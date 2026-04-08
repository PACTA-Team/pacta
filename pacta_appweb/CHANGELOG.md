# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-04-08

### Added
- **Native Windows Launcher (PACTA.exe)** - Go-based launcher with embedded contract icon
- **First-offline installer** - Auto-generates .env with JWT_SECRET during installation
- **Automatic NSSM service configuration** - Correct paths, environment variables, and logging
- **Windows Firewall rule** - Auto-adds inbound rule for port 3000 during install
- **Desktop shortcut option** - Optional desktop icon during installation
- **Version info embedding** - File properties show PACTA branding in Windows Explorer
- **Direct launch mode** - `--no-wait` flag skips server health check

### Changed
- **start.bat** - Improved output with server URL display and clear instructions
- **Installer shortcuts** - All shortcuts now use PACTA.exe launcher with consistent icon
- **GitHub Actions workflow** - Compiles Go launcher with goversioninfo for icon embedding

### Technical Details
- **Files Created:** 10 files (launcher source, build scripts, icons, manifests)
- **Files Modified:** 3 files (workflow, ISS, start.bat)
- **Lines Added:** 440 lines
- **Languages:** Go, Inno Setup Pascal Script, Batch, YAML

### Installer Improvements
- Auto-generates unique JWT_SECRET using GUID during install
- Sets NODE_ENV, PORT, HOSTNAME environment variables for NSSM service
- Configures stdout/stderr logging to `shared/logs/`
- Creates all required directories (data, uploads, logs, config)
- Uninstall cleans up NSSM service and firewall rule

### Security
- JWT_SECRET auto-generated per installation (no default credentials)
- CORS restricted to local origins
- httpOnly cookies for token storage
- Role-based authorization middleware

[Unreleased]: https://github.com/PACTA-Team/pacta_appweb/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/PACTA-Team/pacta_appweb/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/PACTA-Team/pacta_appweb/releases/tag/v0.4.1

## [0.3.1] - 2026-04-08

### Fixed
- **Release build pipeline** - Fixed broken Linux .deb and Windows .exe artifacts

### Linux (.deb)
- Added `EnvironmentFile` to pacta.service for proper .env loading
- Fixed postinst script to install systemd service file to `/etc/systemd/system/`
- Auto-generate JWT_SECRET on install if placeholder detected
- Include `.next/standalone` build output in package (was missing)
- Include `.next/static` and `public` folder for static assets
- Create required directories (data, uploads, logs, config)
- Clean up service file on uninstall

### Windows (.exe)
- Fixed start.bat paths to use correct standalone structure
- Added .env loading via NSSM AppEnvironmentExtra
- Added log file configuration (stdout/stderr)
- Include `.next/static` and proper directory structure

### General
- Added `PORT=3000` to .env.example
- Added build verification step to catch missing standalone early

## [0.2.0-security] - 2026-04-07

### Security
- JWT secret management: fail-hard in production without JWT_SECRET
- Removed hardcoded default credentials
- Server-side route protection via middleware with JWT verification
- httpOnly cookies instead of localStorage for token storage
- Upload endpoint protected with authentication + magic byte validation
- CORS restricted to local origins (127.0.0.1, localhost)
- Role-based authorization middleware (requireRole)
- Error message sanitization in production
- Health endpoint made read-only (no database seeding)
- Password validation strengthened (min 12 chars, complexity)
- Admin approval workflow for new user registrations

### Added
- Setup wizard for initial admin creation
- Pending approval page for new registrations
- GitHub Actions workflow for multi-platform binary builds
- Linux/Windows packaging with systemd/NSSM services

### Tests
- 41 tests passing (auth, seed, middleware, login, register)

[Unreleased]: https://github.com/PACTA-Team/pacta_appweb/compare/v0.2.0-security...HEAD
[0.2.0-security]: https://github.com/PACTA-Team/pacta_appweb/releases/tag/v0.2.0-security
