import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, GraduationCap } from "lucide-react";
import type { FaultType } from "@/types/grid";
import type { Results, ScenarioOutcome, ScenarioRunHistory } from "@/types/agents";
import { IconTile } from "@/components/ui";
import { SCENARIOS } from "@/components/scenarios/scenarioMeta";
import { formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";

type Filter = "all" | FaultType;

interface Tile {
  run: number;
  recoveryMin: number;
  /** Second line under the meter, e.g. "18.4% cost saved". */
  value: string;
  caption: string;
}

/**
 * Run 1 → Run 2 → Run 3: scenarios replayed. Each run the agents reuse lessons
 * from Memory, so recovery gets faster. "All scenarios" shows the averages;
 * picking one shows that scenario's runs and the lesson it reused.
 * Three numbers per view, so this is a row of figures with a meter, not a chart.
 */
export function RunImprovement({
  runs,
  baselineMin,
  history,
  sessionRuns,
}: {
  runs: Results["runs"];
  baselineMin: number;
  /** Per-scenario runs; the picker appears once they have loaded. */
  history?: ScenarioRunHistory[];
  /** Runs the operator did on the Scenarios page in this session. */
  sessionRuns: Partial<Record<FaultType, ScenarioOutcome[]>>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const scenario = filter === "all" ? undefined : history?.find((h) => h.type === filter);

  const base = scenario?.baselineMin ?? baselineMin;
  const tiles: Tile[] = scenario
    ? scenario.runs.map((r) => ({
        run: r.run,
        recoveryMin: r.recoveryMin,
        value: `${formatNumber((1 - r.recoveryMin / scenario.baselineMin) * 100)}%`,
        caption: "faster",
      }))
    : runs.map((r) => ({ run: r.run, recoveryMin: r.recoveryMin, value: `${formatNumber(r.costSavedPct, 1)}%`, caption: "cost saved" }));
  const lesson = scenario?.runs.at(-1)?.lessonApplied;
  const mine = filter === "all" ? [] : (sessionRuns[filter] ?? []);

  return (
    <section className="min-w-0 break-inside-avoid print:shadow-none rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2.5">
        <IconTile icon={<GraduationCap />} tone="ai" size="sm" />
        <h2 className="text-base font-semibold text-fg">Better with every run</h2>
      </div>
      <p className="mt-2 text-sm text-fg-muted">
        {scenario
          ? `${SCENARIOS[scenario.type].title}, replayed three times. Runs 2 and 3 reuse what run 1 learned.`
          : "All four scenarios, replayed three times. Each run reuses the lessons from the one before."}
      </p>

      {history && (
        <div role="group" aria-label="Show runs for" className="mt-4 flex flex-wrap gap-1.5 print:hidden">
          {(["all", ...history.map((h) => h.type)] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors pointer-coarse:h-11",
                filter === f ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-surface text-fg-muted hover:text-fg",
              )}
            >
              {f === "all" ? "All scenarios" : SCENARIOS[f].title}
            </button>
          ))}
        </div>
      )}

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiles.map((t, i) => (
          <li key={t.run} className="relative rounded-md bg-surface-sunken p-4">
            {i > 0 && (
              <ArrowRight
                aria-hidden
                strokeWidth={1.75}
                className="absolute top-1/2 -left-3 hidden size-4 -translate-y-1/2 text-fg-subtle sm:block"
              />
            )}
            <p className="micro-label text-fg-muted">Run {t.run}</p>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-semibold tracking-[-0.03em] text-fg">{formatNumber(t.recoveryMin, 1)}</span>
              <span className="text-sm font-medium text-fg-muted">min</span>
            </p>
            <p className="text-sm text-fg-muted">to recover</p>
            <div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-chart-1" style={{ width: `${(t.recoveryMin / base) * 100}%` }} />
            </div>
            <p className="mt-3 text-sm text-fg-muted">
              <span className="font-mono font-semibold text-fg">{t.value}</span> {t.caption}
            </p>
          </li>
        ))}
      </ol>

      {lesson && (
        <p className="mt-4 rounded-md bg-surface-sunken px-3 py-2.5 text-sm text-fg-muted">
          <span className="font-semibold text-ai">Lesson reused: </span>
          {lesson}
        </p>
      )}

      {mine.length > 0 && (
        <p className="mt-3 text-sm text-fg-muted">
          <span className="font-semibold text-fg">Your runs this session: </span>
          {mine.map((r) => `run ${r.run} ${formatNumber(r.recoveryMin, 1)} min`).join(" · ")}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-fg-muted">
          <span aria-hidden className="mr-2 inline-block h-2 w-6 rounded-full bg-chart-2 align-middle" />
          The no-AI baseline takes <span className="font-mono font-semibold text-fg">{formatNumber(base)} min</span> every run. It
          never learns.
        </p>
        <Link
          to="/app/memory"
          className="inline-flex shrink-0 items-center gap-1 font-semibold text-accent hover:text-accent-hover print:hidden"
        >
          See the lessons <ArrowRight aria-hidden className="size-4" strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}
