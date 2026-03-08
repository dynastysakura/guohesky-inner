#!/bin/bash
set -e

IMAGE="ccr.ccs.tencentyun.com/guohesky/guohesky-inner"
TAG="${1:-latest}"

echo "==> Building image..."
docker build -f Dockerfile.prod -t "$IMAGE:$TAG" -t "$IMAGE:latest" .

echo "==> Pushing to TCR..."
docker push "$IMAGE:$TAG"
docker push "$IMAGE:latest"

echo "==> Done! On server run:"
echo "    cd ~/guohesky && docker compose pull nocobase && docker compose up -d nocobase"
