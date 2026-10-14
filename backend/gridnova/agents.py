"""The agent loop: observe -> reason -> plan (twin) -> safety -> act -> result.

Nothing here is pre-written per scenario output. The Orchestrator builds two
candidate plans for the current situation, the Planner runs both in the digital
twin, the Guardrail checks the twin results against the hard rules, and the
Orchestrator picks the plan with the best score for the operator's goal.
Explanations are plain-language templates filled with the computed numbers
(optionally rewritten by Claude, see explain.py).
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field, replace

from . import campus as c
from .grid import Fault, LiveGrid, iso
from .memory import Memory
from .simulator import Conditions, Policy, Totals, best_peak_target, simulate

# Value of energy left in the battery at the end of a plan (₹/kWh): it will
# displace peak-rate grid power later. Stops plans looking cheap by draining it.
STORED_VALUE_INR_PER_KWH = 9.0


def horizon_end(start: float) -> float:
    """Plans run to the end of the current tariff period that matters: 22:00 by day, 06:00 by night."""
    h = start % 24
    day = start - h
    end = day + 22 if 6 <= h < 22 else day + 30 if h >= 22 else day + 6
    return max(end, start + 0.5)


def period_of(hour: float) -> str:
    h = hour % 24
    return "night" if (h >= 22 or h < 6) else "day" if h < 14 else "evening"
# Value of lost load: what leaving a building with no power at all "costs" in the
# plan score (₹ per kWh not delivered). Standard planning practice; illustrative value.
VOLL_INR_PER_KWH = 120.0

AGENT_NAMES = {
    "orchestrator": "Orchestrator",
    "forecaster": "Forecaster",
    "zone": "Zone Agents",
    "planner": "Planner / Simulator",
    "fault": "Fault Responder",
    "critic": "Critic",
    "guardrail": "Guardrail",
}

GUARDRAILS = [
    {"id": "G1", "rule": "Labs never lose power.", "why": "Experiments and equipment cannot be interrupted."},
    {"id": "G2", "rule": "Battery stays between 20% and 90%.", "why": "Protects battery life and keeps an emergency reserve."},
    {"id": "G3", "rule": "No feeder above 90% loading.", "why": "Prevents overheating and cascading trips."},
    {"id": "G4", "rule": "Grid import stays under the 1,600 kW contract limit.", "why": "Avoids penalty charges from the utility."},
    {"id": "G5", "rule": "Hostel rooms stay at or below 26°C.", "why": "Comfort floor for students (suspended only in a grid outage)."},
    {"id": "G6", "rule": "High-impact actions need operator approval.", "why": "A human decides when many people are affected."},
]

# Lessons the Critic writes after the first run of each scenario.
LESSONS = {
    "cloud_cover": "Start battery bridging as soon as solar drops 20%, without waiting for a second reading.",
    "heatwave": "Start pre-cooling hostels as soon as it crosses 40°C.",
    "line_failure": "Keep feeder F2's spare capacity pre-checked so the reroute is ready before a fault.",
    "grid_outage": "Prepare the reduced-hostel plan in advance so approval takes one tap.",
}

# Response-time model used by the digital twin (minutes at severity 3).
# GridNova: detect -> analyse (twin runs) -> act. Each lesson from an earlier run
# removes work from detection and analysis. The no-AI baseline is an operator
# noticing the alarm, diagnosing by phone and switching by hand.
RESPONSE_MODEL = {
    "cloud_cover": {"ai": [(0.8, 1.6, 0.8), (0.5, 1.0, 0.6), (0.3, 0.6, 0.6)], "manual": (3.0, 3.0, 3.0)},
    "heatwave": {"ai": [(1.0, 2.1, 1.0), (0.6, 1.4, 0.8), (0.4, 0.8, 0.8)], "manual": (4.0, 4.0, 4.0)},
    "line_failure": {"ai": [(0.6, 4.0, 4.0), (0.4, 2.1, 3.5), (0.3, 0.9, 3.3)], "manual": (5.0, 6.0, 10.0)},
    "grid_outage": {"ai": [(0.4, 2.8, 2.0), (0.3, 1.8, 1.5), (0.2, 1.0, 1.3)], "manual": (3.0, 4.0, 7.0)},
}


def response_minutes(fault_type: str, severity: int, run: int) -> tuple[float, float, tuple[float, float, float]]:
    """(GridNova minutes, baseline minutes, GridNova breakdown) for a run of a scenario."""
    model = RESPONSE_MODEL[fault_type]
    parts = model["ai"][min(run, 3) - 1]
    scale = 0.7 + 0.1 * severity  # severity 3 = 1.0
    return round(sum(parts) * scale, 1), round(sum(model["manual"]) * scale, 1), parts


def fmt_kw(kw: float) -> str:
    return f"{round(kw):,} kW"


def fmt_inr(inr: float) -> str:
    return f"₹{round(inr):,}"


def fmt_hours(h: float) -> str:
    total = max(0, round(h * 60))
    hh, mm = divmod(total, 60)
    return f"{hh} h {mm} min" if hh else f"{mm} min"


# ---------- Goal ----------
@dataclass
class Goal:
    text: str = "Keep labs at full power and keep tonight's bill low."
    comfort_weight: float = 150.0  # ₹ per comfort percentage point
    reserve_floor_pct: float = c.BATTERY_FLOOR_PCT

    @staticmethod
    def parse(text: str) -> "Goal":
        t = text.lower()
        g = Goal(text=text.strip())
        notes = []
        if any(w in t for w in ("storm", "reserve", "backup", "outage")):
            g.reserve_floor_pct = 60.0
            notes.append("keep the battery above 60% as an outage reserve")
        elif any(w in t for w in ("battery health", "deep discharge", "protect battery", "battery life")):
            g.reserve_floor_pct = 40.0
            notes.append("keep the battery above 40% to avoid deep discharge")
        if any(w in t for w in ("comfort", "cool", "hot", "students")):
            g.comfort_weight = 400.0
            notes.append("avoid trimming hostel cooling")
        elif any(w in t for w in ("cost", "bill", "cheap", "save", "money")):
            g.comfort_weight = 60.0
            notes.append("accept small comfort trade-offs to cut cost")
        g._notes = notes  # type: ignore[attr-defined]
        return g

    def interpretation(self) -> str:
        notes = getattr(self, "_notes", [])
        how = "; ".join(notes) if notes else "balance cost and comfort"
        return (
            f'Understood. I\'ll prioritise "{self.text}": {how}. '
            f"Labs keep full power and the battery stays between {round(self.reserve_floor_pct)}% and 90%."
        )


# ---------- Plans in the twin ----------
@dataclass
class Candidate:
    id: str
    title: str
    summary: str
    actions: list[str]
    policy: Policy
    tot: Totals = field(default_factory=Totals)
    end_soc: float = 0.0
    score: float = 0.0
    checks: list[tuple[str, bool, str]] = field(default_factory=list)
    needs_approval: bool = False
    start_soc: float = 0.0
    # The day's highest import is set by the evening peak; only going above it adds demand charge.
    peak_ref_kw: float = 0.0

    @property
    def comfort(self) -> int:
        if self.tot.requested_kwh <= 0:
            return 100
        return int(min(100, round(self.tot.served_kwh / self.tot.requested_kwh * 100)))

    @property
    def cost(self) -> float:
        # Energy + penalties over the horizon + the day's demand charge on peak import,
        # minus the value of any change in stored battery energy.
        stored = (self.end_soc - self.start_soc) / 100 * c.BATTERY_CAPACITY_KWH * STORED_VALUE_INR_PER_KWH
        demand_kw = max(self.tot.max_import_kw, self.peak_ref_kw)
        return self.tot.cost_inr + demand_kw * c.DEMAND_CHARGE_INR_PER_KW_DAY - stored

    @property
    def passes(self) -> bool:
        return all(ok for _, ok, _ in self.checks)

    @property
    def risk(self) -> str:
        failed = [rid for rid, ok, _ in self.checks if not ok]
        if failed:
            return "high"
        if self.needs_approval or self.comfort < 80:
            return "medium"
        return "low"


def run_twin(grid: LiveGrid, fault: Fault | None, pol: Policy) -> tuple[Totals, float]:
    """Simulates now -> end of the period with live weather. The fault lasts its duration, then clears."""
    start = grid.hour()
    soc = grid.battery.soc_pct
    end = horizon_end(start)
    normal_cond = grid.conditions(None)
    if fault:
        fault_end = min(end, start + fault.duration_min / 60)
        bat, tot1, _ = simulate(start, fault_end, grid.conditions(fault), pol, soc, dt_min=2)
        if fault_end < end:
            normal = replace(pol, bridge_solar_gap=False, extra_discharge_kw=0.0)
            bat2, tot2, _ = simulate(fault_end, end, normal_cond, normal, bat.soc_pct, dt_min=2)
            merged = Totals(
                energy_cost_inr=tot1.energy_cost_inr + tot2.energy_cost_inr,
                penalty_inr=tot1.penalty_inr + tot2.penalty_inr,
                max_import_kw=max(tot1.max_import_kw, tot2.max_import_kw),
                unserved_kwh=tot1.unserved_kwh + tot2.unserved_kwh,
                min_soc_pct=min(tot1.min_soc_pct, tot2.min_soc_pct),
                max_soc_pct=max(tot1.max_soc_pct, tot2.max_soc_pct),
                max_feeder_ratio=max(tot1.max_feeder_ratio, tot2.max_feeder_ratio),
                labs_unpowered=tot1.labs_unpowered or tot2.labs_unpowered,
                served_kwh=tot1.served_kwh + tot2.served_kwh,
                requested_kwh=tot1.requested_kwh + tot2.requested_kwh,
                dark_kwh=tot1.dark_kwh + tot2.dark_kwh,
            )
            return merged, bat2.soc_pct
        return tot1, bat.soc_pct
    bat, tot, _ = simulate(start, end, normal_cond, pol, soc, dt_min=2)
    return tot, bat.soc_pct


def guardrail(cand: Candidate, fault: Fault | None, floor: float) -> list[tuple[str, bool, str]]:
    t = cand.tot
    outage = bool(fault and fault.type == "grid_outage")
    checks = [
        ("G1", not t.labs_unpowered, "Labs keep full power." if not t.labs_unpowered else "A lab would lose power."),
        (
            "G2",
            t.min_soc_pct >= floor - 0.5 and t.max_soc_pct <= c.BATTERY_CEIL_PCT + 0.5,
            f"Battery stays above {round(floor)}%." if t.min_soc_pct >= floor - 0.5 else f"Battery would fall to {round(t.min_soc_pct)}%.",
        ),
        (
            "G3",
            t.max_feeder_ratio <= c.FEEDER_LIMIT + 1e-6,
            f"Feeders peak at {round(t.max_feeder_ratio * 100)}% loading."
            if t.max_feeder_ratio <= c.FEEDER_LIMIT + 1e-6
            else f"A feeder would reach {round(t.max_feeder_ratio * 100)}% loading.",
        ),
        (
            "G4",
            t.max_import_kw <= c.CONTRACT_LIMIT_KW,
            f"Grid import peaks at {fmt_kw(t.max_import_kw)}, under the 1,600 kW limit."
            if t.max_import_kw <= c.CONTRACT_LIMIT_KW
            else f"Grid import would reach {fmt_kw(t.max_import_kw)}, over the 1,600 kW limit.",
        ),
        (
            "G5",
            outage or cand.comfort >= 90,
            "Hostel cooling changes stay within 1°C." if outage or cand.comfort >= 90 else "Hostels would get too warm.",
        ),
    ]
    return checks


def score(cand: Candidate, goal: Goal) -> float:
    penalty = 0 if cand.passes else 1e9
    return cand.cost + (100 - cand.comfort) * goal.comfort_weight + cand.tot.dark_kwh * VOLL_INR_PER_KWH + penalty


# ---------- The Orchestrator ----------
class Orchestrator:
    def __init__(self, grid: LiveGrid, memory: Memory):
        self.grid = grid
        self.memory = memory
        self.goal = Goal()
        self.decisions: list[dict] = []  # newest first
        self.pending: dict[str, dict] = {}  # decision id -> context awaiting approval
        self.run_counts: dict[str, int] = {}
        self.last_incident: dict[str, str] = {}
        self.counter = 140
        self._lock = threading.RLock()
        self._last_routine: dict | None = None
        self._seed()

    # ----- helpers -----
    def _next_id(self) -> str:
        self.counter += 1
        return f"dec-{self.counter:04d}"

    def _evaluate(self, cands: list[Candidate], fault: Fault | None) -> Candidate:
        floor = self.goal.reserve_floor_pct
        ref = self.grid.policy.peak_target_kw or 0.0
        for cand in cands:
            cand.start_soc = self.grid.battery.soc_pct
            cand.peak_ref_kw = ref
            cand.tot, cand.end_soc = run_twin(self.grid, fault, cand.policy)
            cand.checks = guardrail(cand, fault, floor)
            cand.score = score(cand, self.goal)
        return min(cands, key=lambda x: x.score)

    @staticmethod
    def _plan_json(cand: Candidate) -> dict:
        return {
            "id": cand.id,
            "title": cand.title,
            "summary": cand.summary,
            "costInr": round(cand.cost),
            "risk": cand.risk,
            "comfortPct": cand.comfort,
            "actions": cand.actions,
        }

    def _safety_summary(self, chosen: Candidate, other: Candidate) -> str:
        notes = [msg for _, ok, msg in chosen.checks if ok][:2]
        failed_other = [f"{rid}" for rid, ok, _ in other.checks if not ok]
        text = f"Plan {chosen.id} passes all rules. " + " ".join(notes)
        if failed_other:
            text += f" Plan {other.id} breaks {', '.join(failed_other)}."
        if chosen.needs_approval:
            text += " High-impact: needs operator approval."
        return text.strip()

    def _reason(self, chosen: Candidate, other: Candidate) -> str:
        diff = other.cost - chosen.cost
        parts = []
        dark_gap = other.tot.dark_kwh - chosen.tot.dark_kwh
        if dark_gap > 1:
            parts.append(f"Plan {chosen.id} keeps power on where Plan {other.id} would leave {round(dark_gap):,} kWh of demand in the dark")
        if not other.passes:
            broken = [msg for _, ok, msg in other.checks if not ok]
            parts.append(f"Plan {other.id} is ruled out: {broken[0].lower()}")
        if diff > 0:
            parts.append(f"Plan {chosen.id} costs {fmt_inr(diff)} less in the twin")
        elif diff < 0 and dark_gap <= 1:
            parts.append(f"Plan {chosen.id} costs {fmt_inr(-diff)} more but keeps {chosen.comfort}% comfort vs {other.comfort}%")
        elif diff < 0:
            parts.append(f"for {fmt_inr(-diff)} more")
        if chosen.comfort < 100 and diff >= 0:
            parts.append(f"with {chosen.comfort}% comfort")
        return (", ".join(parts) or f"Plan {chosen.id} scores best for the current goal") + "."

    # ----- seed trace -----
    def _seed(self):
        """The decision the agents made just before the page opened, computed for real."""
        self.decisions.append(self._routine_decision(started_hour=self.grid.hour() - 8 / 60))

    # ----- routine operation (no fault) -----
    def _evening_peak(self) -> tuple[float, float]:
        """(kW, hour) of the next evening peak, from the live weather forecast."""
        from .simulator import zone_loads

        g = self.grid
        now = g.hour()
        day = now - (now % 24)
        start = day + 17 if now % 24 < 22 else day + 41
        cond = g.conditions(None)
        best = (0.0, start)
        t = max(start, now)
        while t <= start + 5:
            kw = sum(z.kw for z in zone_loads(t, cond, Policy.baseline()))
            if kw > best[0]:
                best = (kw, t)
            t += 0.5
        return best

    def _observe_weather(self) -> str:
        env = self.grid.environment()
        solar = fmt_kw(self.grid.snapshot().solar_kw)
        battery = f"Battery at {round(self.grid.battery.soc_pct)}%."
        if env["weatherSource"] == "open-meteo":
            cloud = f", {env['cloudPct']}% cloud" if env["cloudPct"] else ""
            return f"Live weather: {env['temperatureC']:.0f}°C in {env['location']}{cloud}. Solar {solar}. {battery}"
        return f"Typical hot day ({env['temperatureC']:.0f}°C; live weather unavailable). Solar {solar}. {battery}"

    def _routine_decision(self, started_hour: float | None = None, apply: bool = True) -> dict:
        g = self.grid
        now = g.hour()
        h = now if started_hour is None else started_hour
        period = period_of(now)
        base_pol = replace(g.default_policy(), reserve_floor_pct=self.goal.reserve_floor_pct)
        g.policy.reserve_floor_pct = self.goal.reserve_floor_pct
        target = g._evening_target(now, g.battery.soc_pct, g.conditions(None))
        g.policy.peak_target_kw = target
        peak_kw, peak_hour = self._evening_peak()
        peak_at = f"{int(peak_hour % 24):02d}:{int(round((peak_hour % 1) * 60)) % 60:02d}"
        rate = c.tariff_at(19).rate

        if period == "night":
            title, trigger = "Recharge at off-peak rates", "Off-peak tariff until 06:00; tomorrow's evening peak needs a full battery."
            a = Candidate("A", "Skip overnight charging", "Leave the battery as it is until morning.",
                          ["No charging overnight"], replace(base_pol, night_charge_to_pct=None, peak_target_kw=target))
            b = Candidate("B", "Charge overnight", f"Charge to 82% at ₹6.90/kWh without pushing import above {fmt_kw(target)}.",
                          ["Charge battery to 82% before 06:00", f"Keep grid import under {fmt_kw(target)}"],
                          replace(base_pol, peak_target_kw=target))
            reason_line = "Off-peak power costs ₹6.90/kWh; the same energy saves ₹9.70/kWh in tomorrow's peak."
            horizon = "06:00"
            explain_b = ("Night-time electricity is the cheapest of the day. GridNova charges the battery now, slowly enough "
                         "not to create a new peak, so it can cover tomorrow evening's expensive hours.")
        elif period == "day":
            title, trigger = "Hold the battery for the evening", f"Demand will reach {fmt_kw(peak_kw)} around {peak_at} when power costs ₹{rate:.2f}/kWh."
            a = Candidate("A", "Use the battery now", "Discharge 300 kW now to cut daytime grid import.",
                          ["Battery discharge 300 kW now"], replace(base_pol, extra_discharge_kw=300.0, peak_target_kw=target))
            b = Candidate("B", "Hold for the evening peak", f"Keep the battery charged, then cap import at {fmt_kw(target)} from 17:00.",
                          ["Hold battery charge until 17:00", f"Cap grid import at {fmt_kw(target)} 17:00–22:00"],
                          replace(base_pol, peak_target_kw=target))
            reason_line = f"Daytime power costs ₹8.25/kWh; evening power costs ₹{rate:.2f}/kWh plus the demand charge."
            horizon = "22:00"
            explain_b = ("The battery is worth more in the evening, when power is most expensive and the campus hits its "
                         "daily peak. GridNova keeps it charged during the day and uses solar and the grid for now.")
        else:
            title = "Manage the evening peak" if now % 24 >= 17 else "Prepare for the evening peak"
            trigger = f"Demand will reach {fmt_kw(peak_kw)} around {peak_at} while the tariff is ₹{rate:.2f}/kWh."
            a = Candidate("A", "Import from grid", "Keep the battery idle and buy grid power through the peak.",
                          ["Battery idle", "Grid covers the evening peak"], replace(base_pol, peak_target_kw=None, precool=False))
            b = Candidate("B", "Shift to battery at peak",
                          f"Cap grid import at {fmt_kw(target)} until 22:00 using the battery; pre-cool hostels by 1°C.",
                          [f"Discharge battery to hold grid import at {fmt_kw(target)}", "Pre-cool hostels 17:30–18:00",
                           "Recharge at off-peak rates after 22:00"], replace(base_pol, peak_target_kw=target))
            reason_line = f"Peak-rate power costs ₹{rate:.2f}/kWh vs ₹6.90 off-peak, and the day's highest import sets the demand charge."
            horizon = "22:00"
            explain_b = ("Electricity from the grid is most expensive in the evening, and the campus is charged extra for its "
                         f"highest import of the day. GridNova uses the battery to keep grid import at about {fmt_kw(target)} "
                         "and pre-cools hostels slightly earlier. Labs are never touched.")

        chosen = self._evaluate([a, b], None)
        if abs(a.score - b.score) < 100:
            chosen = b  # a near-tie: keep the planned behaviour rather than flip-flopping
        other = b if chosen is a else a
        if apply:
            g.apply_policy(chosen.policy, mitigated=False)
        saving = other.cost - chosen.cost
        when = iso(g.at(h))
        self._last_routine = {"period": period, "target": target, "hour": now, "temp": g.environment()["temperatureC"]}
        return {
            "id": self._next_id(),
            "startedAt": when,
            "title": title,
            "trigger": trigger,
            "steps": [
                {"id": "s1", "kind": "observe", "agent": "forecaster", "at": when, "summary": self._observe_weather(),
                 "detail": f"Next evening peak: {fmt_kw(peak_kw)} around {peak_at}."},
                {"id": "s2", "kind": "reason", "agent": "orchestrator", "at": when, "summary": reason_line},
                {"id": "s3", "kind": "plan", "agent": "planner", "at": when,
                 "summary": f"Tested 2 plans in the digital twin up to {horizon} with the live forecast.",
                 "detail": f"Plan A: {fmt_inr(a.cost)}, {a.comfort}% comfort. Plan B: {fmt_inr(b.cost)}, {b.comfort}% comfort. "
                           f"Evening import cap sized at {fmt_kw(target)} (18 twin runs)."},
                {"id": "s4", "kind": "safety", "agent": "guardrail", "at": when, "summary": self._safety_summary(chosen, other)},
                {"id": "s5", "kind": "act", "agent": "orchestrator", "at": when, "summary": f"Plan {chosen.id} active. {chosen.actions[0]}."},
                {"id": "s6", "kind": "result", "agent": "critic", "at": when,
                 "summary": f"Projected {fmt_inr(saving)} better than Plan {other.id} by {horizon}." if saving > 0 else "Both plans come out about the same."},
            ],
            "plans": [self._plan_json(a), self._plan_json(b)],
            "chosenPlanId": chosen.id,
            "chosenReason": self._reason(chosen, other),
            "explanation": explain_b if chosen.id == "B" else
            "Under the current goal and conditions the alternative did not pay off, so GridNova keeps the simpler plan.",
            **({"usedMemory": m} if (m := self.memory.lesson_for("heatwave")) and period == "evening" else {}),
        }

    def _scenario_candidates(self, fault: Fault, run: int) -> tuple[list[Candidate], str, str, str]:
        g = self.grid
        base = replace(g.policy, reserve_floor_pct=self.goal.reserve_floor_pct, bridge_solar_gap=False, extra_discharge_kw=0.0)
        cond = g.conditions(fault)
        snap = g.snapshot()

        if fault.type == "cloud_cover":
            gap = cond.solar_and_temp(g.hour())[0] * (1 - cond.solar_factor)
            target = g._evening_target(g.hour(), g.battery.soc_pct, cond)
            cands = [
                Candidate("A", "Buy the gap from grid", f"Import {fmt_kw(gap)} more until the clouds pass.",
                          [f"Grid import +{fmt_kw(gap)}"], base),
                Candidate("B", "Battery bridges the dip", f"Discharge {fmt_kw(gap)} while it is cloudy, then re-plan the peak.",
                          [f"Battery discharge {fmt_kw(gap)}", f"Peak cap re-planned to {fmt_kw(target)}"],
                          replace(base, bridge_solar_gap=True, peak_target_kw=target)),
            ]
            return cands, "Cover the solar dip with battery", "Solar output dropped sharply as clouds moved over the campus.", \
                f"Solar fell by {fmt_kw(gap)}. Clouds expected for ~{fault.duration_min} min."

        if fault.type == "heatwave":
            heat = replace(base, precool=True, extra_discharge_kw=150.0)
            target = g._evening_target(g.hour(), g.battery.soc_pct, cond)
            hostel_up = round(0.04 * fault.severity * 100)
            cands = [
                Candidate("A", "Ride it out on grid", "Import the extra cooling load at peak rates.",
                          ["Grid covers the extra load", "Battery idle"], replace(base, peak_target_kw=None, precool=False)),
                Candidate("B", "Battery + gentle pre-cool", f"Battery adds 150 kW now and caps the peak at {fmt_kw(target)}; hostels hold 1°C warmer.",
                          ["Battery discharge 150 kW", f"Peak cap {fmt_kw(target)}", "Hostel setpoint +1°C"],
                          replace(heat, peak_target_kw=target)),
            ]
            return cands, "Absorb the heatwave load", "The temperature jumped and hostel cooling demand is climbing.", \
                f"Hostel demand up {hostel_up}% as ACs ramp up. Campus load now {fmt_kw(snap.demand_kw)}."

        if fault.type == "line_failure":
            zone_id = fault.target_zone_id or "hostel-gh1"
            zone = c.ZONE_BY_ID[zone_id]
            # Size the reroute for the worst moment of the fault, not just now:
            # F2's own load and the hostel's demand both rise into the evening peak.
            from .simulator import zone_loads

            limit = c.FEEDER_RATING_KW["F2"] * c.FEEDER_LIMIT
            frac, spare = 1.0, limit
            h = g.hour()
            while h <= g.hour() + fault.duration_min / 60:
                loads = {z.id: z.kw for z in zone_loads(h, g.conditions(None), base)}
                others = sum(kw for zid, kw in loads.items() if c.ZONE_BY_ID[zid].feeder == "F2" and zid != zone_id)
                spare_h = max(0.0, limit - others)
                spare = min(spare, spare_h)
                need_h = loads[zone_id]  # includes pre-cooling, like the twin
                if need_h:
                    frac = min(frac, spare_h / need_h)
                h += 2 / 60  # same resolution as the twin
            frac = max(0.0, int(frac * 100) / 100 - 0.01)  # 1% safety margin under the feeder limit
            cands = [
                Candidate("A", "Wait for repair crew", f"Keep {zone.name} off until F3 is fixed (~45 min).",
                          [f"{zone.name} offline ~45 min"], base),
                Candidate("B", "Reroute via feeder F2", f"Isolate F3 and supply {zone.name} from F2 at {round(frac * 100)}%.",
                          ["Open switch S3", "Close tie switch T2-3", f"Cap {zone.name} at {round(frac * 100)}%"],
                          replace(base, reroute_fraction=frac)),
            ]
            return cands, f"Isolate fault and reroute {zone.name}", f"Feeder F3 tripped. {zone.name} lost power.", \
                f"Feeder F3 tripped near {zone.name}. F2 has {fmt_kw(spare)} spare capacity under its 90% limit."

        # grid_outage
        options = {}
        for lvl in (0.5, 0.6, 0.7):
            options[lvl] = self._runtime_hours(replace(base, outage_hostel_level=lvl))
        off_runtime = self._runtime_hours(replace(base, outage_hostel_level=0.0))
        self._outage_runtimes = options
        cands = [
            Candidate("A", "Keep hostels off", "Power everything except the hostels until the grid returns.",
                      ["Hostels off", f"Battery lasts ~{fmt_hours(off_runtime)}"], replace(base, outage_hostel_level=0.0)),
            Candidate("B", "Hostels at 60%", "Restore hostels at 60%: lights, fans and sockets, no AC.",
                      ["Hostels at 60%", f"Battery lasts ~{fmt_hours(options[0.6])}"], replace(base, outage_hostel_level=0.6)),
        ]
        cands[1].needs_approval = True
        return cands, "Island the campus on battery", "The main grid supply from the UPPCL substation was lost.", \
            f"Grid voltage lost. Campus running on solar and battery ({round(g.battery.soc_pct)}%)."

    def _runtime_hours(self, pol: Policy) -> float:
        """How long the battery carries an islanded campus before reaching its floor."""
        g = self.grid
        start = g.hour()
        soc = g.battery.soc_pct
        cond = replace(g.conditions(None), outage=True)
        hrs = 0.0
        from .simulator import Battery, step

        bat = Battery(soc)
        tot = Totals()
        floor_pol = replace(pol, reserve_floor_pct=c.BATTERY_FLOOR_PCT)
        while hrs < 8 and bat.soc_pct > c.BATTERY_FLOOR_PCT + 0.05:
            r = step(bat, tot, start + hrs, 1 / 60, cond, floor_pol)
            if r.unserved_kw > 1:
                break
            hrs += 1 / 60
        return hrs

    def _scenario_decision(self, fault: Fault) -> dict:
        g = self.grid
        self.run_counts[fault.type] = self.run_counts.get(fault.type, 0) + 1
        run = self.run_counts[fault.type]
        previous = self.last_incident.get(fault.type)
        self.last_incident[fault.type] = fault.incident_id

        cands, title, trigger, observed = self._scenario_candidates(fault, run)
        chosen = self._evaluate(cands, fault)
        other = cands[1] if chosen is cands[0] else cands[0]

        gm_min, base_min, parts = response_minutes(fault.type, fault.severity, run)
        lesson = LESSONS[fault.type]
        replay = run > 1 and previous is not None
        when = iso(g.now())
        agent_observe = {"cloud_cover": "forecaster", "heatwave": "zone", "line_failure": "fault", "grid_outage": "fault"}[fault.type]
        agent_act = "fault" if fault.type == "line_failure" else "orchestrator"

        steps = [
            {"id": "s1", "kind": "observe", "agent": agent_observe, "at": when, "summary": observed,
             "detail": f"Detected in {parts[0]:.1f} min of simulated time."},
            {"id": "s2", "kind": "reason", "agent": "orchestrator", "at": when, "summary": self._reason(chosen, other),
             "detail": f"Lesson applied from {previous}: {lesson}" if replay else None},
            {"id": "s3", "kind": "plan", "agent": "planner", "at": when,
             "summary": f"Tested 2 plans in the digital twin up to 22:00 ({parts[1]:.1f} min).",
             "detail": f"Plan A: {fmt_inr(cands[0].cost)}, {cands[0].comfort}% comfort. Plan B: {fmt_inr(cands[1].cost)}, {cands[1].comfort}% comfort."},
            {"id": "s4", "kind": "safety", "agent": "guardrail", "at": when, "summary": self._safety_summary(chosen, other)},
        ]
        steps = [{k: v for k, v in s.items() if v is not None} for s in steps]

        decision = {
            "id": f"dec-{fault.incident_id}",
            "incidentId": fault.incident_id,
            "startedAt": when,
            "title": f"{title} (run {run})" if replay else title,
            "trigger": trigger,
            "steps": steps,
            "plans": [self._plan_json(cands[0]), self._plan_json(cands[1])],
            "chosenPlanId": chosen.id,
            "chosenReason": self._reason(chosen, other),
            "explanation": self._explain(fault, chosen),
            "usedMemory": {"incidentId": previous, "summary": f"Run {run - 1}: {lesson}"} if replay else self.memory.lesson_for(fault.type),
            "outcome": {
                "run": run,
                "recoveryMin": gm_min,
                "baselineMin": base_min,
                **({"lessonApplied": lesson} if replay else {"lessonLearned": lesson}),
            },
        }
        if not decision["usedMemory"]:
            decision.pop("usedMemory")

        if chosen.needs_approval:
            runtimes = self._outage_runtimes
            decision["approval"] = {
                "status": "pending",
                "request": "Restore hostels at 60% power from the battery.",
                "risk": f"If the outage lasts longer than ~{fmt_hours(runtimes[0.6])}, the battery reaches its 20% floor and hostels must go off.",
                "modifyOptions": [
                    {"id": "0.5", "label": f"50%: battery lasts ~{fmt_hours(runtimes[0.5])}"},
                    {"id": "0.6", "label": f"60%: battery lasts ~{fmt_hours(runtimes[0.6])} (recommended)"},
                    {"id": "0.7", "label": f"70%: battery lasts ~{fmt_hours(runtimes[0.7])}"},
                ],
            }
            self.pending[decision["id"]] = {"fault": fault, "chosen": chosen}
        else:
            g.apply_policy(chosen.policy, mitigated=True)
            decision["steps"] += self._final_steps(fault, chosen, when)
            self.memory.record(fault, decision)
        return decision

    def _final_steps(self, fault: Fault, chosen: Candidate, when: str) -> list[dict]:
        snap = self.grid.snapshot()
        agent_act = "fault" if fault.type == "line_failure" else "orchestrator"
        act = f"Plan {chosen.id} applied: " + "; ".join(chosen.actions[:2]) + "."
        if fault.type == "cloud_cover":
            result = f"Grid draw held at {fmt_kw(snap.grid_kw)}. No zone noticed the dip."
        elif fault.type == "heatwave":
            result = f"Grid import now {fmt_kw(snap.grid_kw)}, peak kept under the contract limit. Comfort at {chosen.comfort}%."
        elif fault.type == "line_failure":
            z = next(z for z in snap.zones if z.id == (fault.target_zone_id or "hostel-gh1"))
            result = f"{c.ZONE_BY_ID[z.id].name} back on at {fmt_kw(z.kw)}. Maintenance ticket raised for F3."
        else:
            result = f"All zones powered from the battery ({round(self.grid.battery.soc_pct)}%)."
        return [
            {"id": "s5", "kind": "act", "agent": agent_act, "at": when, "summary": act},
            {"id": "s6", "kind": "result", "agent": "critic", "at": when, "summary": result},
        ]

    def _explain(self, fault: Fault, chosen: Candidate) -> str:
        if fault.type == "cloud_cover":
            return ("Clouds cut the solar power. Rather than buying the missing power from the grid at a high rate, "
                    "GridNova used part of the battery while it is cloudy and re-planned the evening so there is still enough left.")
        if fault.type == "heatwave":
            return ("The heat made every AC on campus work harder. Buying all that extra power would push the campus over its "
                    "grid limit at the evening peak. GridNova adds battery power and sets hostel cooling one degree warmer, which most people do not notice.")
        if fault.type == "line_failure":
            return ("A cable fault cut power to a hostel. GridNova cut off the damaged cable so it is safe, then fed the hostel "
                    "through a neighbouring cable that had spare room. Students lost power for only a few minutes.")
        return ("The main power line to campus went down. GridNova switched the whole campus onto its own solar and battery. "
                "Labs keep full power. Hostels get enough for lights, fans and charging, so the battery lasts as long as possible.")

    # ----- public API -----
    def step(self) -> dict:
        with self._lock:
            fault = self.grid.fault
            if fault:
                # One decision per incident: return it if it already exists.
                existing = next((x for x in self.decisions if x.get("incidentId") == fault.incident_id), None)
                if existing:
                    return existing
                d = self._scenario_decision(fault)
            else:
                d = self._routine_decision()
            self.decisions.insert(0, d)
            del self.decisions[30:]
            return d

    def respond(self, decision_id: str, response: dict) -> dict:
        with self._lock:
            d = next((x for x in self.decisions if x["id"] == decision_id), None)
            ctx = self.pending.pop(decision_id, None)
            if d is None or ctx is None:
                raise KeyError(decision_id)
            fault: Fault = ctx["fault"]
            chosen: Candidate = ctx["chosen"]
            kind = response.get("decision")
            when = iso(self.grid.now())
            if kind == "reject":
                self.grid.apply_policy(replace(chosen.policy, outage_hostel_level=0.5), mitigated=True)
                self.grid.set_mode("fallback")
                note, status, level = "Rejected by Duty Operator. Safe rule-based control is active (hostels at 50%).", "rejected", 0.5
                final = [
                    {"id": "s5", "kind": "act", "agent": "guardrail", "at": when, "summary": "Fallback rules applied: hostels at a fixed 50%."},
                    {"id": "s6", "kind": "result", "agent": "critic", "at": when, "summary": "All zones powered on safe rules. AI control can be resumed any time."},
                ]
            else:
                level = float(response.get("optionId", 0.6)) if kind == "modify" else 0.6
                self.grid.apply_policy(replace(chosen.policy, outage_hostel_level=level), mitigated=True)
                pct = round(level * 100)
                runtime = self._outage_runtimes.get(level) or self._runtime_hours(replace(chosen.policy, outage_hostel_level=level))
                note = "Approved by Duty Operator." if kind == "approve" else f"Modified by Duty Operator: hostels at {pct}%."
                status = "approved" if kind == "approve" else "modified"
                final = [
                    {"id": "s5", "kind": "act", "agent": "orchestrator", "at": when, "summary": f"Hostels restored at {pct}%; battery powering the campus."},
                    {"id": "s6", "kind": "result", "agent": "critic", "at": when, "summary": f"All zones powered. Battery lasts ~{fmt_hours(runtime)} at this load."},
                ]
            d["steps"] = d["steps"] + final
            d["approval"] = {**d["approval"], "status": status,
                             "response": {**({"optionId": response.get("optionId")} if kind == "modify" else {}), "note": note, "at": when}}
            self.memory.record(fault, d)
            return d

    def set_goal(self, text: str) -> dict:
        with self._lock:
            self.goal = Goal.parse(text)
            self.grid.apply_policy(replace(self.grid.policy, reserve_floor_pct=self.goal.reserve_floor_pct), mitigated=False)
            if not self.grid.fault:
                # Re-plan straight away under the new goal; the decision shows up in the trace.
                self.decisions.insert(0, self._routine_decision())
                del self.decisions[30:]
            return {"goal": self.goal.text, "interpretation": self.goal.interpretation(), "acceptedAt": iso(self.grid.now())}

    def tick(self) -> dict | None:
        """Called every few seconds: re-plans when time or conditions have moved on."""
        with self._lock:
            if self.grid.fault or self.pending:
                return None
            now = self.grid.hour()
            last = self._last_routine
            new_period = not last or last["period"] != period_of(now) or abs(now - last["hour"]) > 30
            hourly = last and now - last["hour"] >= 1.0
            temp_moved = last and abs(self.grid.environment()["temperatureC"] - last["temp"]) >= 1.5
            if not (new_period or hourly or temp_moved):
                return None
            d = self._routine_decision()
            if last and not new_period and abs(self._last_routine["target"] - last["target"]) < 25 and not temp_moved:
                # Same plan as before: refresh silently, no new trace entry.
                self._last_routine["hour"] = now
                return None
            self.decisions.insert(0, d)
            del self.decisions[30:]
            return d

    def agents(self) -> list[dict]:
        roles = {
            "orchestrator": ("Runs the decision loop and explains every choice in plain language.",
                          ["read_grid_state", "ask_forecaster", "request_plans", "submit_to_guardrail", "dispatch_action", "explain"]),
            "forecaster": ("Predicts campus demand and solar output for the next 12 hours.", ["demand_forecast", "solar_forecast", "weather_feed"]),
            "zone": ("One per building. Report load and how much can be safely reduced.", ["read_zone_meter", "set_hvac_setpoint", "report_flexibility"]),
            "planner": ("Builds Plan A and Plan B and tests both in the digital twin first.", ["build_plan", "simulate_in_twin", "compare_plans"]),
            "fault": ("Detects faults and isolates or reroutes power within seconds.", ["read_relays", "open_switch", "close_tie_switch"]),
            "critic": ("Scores every outcome and writes lessons to memory.", ["score_outcome", "write_lesson", "search_memory"]),
            "guardrail": ("Checks every plan against hard rules before anything happens.", ["check_rules", "require_approval", "veto"]),
        }
        last: dict[str, str] = {}
        for d in self.decisions:  # newest first
            for s in reversed(d["steps"]):
                last.setdefault(s["agent"], s["summary"])
        defaults = {"zone": "All buildings reporting normally.", "fault": "All feeders healthy."}
        waiting = bool(self.pending)
        out = []
        for aid, (role, tools) in roles.items():
            status = "waiting" if waiting and aid in ("orchestrator", "guardrail") else "idle"
            out.append({"id": aid, "name": AGENT_NAMES[aid], "role": role, "status": status,
                        "lastAction": last.get(aid, defaults.get(aid, "Standing by.")), "tools": tools})
        return out
