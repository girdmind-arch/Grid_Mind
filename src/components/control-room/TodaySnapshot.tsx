import { Link } from "react-router";
import { ArrowRight, PiggyBank } from "lucide-react";
import type { GridState } from "@/types/grid";
import { Card, IconTile } from "@/components/ui";
import { useCountUp } from "@/hooks/useCountUp";
import { formatInr, formatNumber } from "@/utils/format";

/** Cost so far today: GridMind vs. the no-AI baseline. */
export function TodaySnapshot({ state, className }: { state: GridState; className?: string }) {
  const saved = state.baselineCostTodayInr - state.costTodayInr;
  const pct = (saved / state.baselineCostTodayInr) * 100;
  const animatedSaved = useCountUp(saved);
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
      <p className="text-sm text-fg-muted">Saved vs. no-AI baseline</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-3xl font-semibold tracking-tight tabular text-success">₹{formatNumber(animatedSaved)}</span>
        <span className="text-sm font-semibold text-fg-muted">{formatNumber(pct)}% less</span>
      </p>

      <dl className="mt-5 space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex justify-between text-sm">
              <dt className="text-fg-muted">{r.label}</dt>
              <dd className="font-mono font-medium tabular text-fg">{formatInr(r.value)}</dd>
            </div>
            <div aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-sunken">
              <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${(r.value / state.baselineCostTodayInr) * 100}%` }} />
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
