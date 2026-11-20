# ThermaGuard

**Heat-stress decision support for construction sites, built around the Smart PCM Cooling Harness.**

ThermaGuard combines one environmental station per work zone (air temperature, humidity,
WBGT) with a skin-temperature sensor on each worker's PCM harness. Supervisors drill down
from the whole site, to a zone, to a single worker, and get clear guidance: work-rest
schedules per work intensity, workers who need attention and *why*, and reminders such as
"replace PCM packs" or "harness offline".

> ThermaGuard supports supervisor decisions. It is not a medical device and does not diagnose heat illness.

---

## Run it locally, from clone to dashboard

### Prerequisites (install once)

| Tool | Why | Get it |
|---|---|---|
| **Git** | download the code | https://git-scm.com/downloads |
| **Docker Desktop** | runs every part of ThermaGuard; nothing else (Python, Node) is needed | https://www.docker.com/products/docker-desktop |

After installing Docker Desktop, open it and wait until it shows **Engine running**.

### Step 1: clone the repository

```powershell
git clone https://github.com/Sodiq179/ThermaGuard.git
cd ThermaGuard
```

The repository is private, so Git asks you to sign in to GitHub the first time (a browser window opens).

### Step 2: start ThermaGuard

**Windows:** right-click `start.ps1` and choose **Run with PowerShell**, or in a terminal:

```powershell
docker compose up -d --build
```

**macOS / Linux:**

```sh
./start.sh
```

The first start downloads base images and builds everything, which can take 3 to 10 minutes
depending on your internet. Later starts take seconds.

### Step 3: open the dashboard

Go to **http://localhost:8080**. The built-in simulator starts automatically, so you see live
data without any hardware.

### Step 4 (optional): check that everything works

```powershell
python scripts/smoke_test.py
```

You should see `9/9 checks passed`. This needs Python 3.10 or newer, with no extra packages.

### Stopping and resetting

```powershell
docker compose down        # stop, keep data
docker compose down -v     # stop and wipe data (fresh demo site next start)
```

On Windows, `.\stop.ps1` and `.\stop.ps1 -Reset` do the same.

### Getting the latest changes

```powershell
git pull
docker compose up -d --build
```

| What | Where |
|---|---|
| Dashboard | http://localhost:8080 |
| Interactive API docs | http://localhost:8000/docs |
| MQTT broker for devices | `localhost:1883` |


---

## Demo walkthrough (5 minutes)

1. **Overview**: four zones of a Dammam site, coloured by WBGT heat band, live site WBGT trend and alert feed.
2. Open **Simulator** and pick a scenario:
   - *Hot zone escalation*: the Tower Crane Deck heats up; watch its band climb and heavy work switch to *Stop work*.
   - *Worker overheating*: Omar Farouk (W003) skin temperature climbs; his attention score rises to *Act now* with a toast.
   - *Midday peak*, *Sensor dropout*, *Normal working day*.
   Use the speed slider (1-20x) to move the scenario clock faster.
3. Click a **zone**: work-rest recommendation for light / moderate / heavy work (ACGIH table), the zone's workers sorted by attention, and group actions (*Start zone break*, *Set zone intensity*).
4. Click a **worker**: attention score with the factor breakdown explaining the flag, skin temperature against zone WBGT, exposure timeline, PCM pack and battery state, and actions (break, check out, intensity).
5. **Alerts**: acknowledge or resolve. Alerts also clear automatically when the condition ends.
6. **How it works**: the standards and thresholds behind every decision.

---

## How decisions are made

**Zone (overall heat assessment).** WBGT per ISO 7243 (outdoor):
`WBGT = 0.7·Tnw + 0.2·Tg + 0.1·Ta`. Stations without a globe thermometer get an estimated
WBGT (Australian BoM approximation) that is labelled *estimated* in the UI. WBGT maps to five
bands (Low to Extreme) and, per work intensity, to the ACGIH TLV work-rest table for
acclimatized workers. The Saudi midday outdoor work ban (12:00-15:00, 15 June-15 September)
is shown and enforced as an alert.

**Worker (personal attention flag, no heart rate).** A zero-order Sugeno fuzzy rule system scores 0-100 from:
skin temperature, its rate of rise, continuous exposure relative to the zone's recommended
work time, and zone WBGT relative to the reference for the worker's intensity. Levels:
*Normal, Watch, Attention, Act now*. Every flag lists its contributing factors.

All thresholds live in [`backend/config/thresholds.yaml`](backend/config/thresholds.yaml) and can be tuned without code changes.

---

## Architecture

```
 Zone stations ─┐   MQTT  thermaguard/v1/stations/{id}/env
 PCM harnesses ─┼──────►  ┌───────────┐      ┌─────────────────────────────┐      ┌───────────────┐
 Simulator ─────┘   or    │ Mosquitto │ ───► │ Backend (FastAPI)           │ ◄──► │ Dashboard     │
                    HTTP  └───────────┘      │  validate → WBGT → store    │ REST │ React + nginx │
             POST /api/v1/ingest/* ────────► │  OHS + PMS logic → alerts   │  WS  │ :8080         │
                                             │  SQLite (volume)            │      └───────────────┘
                                             └─────────────────────────────┘
```

| Service | Tech | Role |
|---|---|---|
| `mosquitto` | Eclipse Mosquitto 2 | MQTT broker, entry point for real devices |
| `backend` | Python 3.12, FastAPI, SQLAlchemy, paho-mqtt | Ingestion (MQTT + HTTP share one pipeline), heat logic, alerts, REST API, WebSocket push |
| `simulator` | Python | Publishes realistic station and harness data over MQTT, same as real devices |
| `frontend` | React 18, TypeScript, Vite, Tailwind, React Query, Recharts, nginx | Dashboard; nginx proxies `/api` and `/ws` to the backend |

Live updates: the backend re-evaluates state when data arrives (at most once per second, and
every 5 s for time-based conditions), then pushes a refresh signal and new alerts over `/ws`.

## Connecting real sensors

See [docs/sensor-integration.md](docs/sensor-integration.md). In short: give each device the
station or harness id shown in **Admin**, publish JSON to the MQTT topics above (or POST to
the HTTP ingest endpoints), and stop the simulator. Reference ESP32 sketches are in
[`firmware/`](firmware). The API contract is in [docs/api.md](docs/api.md).

---

## Project structure

```
ThermaGuard/
├─ docker-compose.yml          one command runs everything
├─ start.ps1 / start.sh        one-click launchers;  stop.ps1 to stop
├─ .env.example                ports, site name, simulator defaults
├─ backend/
│  ├─ app/
│  │  ├─ domain/               pure heat logic: wbgt, work_rest, attention, exposure, thresholds
│  │  ├─ services/             read model (state.py), supervisor commands, alert engine
│  │  ├─ ingestion/            shared pipeline + MQTT consumer
│  │  ├─ api/                  REST routes (read, actions, admin, ingest/sim)
│  │  ├─ realtime/             WebSocket hub and evaluation loop
│  │  └─ main.py, container.py, models.py, schemas.py, seed.py
│  ├─ config/thresholds.yaml   every threshold, editable
│  └─ tests/                   unit + API tests
├─ simulator/                  scenarios, harness model, MQTT/HTTP transports, tests
├─ frontend/                   React dashboard (src/api, components, pages, lib)
├─ firmware/                   reference ESP32 sketches (harness, zone station)
├─ mosquitto/                  broker config
├─ scripts/smoke_test.py       end-to-end check of a running stack
└─ docs/                       API contract, sensor integration guide
```

## Testing

```powershell
# Backend unit + API tests (46)
cd backend; pip install -r requirements-dev.txt; python -m pytest -q

# Simulator tests (7)
cd simulator; pip install -r requirements.txt pytest; python -m pytest -q

# Frontend type-check, unit tests and production build
cd frontend; npm ci; npm run typecheck; npm test; npm run build

# End-to-end, against the running Docker stack (standard library only)
python scripts/smoke_test.py
```

## Worker photos

The demo ships placeholder portraits for the 12 demo workers (from randomuser.me; they do not depict real workers). Workers without a photo show their initials.
To use real photos, put `W001.jpg`, `W002.jpg`, ... in [`frontend/public/avatars/`](frontend/public/avatars) and run `docker compose up -d --build frontend`. Only add photos with the worker's consent.

## Configuration

Copy `.env.example` to `.env` to change ports, the site name or the simulator's starting scenario and speed.
Thresholds: `backend/config/thresholds.yaml` (restart the backend after editing:
`docker compose restart backend`).

## Troubleshooting

| Problem | Fix |
|---|---|
| `docker: command not found` / cannot connect | Start Docker Desktop and wait for *Running*. |
| Port 8080, 8000 or 1883 already in use | Set `WEB_PORT`, `API_PORT` or `MQTT_PORT` in `.env`. |
| Dashboard shows *Reconnecting* | `docker compose ps` should show all services up; `docker compose logs backend`. |
| Want a clean demo | `.\stop.ps1 -Reset`, then `.\start.ps1`. |

## Known limits and next steps

- No login in this version (demo mode). Add SSO before a site rollout.
- SQLite fits a single site; switch `DATABASE_URL` to PostgreSQL for larger deployments.
- WBGT without a globe thermometer is an estimate and is labelled as one.
- The simulator's harness model is demo-grade, not a validated thermophysiological model.
