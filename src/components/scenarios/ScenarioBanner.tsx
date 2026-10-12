import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CircleCheck, Hand, RotateCcw, Timer } from "lucide-react";
import { useScenarioStore } from "@/store/scenarioStore";
import { Badge, Button, IconTile } from "@/components/ui";
import { formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";
import { SCENARIOS } from "./scenarioMeta";

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Live elapsed time since the scenario started; stops once the grid is stable. */
function useElapsed(startedAtMs: number, stoppedAtMs: number | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (stoppedAtMs) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [stoppedAtMs]);
  return mmss((stoppedAtMs ?? now) - startedAtMs);
}

/**
 * Calm alert shown while a scenario runs: what happened, what the agents are
 * doing, and how long recovery took. Offers "Replay" once stable.
 */
export function ScenarioBanner({ className }: { className?: string }) {
  const active = useScenarioStore((s) => s.active);
  const phase = useScenarioStore((s) => s.phase);
  const history = useScenarioStore((s) => s.history);
  const end = useScenarioStore((s) => s.end);
  const replay = useScenarioStore((s) => s.replay);
  const [busy, setBusy] = useState(false);
  const elapsed = useElapsed(active?.startedAtMs ?? 0, active?.stabilisedAtMs ?? null);
  if (!active) return null;

  const meta = SCENARIOS[active.type];
  const Icon = meta.icon;
  const stable = phase === "stable";
  const outcome = history[active.type]?.at(-1);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center",
        stable ? "border-success/35 bg-success/6" : "border-warning/40 bg-warning/8",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <IconTile
          icon={stable ? <CircleCheck /> : phase === "awaiting-approval" ? <Hand /> : <Icon />}
          tone={stable ? "success" : "warning"}
          size="md"
        />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-fg">
            {meta.title} · {active.incidentId}
            {outcome && outcome.run > 1 && stable && <span className="font-medium text-fg-muted"> · run {outcome.run}</span>}
          </p>
          <p className="mt-0.5 text-sm text-fg-muted">
            {phase === "responding" && "Agents are responding. Watch the thought trace."}
            {phase === "awaiting-approval" && "A high-impact plan is waiting for your approval in the thought trace."}
            {stable &&
              (outcome
                ? `Stable again. Recovery took ${formatNumber(outcome.recoveryMin, 1)} min in the digital twin, vs ${formatNumber(outcome.baselineMin, 0)} min with no AI.`
                : "Stable again. Every protected zone kept power.")}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
        {!stable && (
          <Badge tone="warning" icon={<Timer />} aria-label={`Elapsed ${elapsed}`}>
            <span className="font-mono tabular">{elapsed}</span>
          </Badge>
        )}
        {stable && (
          <Button size="sm" disabled={busy} onClick={() => act(replay)}>
            <RotateCcw /> Replay same scenario
          </Button>
        )}
        <Button size="sm" disabled={busy || phase === "responding"} onClick={() => act(end)}>
          End scenario
        </Button>
      </div>
    </motion.div>
  );
}
