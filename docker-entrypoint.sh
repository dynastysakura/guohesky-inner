#!/bin/sh
set -e

cd /app

echo "==> Running postinstall..."
yarn nocobase postinstall

echo "==> Checking database connection..."
yarn nocobase db:auth --retry 30

echo "==> Installing / upgrading NocoBase..."
yarn nocobase install
yarn nocobase upgrade

echo "==> Starting NocoBase..."
yarn start
