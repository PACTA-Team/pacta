#!/bin/bash
set -e

INSTALL_DIR="/opt/pacta"
echo "Installing PACTA to $INSTALL_DIR..."

# Create directories
sudo mkdir -p $INSTALL_DIR
sudo cp -r shared/* $INSTALL_DIR/
sudo cp -r linux/* $INSTALL_DIR/

# Install system dependencies
sudo apt update
sudo apt install -y libsqlite3-dev

# Make scripts executable
sudo chmod +x $INSTALL_DIR/start.sh

# Install systemd service
sudo cp $INSTALL_DIR/pacta.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable pacta
sudo systemctl start pacta

echo ""
echo "========================================="
echo "PACTA installed successfully!"
echo "Access at: http://127.0.0.1:3000"
echo "For LAN access: sudo ufw allow 3000/tcp"
echo "========================================="
