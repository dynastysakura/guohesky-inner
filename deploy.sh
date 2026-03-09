#!/bin/bash
set -e

IMAGE="ccr.ccs.tencentyun.com/guohesky/guohesky-inner"
TAG="${1:-latest}"

echo "==> Building image..."
DOCKER_BUILDKIT=1 docker build --platform linux/amd64 --progress=plain -f Dockerfile.prod -t "$IMAGE:$TAG" -t "$IMAGE:latest" .

echo "==> Image size:"
docker image ls "$IMAGE:$TAG" --format "{{.Size}}"

echo "==> Pushing to TCR..."
docker push "$IMAGE:$TAG"
if [ "$TAG" != "latest" ]; then
  docker push "$IMAGE:latest"
fi

echo "==> Done! On server run:"
echo "    cd ~/guohesky && docker compose pull nocobase && docker compose up -d nocobase"
