import { Link } from "react-router";
import { ArrowRight, GraduationCap } from "lucide-react";
import type { Results } from "@/types/agents";
import { IconTile } from "@/components/ui";
import { formatNumber } from "@/utils/format";

/**
 * Run 1 → Run 2 → Run 3: the same four scenarios replayed. Each run the agents
 * reuse lessons from Memory, so recovery gets faster and savings grow.
 * Three numbers per metric, so this is a row of figures with a meter, not a chart.
 */
export function RunImprovement({ runs, baselineMin }: { runs: Results["runs"]; baselineMin: number }) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2.5">
        <IconTile icon={<GraduationCap />} tone="ai" size="sm" />
        <h2 className="text-base font-semibold text-fg">Better with every run</h2>
      </div>
      <p className="mt-2 text-sm text-fg-muted">
        All four scenarios, replayed three times. Each run reuses the lessons from the one before.
      </p>

      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {runs.map((r, i) => (
          <li key={r.run} className="relative rounded-md bg-surface-sunken p-4">
            {i > 0 && (
              <ArrowRight
                aria-hidden
                strokeWidth={1.75}
                className="absolute top-1/2 -left-3 hidden size-4 -translate-y-1/2 text-fg-subtle sm:block"
              />
            )}
            <p className="micro-label text-fg-muted">Run {r.run}</p>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-semibold tracking-[-0.03em] text-fg">{formatNumber(r.recoveryMin, 1)}</span>
              <span className="text-sm font-medium text-fg-muted">min</span>
            </p>
            <p className="text-sm text-fg-muted">to recover</p>
            <div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-chart-1" style={{ width: `${(r.recoveryMin / baselineMin) * 100}%` }} />
            </div>
            <p className="mt-3 text-sm text-fg-muted">
              <span className="font-mono font-semibold text-fg">{formatNumber(r.costSavedPct, 1)}%</span> cost saved
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-fg-muted">
          <span aria-hidden className="mr-2 inline-block h-2 w-6 rounded-full bg-chart-2 align-middle" />
          The no-AI baseline takes <span className="font-mono font-semibold text-fg">{formatNumber(baselineMin)} min</span> every run. It
          never learns.
        </p>
        <Link to="/app/memory" className="inline-flex shrink-0 items-center gap-1 font-semibold text-accent hover:text-accent-hover">
          See the lessons <ArrowRight aria-hidden className="size-4" strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}
