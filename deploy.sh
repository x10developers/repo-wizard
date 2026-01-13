#!/bin/bash
set -e

APP_DIR="/root/reporeply"
APP_NAME="reporeply"
ENTRY_FILE="index.js"
PORT=3000

echo "Initializing System..."

cd "$APP_DIR"

echo "Downloading latest version..."
git fetch origin
git reset --hard origin/main

echo "Installing filesystem codebase ..."
npm install

echo "Reloading Nginx..."
nginx -t
systemctl reload nginx

echo "Rebooting app with PM2..."
pm2 stop "$APP_NAME" || true
pm2 start "$ENTRY_FILE" --name "$APP_NAME" --update-env
pm2 save

echo "Waiting for system reboot..."
sleep 5

echo "Checking Routes Health in local..."
curl -f "http://127.0.0.1:$PORT/health"

echo "System Update finished successfully"
