"""GridMind backend: FastAPI app serving the API and the built website.

Run locally:  uvicorn gridmind.main:app --reload   (from the backend/ folder)
The website (../dist) is served at / when it has been built.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from . import campus as c
from .agents import GUARDRAILS, Commander
from .evaluation import build_results, build_run_history
from .forecast import build_forecast
from .grid import LiveGrid, at_hour, iso
from .memory import Memory
from .simulator import Battery, Totals, step

app = FastAPI(title="GridMind API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

grid = LiveGrid()
memory = Memory()
commander = Commander(grid, memory)

MODE_MESSAGES = {
    "ai": "Agents are planning and acting again, within the guardrails.",
    "fallback": "Fixed safety rules are running the grid. Agents keep forecasting but do not act.",
    "manual": "Agents have stopped acting. Guardrails still block unsafe commands.",
}


def _trend(now: float, before: float, tol: float = 5.0) -> str:
    return "up" if now > before + tol else "down" if now < before - tol else "flat"


def grid_state() -> dict:
    snap = grid.snapshot()
    hour = grid.hour()
    from .grid import conditions_for

    cond = conditions_for(grid.fault)
    earlier = step(Battery(grid.battery.soc_pct), Totals(), hour - 10 / 60, 0.0, cond, grid.active_policy())
    soon = step(Battery(grid.battery.soc_pct), Totals(), hour + 10 / 60, 0.0, cond, grid.active_policy())
    tariff = c.tariff_at(hour)
    fault = grid.fault
    zones = []
    for z in snap.zones:
        spec = c.ZONE_BY_ID[z.id]
        zone = {"id": z.id, "name": spec.name, "kind": spec.kind, "demandKw": round(z.kw), "status": z.status, "priority": spec.priority}
        if z.note:
            zone["note"] = z.note
        zones.append(zone)
    battery_kw = round(snap.battery_kw)
    flows = [
        {"from": "solar", "to": "bus", "kw": round(snap.solar_kw)},
        {"from": "battery", "to": "bus", "kw": max(0, battery_kw)},
        {"from": "grid", "to": "bus", "kw": round(max(0.0, snap.grid_kw))},
        *({"from": "bus", "to": z["id"], "kw": z["demandKw"]} for z in zones),
    ]
    return {
        "timestamp": iso(at_hour(hour)),
        "mode": grid.mode,
        "demandKw": sum(z["demandKw"] for z in zones),
        "solarKw": round(snap.solar_kw),
        "gridImportKw": round(max(0.0, snap.grid_kw)),
        "battery": {"socPct": round(grid.battery.soc_pct, 1), "powerKw": -battery_kw, "capacityKwh": c.BATTERY_CAPACITY_KWH},
        "costTodayInr": round(grid.totals.cost_inr),
        "baselineCostTodayInr": round(grid.base_totals.cost_inr),
        "tariff": {"slab": tariff.slab, "ratePerKwh": tariff.rate, "label": tariff.label},
        "trends": {
            "demand": _trend(soon.demand_kw, earlier.demand_kw),
            "solar": _trend(soon.solar_kw, earlier.solar_kw),
            "battery": "down" if battery_kw > 5 else "up" if battery_kw < -5 else "flat",
            "grid": _trend(soon.grid_kw, earlier.grid_kw),
            "cost": "up",
        },
        "zones": zones,
        "flows": flows,
        "activeFault": None if not fault else {
            "type": fault.type,
            "severity": fault.severity,
            "durationMin": fault.duration_min,
            **({"targetZoneId": fault.target_zone_id} if fault.target_zone_id else {}),
            "incidentId": fault.incident_id,
            "startedAt": iso(at_hour(fault.started_hour)),
            "mitigated": fault.mitigated,
        },
    }


# ---------- Request bodies ----------
class FaultRequest(BaseModel):
    type: Literal["cloud_cover", "heatwave", "line_failure", "grid_outage"]
    severity: int = Field(3, ge=1, le=5)
    durationMin: int = Field(30, ge=5, le=240)
    targetZoneId: str | None = None


class ApprovalBody(BaseModel):
    decision: Literal["approve", "modify", "reject"]
    optionId: str | None = None


class GoalBody(BaseModel):
    goal: str = Field(min_length=1, max_length=300)


class ModeBody(BaseModel):
    mode: Literal["ai", "fallback", "manual"]


# ---------- API ----------
@app.get("/api/health")
def health():
    return {"ok": True, "simTime": iso(grid.now())}


@app.get("/api/grid/state")
def get_grid_state():
    return grid_state()


@app.get("/api/forecast")
def get_forecast():
    return build_forecast(grid)


@app.post("/api/scenarios/inject")
def inject(req: FaultRequest):
    if req.targetZoneId and req.targetZoneId not in c.ZONE_BY_ID:
        raise HTTPException(400, "Unknown zone.")
    f = grid.start_fault(req.type, req.severity, req.durationMin, req.targetZoneId)
    return {"incidentId": f.incident_id, "startedAt": iso(at_hour(f.started_hour)), "message": "Scenario started."}


@app.post("/api/scenarios/clear")
def clear():
    grid.clear_fault()
    return JSONResponse(None)


@app.post("/api/agents/commander/step")
def commander_step():
    return commander.step()


@app.post("/api/agents/decisions/{decision_id}/approval")
def approval(decision_id: str, body: ApprovalBody):
    if body.decision == "modify" and body.optionId not in {"0.5", "0.6", "0.7"}:
        raise HTTPException(400, "Pick one of the offered options.")
    try:
        return commander.respond(decision_id, body.model_dump(exclude_none=True))
    except KeyError:
        raise HTTPException(404, "That decision is not waiting for approval.")


@app.get("/api/agents/trace")
def trace():
    return commander.decisions


@app.get("/api/agents")
def agents():
    return commander.agents()


@app.get("/api/guardrails")
def guardrails():
    return GUARDRAILS


@app.get("/api/memory")
def get_memory():
    return memory.snapshot()


@app.get("/api/results")
def results():
    return build_results()


@app.get("/api/results/runs")
def results_runs():
    return build_run_history()


@app.post("/api/goal")
def set_goal(body: GoalBody):
    return commander.set_goal(body.goal)


@app.post("/api/control/mode")
def set_mode(body: ModeBody):
    grid.set_mode(body.mode)
    return {"mode": body.mode, "changedAt": iso(grid.now()), "message": MODE_MESSAGES[body.mode]}


# ---------- Website ----------
DIST = Path(os.environ.get("GRIDMIND_DIST", Path(__file__).resolve().parents[2] / "dist"))


@app.get("/{path:path}", include_in_schema=False)
def website(path: str):
    if path.startswith("api/"):
        raise HTTPException(404, "Not found.")
    if not DIST.exists():
        return JSONResponse({"message": "GridMind API is running. Build the website (npm run build) to serve it here."})
    file = (DIST / path).resolve()
    if path and file.is_file() and DIST.resolve() in file.parents:
        headers = {"Cache-Control": "public, max-age=31536000, immutable"} if path.startswith("assets/") else None
        return FileResponse(file, headers=headers)
    # Single-page app: every other path loads index.html and the router takes over.
    return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-cache"})
