#!/usr/bin/env sh
# ThermaGuard launcher for macOS / Linux.
set -e
cd "$(dirname "$0")"
docker info >/dev/null 2>&1 || { echo "Docker is not running. Start Docker and try again."; exit 1; }
echo "Building and starting ThermaGuard..."
docker compose up -d --build
echo "Waiting for the dashboard..."
for i in $(seq 1 60); do
  if curl -fs http://localhost:8080/api/v1/health >/dev/null 2>&1; then
    echo "ThermaGuard is running at http://localhost:8080"
    exit 0
  fi
  sleep 2
done
echo "The dashboard did not respond yet. Run 'docker compose logs' for details."
