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
