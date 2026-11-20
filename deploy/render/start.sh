#!/bin/sh
# Starts the API (which also serves the dashboard) and, optionally, the embedded simulator.
set -e

PORT="${PORT:-10000}"

uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --proxy-headers --forwarded-allow-ips="*" --no-access-log &
API_PID=$!

if [ "${EMBEDDED_SIMULATOR:-true}" = "true" ]; then
  # The simulator posts readings to the HTTP ingest API, exactly like an HTTP-connected device.
  API_URL="http://127.0.0.1:${PORT}" TRANSPORT=http INTERVAL_S="${SIM_INTERVAL_S:-2}" python -m sim.main &
fi

# Exit (so the platform restarts the container) if the API stops.
wait "$API_PID"
