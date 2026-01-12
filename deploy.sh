#!/bin/bash
set -e

cd /root/reporeply

echo "Pulling latest code..."
git fetch origin
git reset --hard origin/main

echo "Installing dependencies..."
npm install --production

echo "Reloading nginx..."
nginx -t
systemctl reload nginx

echo "Restarting app..."
pm2 restart reporeply --update-env

echo "Deployment finished successfully"
