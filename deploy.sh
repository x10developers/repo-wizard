#!/bin/bash
set -e

APP_DIR="/root/reporeply"
APP_NAME="reporeply"
ENTRY_FILE="src/index.js"
PORT=3000

echo "🚀 Starting deployment..."

cd "$APP_DIR"

echo "📥 Pulling latest code..."
git fetch origin
git reset --hard origin/main

echo "📦 Installing production dependencies..."
npm install --production

echo "🔁 Reloading Nginx..."
nginx -t
systemctl reload nginx

echo "♻️ Restarting Node app with PM2..."

if pm2 list | grep -q "$APP_NAME"; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start "$ENTRY_FILE" --name "$APP_NAME"
fi

pm2 save

echo "⏳ Waiting for app to boot..."
sleep 3

echo "🩺 Health check (local)..."
curl -f "http://127.0.0.1:$PORT/health"

echo "✅ Deployment finished successfully"

pm2 delete reporeply
pm2 start src/index.js --name reporeply
pm2 save
