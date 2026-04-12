# PACTA — Linux Installation Guide (Production)

This guide covers installing PACTA on Linux servers for production use. It includes systemd service configuration, reverse proxy setup, and firewall rules.

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU       | 1 core  | 2 cores     |
| RAM       | 512 MB  | 1 GB        |
| Disk      | 100 MB  | 500 MB      |
| OS        | Debian 11+, Ubuntu 22.04+, RHEL 9+, Alpine 3.18+ | Same |
| Kernel    | 5.10+   | 6.1+        |

PACTA is a single static binary with zero runtime dependencies. It works on any Linux distribution that supports the target architecture.

---

## Method A: Debian Package (Recommended for Debian/Ubuntu)

### 1. Download the .deb package

```bash
VERSION="0.18.0"
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_linux_amd64.deb"
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_checksums.txt"
```

### 2. Verify checksums

```bash
sha256sum -c pacta_${VERSION}_checksums.txt --ignore-missing
```

Expected output:
```
pacta_${VERSION}_linux_amd64.deb: OK
```

### 3. Install

```bash
sudo dpkg -i pacta_${VERSION}_linux_amd64.deb
```

### 4. Verify installation

```bash
pacta --version
```

Expected output: `v0.18.0`

---

## Method B: Generic Tarball (Any Linux Distribution)

### 1. Download the tarball

```bash
VERSION="0.18.0"
ARCH="amd64"  # or "arm64"
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_linux_${ARCH}.tar.gz"
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_checksums.txt"
```

### 2. Verify checksums

```bash
sha256sum -c pacta_${VERSION}_checksums.txt --ignore-missing
```

### 3. Extract and install

```bash
tar xzf pacta_${VERSION}_linux_${ARCH}.tar.gz
sudo mv pacta /usr/local/bin/pacta
sudo chmod +x /usr/local/bin/pacta
```

### 4. Verify installation

```bash
pacta --version
```

---

## Running as a systemd Service

### 1. Create the service file

```bash
sudo tee /etc/systemd/system/pacta.service > /dev/null << 'EOF'
[Unit]
Description=PACTA Contract Management System
Documentation=https://github.com/PACTA-Team/pacta
After=network.target

[Service]
Type=simple
User=pacta
Group=pacta
ExecStart=/usr/local/bin/pacta
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pacta

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/pacta

[Install]
WantedBy=multi-user.target
EOF
```

### 2. Create the pacta user and data directory

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin pacta
sudo mkdir -p /var/lib/pacta
sudo chown pacta:pacta /var/lib/pacta
```

### 3. Enable and start the service

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pacta
sudo systemctl status pacta
```

### 4. View logs

```bash
sudo journalctl -u pacta -f --no-pager
```

---

## Reverse Proxy Configuration

PACTA listens on `127.0.0.1:3000` by default. For production access, configure a reverse proxy with HTTPS.

### Option 1: Caddy (Recommended — Automatic HTTPS)

Install Caddy: https://caddyserver.com/docs/install

Create `/etc/caddy/Caddyfile`:

```
pacta.example.com {
    reverse_proxy 127.0.0.1:3000

    encode gzip
    log {
        output file /var/log/caddy/pacta-access.log
    }
}
```

Reload Caddy:
```bash
sudo systemctl reload caddy
```

Caddy automatically obtains and renews Let's Encrypt SSL certificates.

### Option 2: Nginx

Install Nginx: `sudo apt install nginx` (Debian/Ubuntu) or `sudo dnf install nginx` (RHEL/Fedora)

Create `/etc/nginx/sites-available/pacta`:

```nginx
server {
    listen 80;
    server_name pacta.example.com;

    # Redirect HTTP to HTTPS (after SSL is configured)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pacta.example.com;

    ssl_certificate     /etc/ssl/certs/pacta.example.com.crt;
    ssl_certificate_key /etc/ssl/private/pacta.example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/pacta /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Firewall Configuration

### UFW (Debian/Ubuntu)

```bash
# Allow HTTPS
sudo ufw allow 443/tcp
# Allow HTTP (for Let's Encrypt validation)
sudo ufw allow 80/tcp
sudo ufw reload
```

### firewalld (RHEL/Fedora/CentOS)

```bash
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

---

## Post-Installation Verification

1. Check the service is running:
   ```bash
   sudo systemctl status pacta
   ```

2. Test local access:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000
   ```
   Expected: `200`

3. Test proxy access:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" https://pacta.example.com
   ```
   Expected: `200`

4. Open your browser and navigate to `https://pacta.example.com`

5. Log in with default credentials:
   - Email: `admin@pacta.local`
   - Password: `admin123`

---

## Updating PACTA

### Debian Package

```bash
VERSION="0.19.0"  # New version
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_linux_amd64.deb"
sudo dpkg -i pacta_${VERSION}_linux_amd64.deb
sudo systemctl restart pacta
pacta --version
```

### Tarball

```bash
VERSION="0.19.0"  # New version
wget "https://github.com/PACTA-Team/pacta/releases/download/v${VERSION}/pacta_${VERSION}_linux_amd64.tar.gz"
tar xzf pacta_${VERSION}_linux_amd64.tar.gz
sudo mv pacta /usr/local/bin/pacta
sudo systemctl restart pacta
pacta --version
```

> **Note:** Database migrations are applied automatically on startup. No manual migration steps are needed.

---

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u pacta -n 50 --no-pager

# Check if port 3000 is in use
sudo ss -tlnp | grep 3000

# Check file permissions
ls -la /usr/local/bin/pacta
ls -la /var/lib/pacta
```

### Port already in use

If another process is using port 3000, set the `PACTA_PORT` environment variable:

```bash
# Edit the systemd service file
sudo systemctl edit pacta

# Add:
[Service]
Environment=PACTA_PORT=8080

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart pacta
```

### Database corruption

PACTA uses SQLite. If the database becomes corrupted:

```bash
# Stop the service
sudo systemctl stop pacta

# Backup the database
sudo cp /var/lib/pacta/pacta.db /var/lib/pacta/pacta.db.bak

# Remove and restart (creates fresh database)
sudo rm /var/lib/pacta/pacta.db
sudo systemctl start pacta
```

### Reverse proxy returns 502

```bash
# Verify PACTA is running
curl -v http://127.0.0.1:3000

# Check proxy configuration
sudo nginx -t  # or sudo caddy validate

# Check SELinux (RHEL/Fedora)
sudo setsebool -P httpd_can_network_connect 1
```
