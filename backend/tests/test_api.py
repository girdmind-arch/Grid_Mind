"""End-to-end checks of the API contract the website relies on."""

import pytest
from fastapi.testclient import TestClient

from gridmind import campus as c
from gridmind.main import app


@pytest.fixture()
def client():
    with TestClient(app) as cl:
        cl.post("/api/scenarios/clear")
        cl.post("/api/control/mode", json={"mode": "ai"})
        yield cl


def test_grid_state_balances(client):
    g = client.get("/api/grid/state").json()
    supply = g["solarKw"] + max(0, -g["battery"]["powerKw"]) + g["gridImportKw"]
    assert abs(supply - g["demandKw"]) <= 3  # rounding only
    assert len(g["zones"]) == 8
    assert 20 <= g["battery"]["socPct"] <= 90
    assert g["tariff"]["slab"] in {"off-peak", "normal", "peak"}


def test_forecast_shape(client):
    f = client.get("/api/forecast").json()
    assert f["horizonHours"] == 12 and len(f["points"]) == 12
    assert {"time", "demandKw", "solarKw", "tariffInr"} <= f["points"][0].keys()


@pytest.mark.parametrize("fault", ["cloud_cover", "heatwave", "line_failure"])
def test_scenarios_pick_a_safe_plan(client, fault):
    client.post("/api/scenarios/inject", json={"type": fault, "severity": 3, "durationMin": 30})
    d = client.post("/api/agents/commander/step").json()
    assert d["chosenPlanId"] in {"A", "B"}
    assert [s["kind"] for s in d["steps"]] == ["observe", "reason", "plan", "safety", "act", "result"]
    assert d["outcome"]["recoveryMin"] < d["outcome"]["baselineMin"]
    g = client.get("/api/grid/state").json()
    assert g["activeFault"]["mitigated"] is True
    # Guardrail G1: labs never lose power.
    assert all(z["demandKw"] > 0 for z in g["zones"] if z["kind"] == "lab")


def test_line_failure_reroutes_within_feeder_limit(client):
    client.post("/api/scenarios/inject", json={"type": "line_failure", "severity": 3, "durationMin": 30})
    d = client.post("/api/agents/commander/step").json()
    assert d["chosenPlanId"] == "B"
    narmada = next(z for z in client.get("/api/grid/state").json()["zones"] if z["id"] == "hostel-narmada")
    assert narmada["status"] == "reduced" and narmada["demandKw"] > 0


def test_replay_is_faster_and_reuses_the_lesson(client):
    times = []
    for _ in range(2):
        client.post("/api/scenarios/clear")
        client.post("/api/scenarios/inject", json={"type": "cloud_cover", "severity": 3, "durationMin": 30})
        d = client.post("/api/agents/commander/step").json()
        times.append(d["outcome"]["recoveryMin"])
    assert times[1] < times[0]
    assert d["outcome"].get("lessonApplied")


def test_grid_outage_waits_for_approval(client):
    client.post("/api/scenarios/inject", json={"type": "grid_outage", "severity": 3, "durationMin": 30})
    d = client.post("/api/agents/commander/step").json()
    assert d["approval"]["status"] == "pending"
    assert client.get("/api/grid/state").json()["activeFault"]["mitigated"] is False
    d2 = client.post(f"/api/agents/decisions/{d['id']}/approval", json={"decision": "modify", "optionId": "0.5"}).json()
    assert d2["approval"]["status"] == "modified"
    g = client.get("/api/grid/state").json()
    assert g["gridImportKw"] == 0 and g["activeFault"]["mitigated"] is True
    hostels = [z for z in g["zones"] if z["kind"] == "hostel"]
    assert all(z["status"] == "reduced" for z in hostels)
    # A second answer to the same decision is refused.
    assert client.post(f"/api/agents/decisions/{d['id']}/approval", json={"decision": "approve"}).status_code == 404


def test_results_are_consistent(client):
    r = client.get("/api/results").json()
    gm = sum(p["gridmind"] for p in r["cost"])
    base = sum(p["baseline"] for p in r["cost"])
    assert abs((1 - gm / base) * 100 - r["headline"]["costSavedPct"]) < 0.2
    assert r["headline"]["peakReducedPct"] > 10
    assert r["runs"][2]["recoveryMin"] == r["headline"]["recovery"]["gridmindMin"]
    assert [x["run"] for x in r["runs"]] == [1, 2, 3]


def test_goal_and_mode(client):
    ack = client.post("/api/goal", json={"goal": "Prepare for a storm"}).json()
    assert "60%" in ack["interpretation"]
    client.post("/api/goal", json={"goal": "Keep labs at full power and keep tonight's bill low."})
    assert client.post("/api/control/mode", json={"mode": "manual"}).json()["mode"] == "manual"
    assert client.get("/api/grid/state").json()["mode"] == "manual"


def test_memory_and_agents(client):
    m = client.get("/api/memory").json()
    assert len(m["incidents"]) >= 4 and m["lessons"]
    agents = client.get("/api/agents").json()
    assert {a["id"] for a in agents} == {"commander", "forecaster", "zone", "planner", "fault", "critic", "guardrail"}
    assert len(client.get("/api/guardrails").json()) == 6


def test_bad_input_is_rejected(client):
    assert client.post("/api/scenarios/inject", json={"type": "meteor"}).status_code == 422
    assert client.post("/api/scenarios/inject", json={"type": "line_failure", "targetZoneId": "nope"}).status_code == 400
    assert client.get("/api/does-not-exist").status_code == 404


def test_battery_constants_match_the_guardrails():
    assert c.BATTERY_FLOOR_PCT == 20 and c.BATTERY_CEIL_PCT == 90
    assert c.CONTRACT_LIMIT_KW == 1600


def test_environment_and_clock(client):
    env = client.get("/api/grid/state").json()["environment"]
    assert env["clock"] in {"live", "demo"} and env["weatherSource"] in {"open-meteo", "profile"}
    demo = client.post("/api/sim", json={"clock": "demo", "speed": 60}).json()
    assert demo["clock"] == "demo" and demo["speed"] == 60
    assert client.get("/api/grid/state").json()["timestamp"][11:16] == "17:20"
    live = client.post("/api/sim", json={"clock": "live", "speed": 1}).json()
    assert live["clock"] == "live" and live["speed"] == 1
    assert client.post("/api/sim", json={"clock": "warp", "speed": 1}).status_code == 422


def test_what_if_changes_the_results(client):
    base = client.get("/api/results").json()["headline"]
    none = client.post("/api/results/whatif", json={"batteryKwh": 0, "solarPct": 100, "peakRate": 9.7, "tempOffsetC": 0}).json()
    big = client.post("/api/results/whatif", json={"batteryKwh": 4000, "solarPct": 100, "peakRate": 9.7, "tempOffsetC": 0}).json()
    assert none["headline"]["peakReducedPct"] < base["peakReducedPct"] < big["headline"]["peakReducedPct"] + 0.01
    assert none["headline"]["costSavedPct"] < big["headline"]["costSavedPct"]
    assert big["settings"]["batteryKwh"] == 4000
    assert client.post("/api/results/whatif", json={"batteryKwh": -5}).status_code == 422


def test_control_state_survives_a_reload(client):
    client.post("/api/control/mode", json={"mode": "fallback"})
    client.post("/api/goal", json={"goal": "Protect battery health; avoid deep discharge."})
    state = client.get("/api/control").json()
    assert state["mode"] == "fallback" and "battery" in state["goal"].lower() and "40%" in state["interpretation"]
    client.post("/api/goal", json={"goal": "Keep labs at full power and keep tonight's bill low."})


def test_weather_drives_solar_and_demand():
    from datetime import datetime

    from gridmind.grid import IST, LiveGrid
    from gridmind.weather import Weather

    def weather(ghi, temp):
        w = Weather(fetch=False)
        hours = [f"2026-10-13T{h:02d}:00" for h in range(24)]
        w.load({"hourly": {"time": hours, "temperature_2m": [temp] * 24, "shortwave_radiation": [ghi] * 24, "cloud_cover": [10] * 24}})
        return w

    noon = datetime(2026, 10, 13, 12, 30, tzinfo=IST).timestamp()
    sunny = LiveGrid(weather(900, 30), wall=lambda: noon).snapshot()
    cloudy = LiveGrid(weather(250, 30), wall=lambda: noon).snapshot()
    hot = LiveGrid(weather(900, 42), wall=lambda: noon).snapshot()
    assert sunny.solar_kw > cloudy.solar_kw * 3
    assert hot.demand_kw > sunny.demand_kw


def test_campus_can_move_anywhere_in_india(client):
    found = client.get("/api/locations/search", params={"q": "chen"}).json()
    chennai = next(p for p in found["results"] if p["name"] == "Chennai")
    assert chennai["state"] == "Tamil Nadu" and chennai["discom"]
    before = client.get("/api/results").json()["cost"][0]["baseline"]
    loc = client.post("/api/location", json={k: chennai[k] for k in ("name", "state", "lat", "lon")}).json()
    assert loc["name"] == "Chennai" and loc["tariff"]["peak"] == chennai["tariff"]["peak"]
    env = client.get("/api/grid/state").json()["environment"]
    assert env["location"] == "Chennai" and env["state"] == "Tamil Nadu"
    assert client.get("/api/results").json()["cost"][0]["baseline"] != before  # new state's tariff
    assert client.post("/api/location", json={"name": "London", "state": "", "lat": 51.5, "lon": -0.1}).status_code == 422
    lucknow = client.get("/api/locations/search", params={"q": "luck"}).json()["results"][0]
    client.post("/api/location", json={k: lucknow[k] for k in ("name", "state", "lat", "lon")})
