#!/usr/bin/env python3
"""A pretend ESP32 for trying the hardware demo without any hardware.

!! Every number this prints is SYNTHETIC. It exists to exercise the device contract (README, "Device
!! API") against a LOCAL backend. Never point it at the production site, and never present its values as
!! measurements.

    GRIDNOVA_DEVICE_KEYS=esp32-demo-01:<24+ chars> uvicorn gridnova.main:app      # in backend/
    GRIDNOVA_URL=http://127.0.0.1:8000 DEVICE_ID=esp32-demo-01 DEVICE_KEY=<same key> python hardware/tools/mock_device.py

Standard library only. It follows the same rules the real firmware must: only the four allow-listed
commands, ignore expired commands, never switch the critical branch off, break-before-make on the source,
latch an emergency stop until told to clear it.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = os.environ.get("GRIDNOVA_URL", "http://127.0.0.1:8000").rstrip("/")
DEVICE_ID = os.environ.get("DEVICE_ID", "esp32-demo-01")
KEY = os.environ.get("DEVICE_KEY", "")
PERIOD_S = float(os.environ.get("PERIOD_S", "2"))

if not KEY:
    sys.exit("Set DEVICE_KEY to the key you put in GRIDNOVA_DEVICE_KEYS on the local backend.")
if urllib.parse.urlparse(BASE).hostname not in ("127.0.0.1", "localhost", "::1"):
    sys.exit("Refusing to run the mock against a remote site. Use a local backend.")

LOADS = ["critical", "hostel", "library", "extra"]
# Synthetic rig state
state = {"source": "adapter", "loads": {"critical": True, "hostel": True, "library": True, "extra": False}, "estop": False}
boot, seq = uuid.uuid4().hex[:12], 0


def call(method, path, body=None):
    req = urllib.request.Request(
        BASE + path, method=method, data=None if body is None else json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-Device-Id": DEVICE_ID, "Authorization": f"Bearer {KEY}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def readings():
    """Synthetic: 0.1 A per lit branch on whichever source is selected, the other side idle."""
    amps = round(0.1 * sum(state["loads"].values()), 3)
    active, idle = {"voltageV": 5.0, "currentA": amps}, {"voltageV": 5.1, "currentA": 0.0}
    return (active, idle) if state["source"] == "adapter" else (idle, active)


def telemetry():
    global seq
    seq += 1
    adapter, battery = readings()
    return {
        "deviceId": DEVICE_ID, "bootId": boot, "seq": seq, "ts": time.time(), "firmware": "mock-0.1",
        "source": state["source"], "adapter": adapter, "battery": battery, "loads": state["loads"],
        "health": {"ina219Adapter": "ok", "ina219Battery": "ok", "muxInterlock": "ok"}, "estop": state["estop"],
    }


def execute(cmd):
    """Returns (result, reason). Mirrors the firmware: validate everything, trust nothing."""
    if cmd["expiresAtEpoch"] < time.time():
        return "rejected", "expired before it was run"
    t, p = cmd["type"], cmd.get("params", {})
    if t == "estop":
        state["estop"] = True
        state["loads"] = {k: False for k in LOADS}
        return "applied", None
    if t == "clear_estop":
        state["estop"] = False  # loads stay off until commanded
        return "applied", None
    if state["estop"]:
        return "rejected", "emergency stop is latched"
    if t == "select_source" and p.get("source") in ("adapter", "powerbank"):
        time.sleep(0.1)  # break-before-make: both sources off, then the new one on
        state["source"] = p["source"]
        return "applied", None
    if t == "set_load" and p.get("load") in LOADS and isinstance(p.get("on"), bool):
        if p["load"] == "critical" and not p["on"]:
            return "rejected", "the critical branch is never switched off"
        state["loads"][p["load"]] = p["on"]
        return "applied", None
    return "rejected", "not on the allow-list"


def main():
    print(f"MOCK device {DEVICE_ID} -> {BASE} (synthetic values)")
    while True:
        code, body = call("POST", "/api/hardware/device/telemetry", telemetry())
        if code != 200:
            print("telemetry:", code, body)
        else:
            if body["control"]["estop"] and not state["estop"]:
                state["estop"], state["loads"] = True, {k: False for k in LOADS}
            code, body = call("GET", "/api/hardware/device/commands")
            for cmd in body.get("commands", []) if code == 200 else []:
                result, reason = execute(cmd)
                ack = {"deviceId": DEVICE_ID, "result": result, "reason": reason, "ts": time.time(), "source": state["source"], "loads": state["loads"]}
                print(cmd["type"], cmd.get("params"), "->", result, reason or "", call("POST", f"/api/hardware/device/commands/{cmd['id']}/ack", ack)[0])
        time.sleep(PERIOD_S)


if __name__ == "__main__":
    main()
