import { GraduationCap } from "lucide-react";
import type { FaultType } from "@/types/grid";
import type { ScenarioOutcome } from "@/types/agents";
import { Card, IconTile } from "@/components/ui";
import { formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";
import { SCENARIOS } from "./scenarioMeta";

interface LearningCurveProps {
  type: FaultType;
  runs: ScenarioOutcome[];
  className?: string;
}

/** Recovery time for each run of one scenario vs. the no-AI baseline. Shows learning. */
export function LearningCurve({ type, runs, className }: LearningCurveProps) {
  const shown = runs.slice(-3);
  const baseline = shown.at(-1)?.baselineMin ?? 0;
  const latest = shown.at(-1);
  const first = shown[0];
  const improvement = first && latest && shown.length > 1 ? Math.round((1 - latest.recoveryMin / first.recoveryMin) * 100) : null;

  const rows = [
    { key: "baseline", label: "No-AI baseline", value: baseline, bar: "bg-chart-2" },
    ...shown.map((r) => ({ key: `run-${r.run}`, label: `GridMind · run ${r.run}`, value: r.recoveryMin, bar: "bg-accent" })),
  ];

  return (
    <Card className={className}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={<GraduationCap />} tone="ai" size="sm" />
        <h2 className="text-base font-semibold text-fg">Learning from replays · {SCENARIOS[type].title}</h2>
      </div>
      <p className="mt-2 text-sm text-fg-muted">
        Minutes from fault to a stable grid, measured in the digital twin.
        {improvement !== null && improvement > 0 && (
          <>
            {" "}
            <span className="font-semibold text-success">{improvement}% faster</span> than the first run.
          </>
        )}
      </p>

      <dl className="mt-5 space-y-3.5">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <dt className={cn(r.key === "baseline" ? "text-fg-muted" : "font-medium text-fg")}>{r.label}</dt>
              <dd className="font-mono font-semibold tabular text-fg">{formatNumber(r.value, 1)} min</dd>
            </div>
            <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className={cn("h-full rounded-full transition-[width] duration-500 ease-out", r.bar)}
                style={{ width: `${Math.max(3, (r.value / baseline) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </dl>

      <p className="mt-5 rounded-md bg-surface-sunken px-3 py-2.5 text-sm text-fg-muted">
        {latest?.lessonApplied ? (
          <>
            <span className="font-semibold text-ai">Lesson applied: </span>
            {latest.lessonApplied}
          </>
        ) : (
          "Replay this scenario to see the agents use what they learned and recover faster."
        )}
      </p>
    </Card>
  );
}
