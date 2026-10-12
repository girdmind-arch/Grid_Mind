"""The simulated campus: buildings, feeders, battery, tariff and daily profiles.

A mid-sized Indian campus on a hot May weekday. Numbers are illustrative but
chosen to be realistic (UPPCL-style time-of-day tariff, evening peak
18:00-22:00, a ~720 kW rooftop solar array, a 2 MWh battery).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ZoneSpec:
    id: str
    name: str
    kind: str  # hostel | lab | library | admin
    priority: str  # critical | high | normal
    feeder: str
    # Share of total campus demand (no-AI baseline) this building draws.
    share: float


# Demand at 17:20 split across buildings: 168+154+142+131+236+188+121+100 = 1,240 kW.
_KW_1720 = {
    "hostel-kaveri": 168,
    "hostel-godavari": 154,
    "hostel-narmada": 142,
    "hostel-ganga": 131,
    "lab-electronics": 236,
    "lab-biosciences": 188,
    "library": 121,
    "admin": 100,
}
_TOTAL_1720 = sum(_KW_1720.values())

ZONES: list[ZoneSpec] = [
    ZoneSpec("hostel-kaveri", "Kaveri Hostel", "hostel", "normal", "F1", _KW_1720["hostel-kaveri"] / _TOTAL_1720),
    ZoneSpec("hostel-godavari", "Godavari Hostel", "hostel", "normal", "F1", _KW_1720["hostel-godavari"] / _TOTAL_1720),
    ZoneSpec("hostel-narmada", "Narmada Hostel", "hostel", "normal", "F3", _KW_1720["hostel-narmada"] / _TOTAL_1720),
    ZoneSpec("hostel-ganga", "Ganga Hostel", "hostel", "normal", "F2", _KW_1720["hostel-ganga"] / _TOTAL_1720),
    ZoneSpec("lab-electronics", "Electronics Lab", "lab", "critical", "F4", _KW_1720["lab-electronics"] / _TOTAL_1720),
    ZoneSpec("lab-biosciences", "Bio-Sciences Lab", "lab", "critical", "F4", _KW_1720["lab-biosciences"] / _TOTAL_1720),
    ZoneSpec("library", "Central Library", "library", "high", "F2", _KW_1720["library"] / _TOTAL_1720),
    ZoneSpec("admin", "Admin Block", "admin", "high", "F5", _KW_1720["admin"] / _TOTAL_1720),
]
ZONE_BY_ID = {z.id: z for z in ZONES}

# Feeder ratings (kW). Guardrail G3 keeps every feeder at or below 90%.
FEEDER_RATING_KW = {"F1": 520, "F2": 430, "F3": 260, "F4": 700, "F5": 220}
FEEDER_LIMIT = 0.9

# Battery: 2 MWh, usable window 20-90% (Guardrail G2).
BATTERY_CAPACITY_KWH = 2000.0
BATTERY_MAX_KW = 1500.0  # inverter rating (enough to island the campus)
BATTERY_FLOOR_PCT = 20.0
BATTERY_CEIL_PCT = 90.0
# One-way efficiency (round trip ~92%).
BATTERY_EFF = 0.96

# Grid connection.
CONTRACT_LIMIT_KW = 1600.0  # Guardrail G4
# Demand charge on the day's highest grid import (₹ per kW per day, ~₹360/kW-month).
DEMAND_CHARGE_INR_PER_KW_DAY = 12.0
# Penalty per kWh imported above the contract limit.
EXCESS_PENALTY_INR_PER_KWH = 15.0


@dataclass(frozen=True)
class TariffSlab:
    slab: str
    rate: float
    label: str


TARIFF = {
    "off-peak": TariffSlab("off-peak", 6.90, "Off-peak · 22:00–06:00"),
    "normal": TariffSlab("normal", 8.25, "Normal · 06:00–18:00"),
    "peak": TariffSlab("peak", 9.70, "Peak · 18:00–22:00"),
}


def tariff_at(hour: float) -> TariffSlab:
    h = hour % 24
    if 18 <= h < 22:
        return TARIFF["peak"]
    if 6 <= h < 18:
        return TARIFF["normal"]
    return TARIFF["off-peak"]


# Hourly campus demand (kW, no-AI baseline) and clear-sky solar (kW) for a hot weekday.
HOURLY_DEMAND_KW = [
    610, 580, 560, 550, 560, 620, 760, 900, 1010, 1080, 1120, 1150,
    1170, 1160, 1140, 1150, 1190, 1240, 1420, 1510, 1480, 1390, 1120, 820,
]
HOURLY_SOLAR_KW = [
    0, 0, 0, 0, 0, 0, 20, 130, 300, 470, 610, 690,
    720, 700, 630, 520, 400, 260, 90, 10, 0, 0, 0, 0,
]


def _interp(series: list[float], hour: float) -> float:
    """Linear interpolation of an hourly series, treating values as on the hour."""
    h = hour % 24
    i = int(h)
    frac = h - i
    a = series[i]
    b = series[(i + 1) % 24]
    return a + (b - a) * frac


def campus_demand_kw(hour: float) -> float:
    return _interp(HOURLY_DEMAND_KW, hour)


def clear_sky_solar_kw(hour: float) -> float:
    return _interp(HOURLY_SOLAR_KW, hour)


def zone_baseline_kw(zone: ZoneSpec, hour: float) -> float:
    """A building's no-AI demand at a given hour (its share of the campus profile)."""
    return zone.share * campus_demand_kw(hour)
