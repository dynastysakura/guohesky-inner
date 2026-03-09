#!/bin/sh
set -e

cd /app

echo "==> Running postinstall..."
yarn nocobase postinstall

echo "==> Checking database connection..."
yarn nocobase db:auth --retry 30

echo "==> Starting NocoBase..."
yarn start --quickstart
