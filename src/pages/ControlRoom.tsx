import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import type { FaultType, GridState } from "@/types/grid";
import { getGridState } from "@/services";
import { useService } from "@/hooks/useService";
import { useSimClock } from "@/hooks/useSimClock";
import { useAppStore } from "@/store/appStore";
import { useScenarioStore } from "@/store/scenarioStore";
import { Badge, Card, ErrorState, IconTile, Modal, PageHeader, Skeleton } from "@/components/ui";
import { GridDiagram, GridLegend } from "@/components/grid/GridDiagram";
import { ThoughtTrace } from "@/components/agents/ThoughtTrace";
import { ScenarioCard } from "@/components/scenarios/ScenarioCard";
import { ScenarioBanner } from "@/components/scenarios/ScenarioBanner";
import { SCENARIO_ORDER } from "@/components/scenarios/scenarioMeta";
import { SituationHero } from "@/components/control-room/SituationHero";
import { GoalCard } from "@/components/control-room/GoalCard";
import { StatStrip } from "@/components/control-room/StatStrip";
import { UpNext } from "@/components/control-room/UpNext";
import { TodaySnapshot } from "@/components/control-room/TodaySnapshot";
import { describeSituation } from "@/components/control-room/situation";
import { formatDate, greeting } from "@/utils/format";

function systemSummary(state: GridState | undefined) {
  if (!state) return "Reading the grid…";
  const total = state.zones.length;
  const powered = state.zones.filter((z) => z.status !== "faulted" && z.status !== "isolated").length;
  const reduced = state.zones.filter((z) => z.status === "reduced").length;
  if (powered < total) return `${powered} of ${total} zones powered. Agents are working on the rest.`;
  if (reduced) return `All ${total} zones powered, ${reduced} running reduced. Labs at full power.`;
  return `All ${total} zones powered. No faults.`;
}

export default function ControlRoom() {
  const now = useSimClock(15_000);
  const mode = useAppStore((s) => s.mode);
  const { gridVersion, decisions, phase, active, run, loadTrace } = useScenarioStore();
  const grid = useService(getGridState, [gridVersion]);
  const [gridOpen, setGridOpen] = useState(false);
  const gridCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadTrace();
  }, [loadTrace]);

  // The hero talks about the scenario's decision while one runs, otherwise the standing plan.
  const latest = active ? decisions.find((d) => d.incidentId === active.incidentId) : decisions.find((d) => !d.incidentId);
  const situation = grid.data
    ? describeSituation(grid.data, latest, phase, now)
    : { headline: "Reading the grid…", detail: "" };

  const busy = phase === "responding" || phase === "awaiting-approval";
  const runScenario = (type: FaultType) => {
    void run(type);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gridCardRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };

  return (
    <>
      <PageHeader
        eyebrow={`Control Room · ${formatDate(now)}`}
        title={`${greeting(now)}, Operator`}
        description={systemSummary(grid.data)}
      />

      <ScenarioBanner className="mb-4" />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <SituationHero
            headline={situation.headline}
            detail={situation.detail}
            mode={mode}
            onOpenGrid={() => setGridOpen(true)}
          />
        </div>
        <GoalCard className="lg:col-span-4" />
      </div>

      <div className="mt-4">
        {grid.status === "error" && !grid.data ? (
          <ErrorState message={grid.error} onRetry={grid.retry} />
        ) : grid.data ? (
          <StatStrip state={grid.data} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className={i === 4 ? "col-span-2 h-[122px] sm:col-span-1" : "h-[122px]"} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <div className="min-w-0 space-y-4 xl:col-span-8">
          <Card ref={gridCardRef} className="scroll-mt-24">
            <div className="mb-5 flex items-center gap-2.5">
              <IconTile icon={<Activity />} tone="accent" size="sm" />
              <h2 className="text-base font-semibold text-fg">Live grid</h2>
              <Badge tone="success" size="sm" dot pulse className="ml-auto">
                Live
              </Badge>
            </div>
            {grid.data ? <GridDiagram state={grid.data} /> : <Skeleton className="h-[420px]" />}
            <GridLegend className="mt-5 border-t border-border pt-4" />
          </Card>

          <section aria-labelledby="scenarios-title">
            <div className="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <h2 id="scenarios-title" className="text-base font-semibold text-fg">
                Break the grid on purpose
              </h2>
              <p className="text-[13px] text-fg-muted">{busy ? "Wait for the agents to finish." : "Watch the agents respond."}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {SCENARIO_ORDER.map((type) => (
                <ScenarioCard key={type} type={type} onRun={runScenario} disabled={busy} running={active?.type === type} />
              ))}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <UpNext />
            {grid.data ? <TodaySnapshot state={grid.data} /> : <Skeleton className="h-72" />}
          </div>
        </div>

        <div className="min-w-0 xl:col-span-4">
          <ThoughtTrace className="xl:sticky xl:top-[calc(var(--topbar-h)+16px)] xl:max-h-[calc(100dvh-var(--topbar-h)-32px)] xl:overflow-y-auto xl:pr-1" />
        </div>
      </div>

      <Modal open={gridOpen} onOpenChange={setGridOpen} title="Live grid" description={systemSummary(grid.data)} variant="full">
        <div className="mx-auto w-full max-w-5xl py-2">
          {grid.data && <GridDiagram state={grid.data} />}
          <GridLegend className="mt-6" />
        </div>
      </Modal>
    </>
  );
}
