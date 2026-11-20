# Deploying to Render (free plan)

ThermaGuard deploys to [Render](https://render.com) as **one free web service** built from the
root `Dockerfile`:

- The FastAPI backend serves the API, the WebSocket **and** the built dashboard from one URL.
- The simulator runs inside the same container and posts readings to the HTTP ingest API.
- Render's free plan only exposes HTTP, so MQTT is switched off in this mode. Real devices
  send data with `POST /api/v1/ingest/env` and `POST /api/v1/ingest/vest`
  (see [sensor-integration.md](sensor-integration.md)).

Local development is unchanged: `docker compose up` still runs the full four-service stack with the MQTT broker.

## Steps

1. **Push the code** to your GitHub repository (it must include `Dockerfile` and `render.yaml` at the root).
2. Sign in at https://dashboard.render.com with GitHub.
3. Click **New +** → **Blueprint**.
4. Connect your GitHub account if asked, and pick the **ThermaGuard** repository. Grant Render access to it if it's private.
5. Render reads `render.yaml` and shows one service, **thermaguard** (Docker, Free). Click **Apply** / **Deploy Blueprint**.
6. Wait for the first build (about 5–10 minutes). The log ends with `Your service is live`.
7. Open the URL Render shows, e.g. `https://thermaguard-xxxx.onrender.com`.
   - Dashboard: `/`
   - API docs: `/docs`
   - Health: `/api/v1/health`

Every later `git push` to the main branch redeploys automatically.

**Without the Blueprint:** choose **New +** → **Web Service** → your repo, set *Language* to
**Docker**, *Instance type* to **Free**, and *Health Check Path* to `/api/v1/health`. Leave the
Dockerfile path as `./Dockerfile`.

## What to expect on the free plan

| Behaviour | Why | Effect |
|---|---|---|
| The service **sleeps after 15 minutes** without visitors | Free-plan policy | The first visit afterwards takes about 30–60 s to wake up. Open the URL a minute before a demo. |
| Data **resets** after a sleep, restart or redeploy | Free services have no persistent disk; SQLite lives in the container | The demo site is re-seeded automatically, so the dashboard is never empty. |
| No MQTT | Only HTTP traffic is routed | Devices use the HTTP ingest endpoints. |

For a permanent deployment, use a paid instance with a persistent disk (or set `DATABASE_URL`
to a managed PostgreSQL database), and add authentication in front of the dashboard.

## Settings

Change these under the service's **Environment** tab (a redeploy follows automatically):

| Variable | Default | Meaning |
|---|---|---|
| `SITE_NAME` | ThermaGuard Demo Site, Dammam | Name shown in the dashboard |
| `SIM_SCENARIO` | normal_day | Starting simulator scenario |
| `SIM_SPEED` | 5 | Starting simulator clock speed (1–20) |
| `EMBEDDED_SIMULATOR` | true | Set to `false` when real devices send data |

## Test the production image locally

```powershell
docker build -t thermaguard-render .
docker run --rm -p 10000:10000 thermaguard-render
```

Open http://localhost:10000, then in a second terminal run `python scripts/smoke_test.py http://localhost:10000`.
