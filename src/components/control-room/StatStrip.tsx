import { Battery, Gauge, IndianRupee, SunMedium, UtilityPole } from "lucide-react";
import type { GridState } from "@/types/grid";
import { StatTile } from "@/components/ui";

/** Demand · Solar · Battery % · Grid draw · Cost today */
export function StatStrip({ state }: { state: GridState }) {
  const t = state.trends;
  const outage = state.activeFault?.type === "grid_outage";
  const batteryKw = Math.max(0, -state.battery.powerKw);
  return (
    <section aria-label="Grid at a glance" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatTile label="Demand" value={state.demandKw} unit="kW" icon={<Gauge />} tone="accent" trend={t.demand} trendLabel={t.demand === "up" ? "Rising to peak" : undefined} />
      <StatTile label="Solar" value={state.solarKw} unit="kW" icon={<SunMedium />} tone="solar" trend={t.solar} trendLabel={t.solar === "down" ? "Fading to sunset" : undefined} />
      <StatTile
        label="Battery"
        value={state.battery.socPct}
        unit="%"
        icon={<Battery />}
        tone="success"
        trend={t.battery}
        trendLabel={batteryKw > 0 ? `Supplying ${batteryKw} kW` : "Holding for peak"}
      />
      <StatTile
        label="Grid draw"
        value={state.gridImportKw}
        unit="kW"
        icon={<UtilityPole />}
        tone="accent"
        trend={outage ? "flat" : t.grid}
        trendLabel={outage ? "Grid offline" : undefined}
      />
      <StatTile
        label="Cost today"
        value={state.costTodayInr}
        prefix="₹"
        icon={<IndianRupee />}
        tone="neutral"
        trend={t.cost}
        trendLabel={`${state.tariff.label.split(" · ")[0]} rate ₹${state.tariff.ratePerKwh.toFixed(2)}`}
        className="col-span-2 sm:col-span-1"
      />
    </section>
  );
}
