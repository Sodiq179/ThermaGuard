"""End-to-end smoke test against a running stack (``docker compose up``).

Run:  python scripts/smoke_test.py [base_url]
Default base_url is http://localhost:8080 (the dashboard, proxied to the API).
Uses only the Python standard library.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
API = f"{BASE}/api/v1"


def call(method: str, path: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = resp.read()
        return resp.status, (json.loads(raw) if raw else None)


def check(name: str, condition: bool, detail: str = "") -> bool:
    print(f"  [{'PASS' if condition else 'FAIL'}] {name}{' - ' + detail if detail else ''}")
    return condition


def main() -> int:
    print(f"ThermaGuard smoke test against {BASE}")
    results = []
    _, health = call("GET", "/health")
    results.append(check("API healthy", health["status"] == "ok"))
    results.append(check("Backend connected to MQTT broker", health["mqtt_connected"]))

    deadline = time.time() + 60
    overview = None
    while time.time() < deadline:
        _, overview = call("GET", "/overview")
        if all(z["env"] for z in overview["zones"]):
            break
        time.sleep(2)
    results.append(check("Every zone receives station data over MQTT",
                         all(z["env"] for z in overview["zones"]), f"{len(overview['zones'])} zones"))
    results.append(check("Work-rest recommendations computed",
                         all(len(z["recommendations"]) == 3 for z in overview["zones"])))

    _, workers = call("GET", "/workers")
    on_shift = [w for w in workers if w["status"] != "off"]
    results.append(check("Harness data arriving for workers on shift",
                         all(w["skin_temp_c"] is not None for w in on_shift), f"{len(on_shift)} workers"))

    status, _ = call("POST", "/ingest/env", {"station_id": "ST-SMOKE", "air_temp_c": 40, "rh_pct": 20})
    results.append(check("HTTP ingestion accepted", status == 202))

    target = on_shift[0]["id"]
    _, w = call("POST", f"/workers/{target}/break/start")
    results.append(check("Supervisor can start a break", w["status"] == "break"))
    _, w = call("POST", f"/workers/{target}/break/end")
    results.append(check("Supervisor can end a break", w["status"] == "working"))

    _, alerts = call("GET", "/alerts")
    results.append(check("Alert engine running", isinstance(alerts, list), f"{len(alerts)} open alerts"))

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
