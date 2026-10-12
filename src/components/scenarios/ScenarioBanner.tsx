import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CircleCheck, Hand, Timer } from "lucide-react";
import { useScenarioStore } from "@/store/scenarioStore";
import { Badge, Button, IconTile } from "@/components/ui";
import { cn } from "@/utils/cn";
import { SCENARIOS } from "./scenarioMeta";

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Live elapsed time, frozen once the grid is stable. */
function useRecoveryTimer(startedAtMs: number, stabilisedAtMs: number | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (stabilisedAtMs) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [stabilisedAtMs]);
  return mmss((stabilisedAtMs ?? now) - startedAtMs);
}

/** Calm alert shown while a scenario runs: what happened, what agents are doing, recovery time. */
export function ScenarioBanner({ className }: { className?: string }) {
  const active = useScenarioStore((s) => s.active);
  const phase = useScenarioStore((s) => s.phase);
  const end = useScenarioStore((s) => s.end);
  const [ending, setEnding] = useState(false);
  const timer = useRecoveryTimer(active?.startedAtMs ?? 0, active?.stabilisedAtMs ?? null);
  if (!active) return null;

  const meta = SCENARIOS[active.type];
  const Icon = meta.icon;
  const stable = phase === "stable";

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center",
        stable ? "border-success/35 bg-success/6" : "border-warning/40 bg-warning/8",
        className,
      )}
    >
      <IconTile icon={stable ? <CircleCheck /> : phase === "awaiting-approval" ? <Hand /> : <Icon />} tone={stable ? "success" : "warning"} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-fg">
          {meta.title} scenario · {active.incidentId}
        </p>
        <p className="mt-0.5 text-sm text-fg-muted">
          {phase === "responding" && "Agents are responding. Watch the thought trace."}
          {phase === "awaiting-approval" && "A high-impact plan is waiting for your approval in the thought trace."}
          {stable && "Recovered. The grid is stable and every protected zone kept power."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={stable ? "success" : "warning"} icon={<Timer />} aria-label={`${stable ? "Recovered in" : "Elapsed"} ${timer}`}>
          <span className="font-mono tabular">{stable ? `Recovered in ${timer}` : timer}</span>
        </Badge>
        <Button
          size="sm"
          disabled={ending || phase === "responding"}
          onClick={async () => {
            setEnding(true);
            await end();
            setEnding(false);
          }}
        >
          End scenario
        </Button>
      </div>
    </motion.div>
  );
}
