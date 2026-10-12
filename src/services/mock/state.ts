// MOCK: in-memory grid state. The real backend owns this state; here it lives
// in the browser so the demo works offline.

import type { ActiveFault, FaultRequest, GridState, PowerFlow, Zone } from "@/types/grid";
import { BATTERY_CAPACITY_KWH, SIM_START, ZONES, tariffAt } from "./campus";

let activeFault: ActiveFault | null = null;
let incidentCounter = 41; // continues after the incidents in memory.ts

function zonesWithFault(): Zone[] {
  return ZONES.map((z) => {
    if (activeFault?.type === "line_failure" && activeFault.targetZoneId === z.id) {
      return { ...z, status: "isolated", demandKw: 0 };
    }
    if (activeFault?.type === "grid_outage" && z.kind === "hostel") {
      // Hostels are reduced first so labs keep full power.
      return { ...z, status: "reduced", demandKw: Math.round(z.demandKw * 0.6) };
    }
    if (activeFault?.type === "heatwave") {
      return { ...z, demandKw: Math.round(z.demandKw * (1 + activeFault.severity * 0.04)) };
    }
    return z;
  });
}

// MOCK: builds a consistent snapshot. Solar + battery + grid always equals demand.
export function buildGridState(now: Date): GridState {
  const zones = zonesWithFault();
  const demandKw = zones.reduce((sum, z) => sum + z.demandKw, 0);

  let solarKw = 310;
  if (activeFault?.type === "cloud_cover") solarKw = Math.round(310 * (1 - activeFault.severity * 0.15));

  const outage = activeFault?.type === "grid_outage";
  const batteryDischargeKw = outage ? demandKw - solarKw : 0;
  const gridImportKw = outage ? 0 : demandKw - solarKw;
  const socPct = outage ? 79 : 82;

  const flows: PowerFlow[] = [
    { from: "solar", to: "bus", kw: solarKw },
    { from: "battery", to: "bus", kw: batteryDischargeKw },
    { from: "grid", to: "bus", kw: gridImportKw },
    ...zones.map((z) => ({ from: "bus", to: z.id, kw: z.demandKw })),
  ];

  return {
    timestamp: now.toISOString(),
    mode: "ai",
    demandKw,
    solarKw,
    gridImportKw,
    battery: { socPct, powerKw: -batteryDischargeKw, capacityKwh: BATTERY_CAPACITY_KWH },
    costTodayInr: 41_250,
    tariff: tariffAt(17),
    trends: { demand: "up", solar: "down", battery: outage ? "down" : "flat", grid: "up", cost: "up" },
    zones,
    flows,
    activeFault,
  };
}

export function startFault(req: FaultRequest): ActiveFault {
  incidentCounter += 1;
  activeFault = { ...req, incidentId: `INC-${incidentCounter}`, startedAt: new Date().toISOString() };
  return activeFault;
}

export function clearFault() {
  activeFault = null;
}

export const simStart = () => new Date(SIM_START);
