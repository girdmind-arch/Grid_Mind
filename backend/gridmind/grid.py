"""The live campus grid: a simulated clock, the current fault and the controller.

The demo day starts at 17:20 IST on Tue 12 May 2026, just before the evening
peak, and runs at real speed. After LOOP_HOURS it starts the evening again, so
a long-running server always shows the interesting part of the day.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone

from . import campus as c
from .simulator import Battery, Conditions, Policy, StepResult, Totals, best_peak_target, simulate, step

IST = timezone(timedelta(hours=5, minutes=30))
SIM_DAY = datetime(2026, 5, 12, tzinfo=IST)
SIM_START_HOUR = 17 + 20 / 60
LOOP_HOURS = 4.0
STEP_MIN = 1.0


def iso(dt: datetime) -> str:
    return dt.astimezone(IST).isoformat(timespec="seconds")


def at_hour(hour: float) -> datetime:
    return SIM_DAY + timedelta(hours=hour)


@dataclass
class Fault:
    type: str  # cloud_cover | heatwave | line_failure | grid_outage
    severity: int
    duration_min: int
    incident_id: str
    started_hour: float
    target_zone_id: str | None = None
    mitigated: bool = False


def conditions_for(fault: Fault | None) -> Conditions:
    if not fault:
        return Conditions()
    if fault.type == "cloud_cover":
        return Conditions(solar_factor=max(0.0, 1 - 0.15 * fault.severity))
    if fault.type == "heatwave":
        return Conditions(heat_severity=fault.severity)
    if fault.type == "line_failure":
        return Conditions(line_fault_zone=fault.target_zone_id or "hostel-narmada")
    if fault.type == "grid_outage":
        return Conditions(outage=True)
    return Conditions()


class LiveGrid:
    """Holds the live state. All methods are thread-safe."""

    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._lock = threading.RLock()
        self.mode = "ai"  # ai | fallback | manual
        self.fault: Fault | None = None
        self.incident_counter = 41
        self._reset_day()

    # ---------- clock ----------
    def _elapsed_hours(self) -> float:
        return (self._clock() - self._t0) / 3600

    def hour(self) -> float:
        """Current simulated hour of the day (17.33 = 17:20)."""
        with self._lock:
            self._advance()
            return self._hour

    def now(self) -> datetime:
        return at_hour(self.hour())

    def _reset_day(self):
        """Simulates 00:00 -> 17:20 so today's cost and battery level are real.

        The battery starts the day at 82%, charged at off-peak rates the night before.
        """
        self._t0 = self._clock()
        self.policy = self.default_policy()
        start_pol = replace(self.policy, peak_target_kw=None)
        bat, tot, _ = simulate(0, SIM_START_HOUR, Conditions(), start_pol, soc_pct=82.0, dt_min=STEP_MIN)
        _, base_tot, _ = simulate(0, SIM_START_HOUR, Conditions(), Policy.baseline(), soc_pct=82.0, dt_min=STEP_MIN)
        self.battery: Battery = bat
        self.totals: Totals = tot
        self.base_battery = Battery(82.0)
        self.base_totals: Totals = base_tot
        self._hour = SIM_START_HOUR
        self.policy.peak_target_kw = best_peak_target(self._hour, Conditions(), self.policy, self.battery.soc_pct)
        self.last: StepResult = step(Battery(self.battery.soc_pct), Totals(), self._hour, 0.0, Conditions(), self.policy)
        self.prev: StepResult = self.last

    def default_policy(self) -> Policy:
        return Policy(ai=True, night_charge_to_pct=82.0, precool=True, hvac_trim=True)

    def _advance(self):
        target = SIM_START_HOUR + self._elapsed_hours()
        if target - SIM_START_HOUR >= LOOP_HOURS:
            # Start the evening again (keeps memory and incidents, resets the grid).
            self.fault = None
            self.mode = "ai"
            self._reset_day()
            return
        dt_h = STEP_MIN / 60
        cond = conditions_for(self.fault)
        while self._hour + dt_h <= target:
            self.prev = self.last
            self.last = step(self.battery, self.totals, self._hour, dt_h, cond, self.active_policy())
            step(self.base_battery, self.base_totals, self._hour, dt_h, cond, Policy.baseline())
            self._hour += dt_h

    # ---------- control ----------
    def active_policy(self) -> Policy:
        """What actually runs: the agents' policy, or safe fixed rules."""
        if self.mode == "ai":
            return self.policy
        # Fallback rules and manual: battery only covers outages, no optimisation.
        level = self.policy.outage_hostel_level if self.fault and self.fault.type == "grid_outage" else 0.0
        return Policy(
            ai=True,
            night_charge_to_pct=82.0,
            reroute_fraction=self.policy.reroute_fraction,
            outage_hostel_level=level or (0.5 if self.fault and self.fault.type == "grid_outage" else 0.0),
        )

    def snapshot(self) -> StepResult:
        """A zero-length step at the current time with the current policy (no state change)."""
        with self._lock:
            self._advance()
            cond = conditions_for(self.fault)
            return step(Battery(self.battery.soc_pct), Totals(), self._hour, 0.0, cond, self.active_policy())

    def start_fault(self, type_: str, severity: int, duration_min: int, target_zone_id: str | None) -> Fault:
        with self._lock:
            self._advance()
            self.incident_counter += 1
            if type_ == "line_failure":
                target_zone_id = target_zone_id or "hostel-narmada"
            self.fault = Fault(
                type=type_,
                severity=max(1, min(5, severity)),
                duration_min=duration_min,
                incident_id=f"INC-{self.incident_counter}",
                started_hour=self._hour,
                target_zone_id=target_zone_id,
            )
            self.mode = "ai"
            # The fault hits before anyone reacts: reset any response from earlier.
            self.policy = replace(
                self.default_policy(),
                peak_target_kw=self.policy.peak_target_kw,
                reserve_floor_pct=self.policy.reserve_floor_pct,
                night_charge_to_pct=self.policy.night_charge_to_pct,
            )
            return self.fault

    def clear_fault(self):
        with self._lock:
            self._advance()
            self.fault = None
            self.mode = "ai"
            reserve = self.policy.reserve_floor_pct
            self.policy = replace(self.default_policy(), reserve_floor_pct=reserve)
            self.policy.peak_target_kw = best_peak_target(self._hour, Conditions(), self.policy, self.battery.soc_pct)

    def apply_policy(self, pol: Policy, mitigated: bool = True):
        with self._lock:
            self._advance()
            self.policy = pol
            if self.fault and mitigated:
                self.fault.mitigated = True

    def set_mode(self, mode: str):
        with self._lock:
            self._advance()
            self.mode = mode
