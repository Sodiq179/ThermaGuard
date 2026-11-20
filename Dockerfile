# Single-container image for platforms that run one container per service (e.g. Render).
# Local development uses docker-compose.yml instead (separate broker, backend, simulator, nginx).

# ---- 1. Build the dashboard -------------------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. Runtime: API + dashboard + embedded simulator ----------------------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=10000 \
    STATIC_DIR=/app/static \
    DATABASE_URL=sqlite:////app/data/thermaguard.db \
    MQTT_ENABLED=false \
    EMBEDDED_SIMULATOR=true

WORKDIR /app
COPY backend/requirements.txt backend-requirements.txt
COPY simulator/requirements.txt simulator-requirements.txt
RUN pip install -r backend-requirements.txt -r simulator-requirements.txt

COPY backend/app ./app
COPY backend/config ./config
COPY simulator/sim ./sim
COPY --from=frontend /frontend/dist ./static
COPY deploy/render/start.sh ./start.sh

RUN sed -i 's/\r$//' start.sh && chmod +x start.sh \
    && useradd --create-home --uid 1000 thermaguard \
    && mkdir -p /app/data && chown thermaguard /app/data
USER thermaguard

EXPOSE 10000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=5 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\", \"10000\")}/api/v1/health')" || exit 1

CMD ["./start.sh"]
