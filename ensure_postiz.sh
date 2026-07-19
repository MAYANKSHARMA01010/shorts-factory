#!/usr/bin/env bash
# ====== ensure_postiz.sh — macOS equivalent of ensure_postiz.ps1 ======
# Makes sure Docker daemon + Postiz stack are running.
# The pipeline reads YouTube creds from the Postiz container env + Postgres.
# If you're NOT using Postiz, comment out this whole script and set YOUTUBE_*
# env vars directly in your .env file.

set -euo pipefail
POSTIZ_DIR="${POSTIZ_DIR:-$HOME/postiz-app}"  # override with env var if your Postiz lives elsewhere

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# 1) Check Docker daemon is running
if ! docker info > /dev/null 2>&1; then
  log "Docker daemon not running → launching Docker Desktop"
  open -a "Docker"
  deadline=$(($(date +%s) + 240))
  while ! docker info > /dev/null 2>&1; do
    if [ "$(date +%s)" -gt "$deadline" ]; then
      log "ERROR: Docker still not running after 4 min"
      exit 1
    fi
    sleep 5
  done
fi
log "Docker is up"

# 2) Start Postiz stack (no-op if already running)
if [ -f "$POSTIZ_DIR/docker-compose.yaml" ]; then
  pushd "$POSTIZ_DIR" > /dev/null
  docker compose -f docker-compose.yaml up -d
  popd > /dev/null
  log "Postiz stack started (or was already running)"
else
  log "WARNING: Postiz dir not found at $POSTIZ_DIR — set POSTIZ_DIR env var to your postiz-app directory"
fi

# 3) Wait for Postgres to be ready
deadline=$(($(date +%s) + 120))
ready=false
while [ "$(date +%s)" -lt "$deadline" ]; do
  if docker exec postiz-postgres pg_isready -U postiz-user -d postiz-db-local > /dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 4
done
log "Postiz DB ready: $ready"
