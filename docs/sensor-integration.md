# Connecting real sensors

The simulator publishes exactly what real devices will publish. Replacing it with hardware
needs no backend or dashboard change.

## 1. Register the devices

In the dashboard, open **Admin**:

- Each zone has a **station id** (for example `ST-Z1`). Give the physical station that id.
- Each worker has a **harness id** (for example `V-W001`). Pair the physical harness with the worker.

## 2. Send data

### Option A: MQTT (recommended)

Broker: the computer running ThermaGuard, port `1883`.

| Device | Topic | Payload |
|---|---|---|
| Zone station | `thermaguard/v1/stations/{station_id}/env` | `{"air_temp_c": 38.2, "rh_pct": 31.5, "globe_temp_c": 51.0, "wind_ms": 1.8}` |
| Harness | `thermaguard/v1/vests/{vest_id}/telemetry` | `{"skin_temp_c": 34.6, "battery_pct": 82, "pcm_temp_c": 26.9}` |

Only `air_temp_c` + `rh_pct` (station) and `skin_temp_c` (harness) are required. A `ts`
field (ISO-8601 UTC) is optional; without it the server time is used.

Test from a terminal (with Docker running):

```powershell
docker compose exec mosquitto mosquitto_pub -t thermaguard/v1/vests/V-W001/telemetry -m '{\"skin_temp_c\": 36.8}'
```

### Option B: HTTP

```powershell
curl.exe -X POST http://localhost:8000/api/v1/ingest/vest -H "Content-Type: application/json" -d '{\"vest_id\": \"V-W001\", \"skin_temp_c\": 36.8}'
```

Interactive API documentation: http://localhost:8000/docs

## 3. Stop the simulator

```powershell
docker compose stop simulator
```

(or switch it off on the **Simulator** page). Readings outside valid ranges are rejected
and logged, so a faulty sensor cannot corrupt the dashboard.

## Reference firmware

`firmware/vest_node` (ESP32 + DS18B20, optional second probe on a PCM pack) and
`firmware/zone_station` (ESP32 + SHT31 + black-globe thermometer per ISO 7243) are ready
to flash with the Arduino IDE. Set Wi-Fi, broker address and device id at the top of each sketch.

## Production hardening checklist

- Enable MQTT username/password and TLS in `mosquitto/mosquitto.conf`.
- Put the dashboard behind the company SSO / login.
- Move from SQLite to PostgreSQL (set `DATABASE_URL`).
