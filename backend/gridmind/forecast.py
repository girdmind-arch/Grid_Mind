"""The Forecaster: the next 12 hours of demand, solar and tariff, plus notable events.

Demand comes from the campus load model under the current conditions and the
agents' current plan; solar from the clear-sky profile scaled by cloud cover.
"""

from __future__ import annotations

import math

from . import campus as c
from .grid import LiveGrid, at_hour, conditions_for, iso
from .simulator import zone_loads


def _hhmm(hour: float) -> str:
    h = int(hour) % 24
    m = int(round((hour - int(hour)) * 60))
    if m == 60:
        h, m = (h + 1) % 24, 0
    return f"{h:02d}:{m:02d}"


def build_forecast(grid: LiveGrid) -> dict:
    now = grid.hour()
    cond = conditions_for(grid.fault)
    pol = grid.active_policy()
    start = math.floor(now)

    points = []
    for i in range(12):
        h = start + i
        demand = sum(z.kw for z in zone_loads(h, cond, pol))
        points.append({
            "time": iso(at_hour(h)),
            "demandKw": round(demand),
            "solarKw": round(c.clear_sky_solar_kw(h) * cond.solar_factor),
            "tariffInr": c.tariff_at(h).rate,
        })

    events = []
    # Next tariff change.
    for i in range(1, 25):
        h = start + i
        if c.tariff_at(h).slab != c.tariff_at(h - 1).slab:
            t = c.tariff_at(h)
            title = "Evening peak begins" if t.slab == "peak" else "Off-peak tariff" if t.slab == "off-peak" else "Normal tariff"
            detail = (f"Tariff rises to ₹{t.rate:.2f}/kWh until 22:00." if t.slab == "peak"
                      else f"Recharge battery at ₹{t.rate:.2f}/kWh overnight." if t.slab == "off-peak"
                      else f"Tariff ₹{t.rate:.2f}/kWh.")
            if h > now:
                events.append({"id": f"ev-tariff-{h}", "time": iso(at_hour(h)), "title": title, "detail": detail, "kind": "tariff"})
            if len([e for e in events if e["kind"] == "tariff"]) >= 2:
                break

    # Solar drops below 100 kW (searched in 10-minute steps).
    solar = lambda h: c.clear_sky_solar_kw(h) * cond.solar_factor
    if solar(now) >= 100:
        t = now
        while t < now + 12:
            if solar(t) < 100:
                events.append({"id": "ev-solar", "time": iso(at_hour(t)), "title": "Solar output drops below 100 kW",
                               "detail": "Battery and grid take over as the sun sets.", "kind": "solar"})
                break
            t += 1 / 6

    # Demand peak within the window.
    peak = max(points, key=lambda p: p["demandKw"])
    if peak["demandKw"] > points[0]["demandKw"]:
        events.append({"id": "ev-peak", "time": peak["time"], "title": "Campus demand peaks",
                       "detail": f"Forecast {peak['demandKw']:,} kW (±4%) as hostels fill up.", "kind": "peak"})

    if grid.fault and grid.fault.type in ("cloud_cover", "heatwave"):
        end = grid.fault.started_hour + grid.fault.duration_min / 60
        label = "Clouds expected to clear" if grid.fault.type == "cloud_cover" else "Heat expected to ease"
        events.append({"id": "ev-weather", "time": iso(at_hour(end)), "title": label,
                       "detail": f"About {_hhmm(end)}, based on the scenario duration.", "kind": "weather"})

    events.sort(key=lambda e: e["time"])
    return {"generatedAt": iso(at_hour(now)), "horizonHours": 12, "points": points, "events": events}
