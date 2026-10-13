import { useEffect } from "react";
import { Activity } from "lucide-react";
import type { FaultType } from "@/types/grid";
import { getGridState } from "@/services";
import { useService } from "@/hooks/useService";
import { useScenarioStore } from "@/store/scenarioStore";
import { Badge, Card, ErrorState, IconTile, PageHeader, Skeleton } from "@/components/ui";
import { GridDiagram } from "@/components/grid/GridDiagram";
import { LatestDecision } from "@/components/control-room/LatestDecision";
import { ScenarioBanner } from "@/components/scenarios/ScenarioBanner";
import { ScenarioHero } from "@/components/scenarios/ScenarioHero";
import { ScenarioConfigCard } from "@/components/scenarios/ScenarioConfigCard";
import { SCENARIO_ORDER } from "@/components/scenarios/scenarioMeta";

export default function Scenarios() {
  const { phase, active, history, decisions, gridVersion, run, loadTrace } = useScenarioStore();
  const grid = useService(getGridState, [gridVersion]);
  // Show the decision for the running scenario once it exists.
  const shown = (active && decisions.find((d) => d.incidentId === active.incidentId)) || decisions[0];
  const busy = phase === "responding" || phase === "awaiting-approval";

  useEffect(() => {
    void loadTrace();
  }, [loadTrace]);

  const start = (type: FaultType, severity = 3, durationMin = 30) => {
    void run(type, { severity, durationMin });
    // Bring the live response into view (top of the page).
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <>
      <PageHeader
        title="Scenarios"
        description="Pick a failure, set how bad it is, and watch the agents respond in real time."
      />

      {!active && <ScenarioHero onTry={() => start("line_failure")} disabled={busy} />}

      {active && (
        <div className="space-y-4">
          <ScenarioBanner />
          <div className="grid gap-4 xl:grid-cols-12">
            <Card className="min-w-0 xl:col-span-8">
              <div className="mb-5 flex items-center gap-2.5">
                <IconTile icon={<Activity />} tone="accent" size="sm" />
                <h2 className="text-base font-semibold text-fg">Live grid</h2>
                <Badge tone="success" size="sm" dot pulse className="ml-auto">
                  Live
                </Badge>
              </div>
              {grid.status === "error" && !grid.data ? (
                <ErrorState message={grid.error} onRetry={grid.retry} />
              ) : grid.data ? (
                <GridDiagram state={grid.data} />
              ) : (
                <Skeleton className="h-[420px]" />
              )}
            </Card>
            <LatestDecision decision={shown} className="min-w-0 xl:col-span-4" />
          </div>
        </div>
      )}

      <section aria-labelledby="pick-title" className="mt-8">
        <div className="mb-4 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <h2 id="pick-title" className="text-lg font-bold text-fg">
            {active ? "Run another scenario" : "Choose a scenario"}
          </h2>
          <p className="text-[13px] text-fg-muted">
            {busy ? "Wait for the agents to finish the current one." : "Each run is tested in the digital twin first."}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {SCENARIO_ORDER.map((type) => (
            <ScenarioConfigCard
              key={type}
              type={type}
              onRun={start}
              disabled={busy}
              running={active?.type === type}
              runs={history[type]}
            />
          ))}
        </div>
      </section>
    </>
  );
}
