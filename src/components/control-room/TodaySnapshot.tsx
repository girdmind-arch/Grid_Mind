import { Link } from "react-router";
import { ArrowRight, PiggyBank } from "lucide-react";
import type { GridState } from "@/types/grid";
import { Card, IconTile } from "@/components/ui";
import { useCountUp } from "@/hooks/useCountUp";
import { formatInr, formatNumber } from "@/utils/format";

/** Cost so far today: GridMind vs. the no-AI baseline. */
export function TodaySnapshot({ state, className }: { state: GridState; className?: string }) {
  const saved = state.baselineCostTodayInr - state.costTodayInr;
  const pct = state.baselineCostTodayInr > 0 ? (saved / state.baselineCostTodayInr) * 100 : 0;
  // Early in the day GridMind can be behind: it bought cheap night power to store in the battery.
  const ahead = saved >= 0;
  const animatedSaved = useCountUp(Math.abs(saved));
  const top = Math.max(state.baselineCostTodayInr, state.costTodayInr, 1);
  const rows = [
    { label: "GridMind", value: state.costTodayInr, bar: "bg-accent" },
    { label: "No-AI baseline", value: state.baselineCostTodayInr, bar: "bg-chart-2" },
  ];

  return (
    <Card className={className}>
      <div className="mb-4 flex items-center gap-2.5">
        <IconTile icon={<PiggyBank />} tone="success" size="sm" />
        <h2 className="text-base font-semibold text-fg">Today's snapshot</h2>
      </div>
      <p className="text-sm text-fg-muted">{ahead ? "Saved vs. no-AI baseline" : "Invested in battery charge so far"}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className={`font-mono text-3xl font-semibold tracking-tight tabular ${ahead ? "text-success" : "text-fg"}`}>
          ₹{formatNumber(animatedSaved)}
        </span>
        <span className="text-sm font-semibold text-fg-muted">
          {ahead ? `${formatNumber(pct)}% less` : "cheap night power, used in the evening peak"}
        </span>
      </p>

      <dl className="mt-5 space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex justify-between text-sm">
              <dt className="text-fg-muted">{r.label}</dt>
              <dd className="font-mono font-medium tabular text-fg">{formatInr(r.value)}</dd>
            </div>
            <div aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-sunken">
              <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${(r.value / top) * 100}%` }} />
            </div>
          </div>
        ))}
      </dl>

      <Link to="/app/results" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
        See full results <ArrowRight className="size-4" />
      </Link>
    </Card>
  );
}
