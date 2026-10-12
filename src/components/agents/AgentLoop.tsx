import { ArrowDown, ArrowRight, RotateCcw, UtilityPole } from "lucide-react";
import type { Agent, AgentId } from "@/types/agents";
import { Card, IconTile } from "@/components/ui";
import { cn } from "@/utils/cn";
import { AGENT_LOOK } from "./agentMeta";

// How the agents connect, as one loop:
//   Sense → Decide → Test → Check → Act, and the Critic feeds lessons back in.

const STAGES: { label: string; caption: string; agents: AgentId[] }[] = [
  { label: "Sense", caption: "What is happening?", agents: ["forecaster", "zone", "fault"] },
  { label: "Decide", caption: "What should we do?", agents: ["commander"] },
  { label: "Test", caption: "Try Plan A and B in the digital twin", agents: ["planner"] },
  { label: "Check", caption: "Hard rules, and you for big actions", agents: ["guardrail"] },
];

function AgentChip({ agent }: { agent: Agent }) {
  const { icon: Icon, tone } = AGENT_LOOK[agent.id];
  const busy = agent.status !== "idle";
  return (
    <a
      href={`#agent-${agent.id}`}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-md border bg-surface px-2.5 py-1.5 text-sm font-semibold text-fg transition-colors hover:border-border-strong",
        busy ? "border-ai/50 shadow-glow-ai" : "border-border",
      )}
    >
      <IconTile icon={<Icon />} tone={tone} size="sm" className="size-7" />
      <span className="min-w-0 flex-1 truncate">{agent.name}</span>
      {busy && <span aria-label="busy" className="size-2 shrink-0 animate-pulse-soft rounded-full bg-ai" />}
    </a>
  );
}

function Arrow() {
  return (
    <div aria-hidden className="flex items-center justify-center text-fg-subtle">
      <ArrowDown className="size-5 lg:hidden" />
      <ArrowRight className="hidden size-5 lg:block" />
    </div>
  );
}

export function AgentLoop({ agents }: { agents: Agent[] }) {
  const byId = Object.fromEntries(agents.map((a) => [a.id, a])) as Record<AgentId, Agent>;
  const critic = byId.critic;

  return (
    <Card>
      <h2 className="text-base font-semibold text-fg">How the agents work together</h2>
      <p className="mt-1 text-sm text-fg-muted">Every decision goes through the same loop. Nothing reaches the grid without passing the Guardrail.</p>

      <ol className="mt-5 grid items-stretch gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_minmax(112px,0.6fr)]">
        {STAGES.map((stage, i) => {
          const busy = stage.agents.some((id) => byId[id]?.status !== "idle");
          return (
            <li key={stage.label} className="contents">
              <div className={cn("rounded-lg border p-3", busy ? "border-ai/40 bg-ai/6" : "border-border bg-surface-sunken")}>
                <p className="micro-label text-fg-subtle">
                  {i + 1} · {stage.label}
                </p>
                <p className="mt-0.5 mb-2.5 text-[13px] text-fg-muted">{stage.caption}</p>
                <div className="space-y-1.5">
                  {stage.agents.map((id) => byId[id] && <AgentChip key={id} agent={byId[id]} />)}
                </div>
              </div>
              <Arrow />
            </li>
          );
        })}
        <li className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-sunken p-3 lg:flex-col lg:justify-center lg:text-center">
          <IconTile icon={<UtilityPole />} tone="accent" size="sm" />
          <div>
            <p className="micro-label text-fg-subtle">5 · Act</p>
            <p className="text-[13px] text-fg-muted">On the grid</p>
          </div>
        </li>
      </ol>

      {critic && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-dashed border-border-strong p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <RotateCcw aria-hidden className="size-5 shrink-0 text-success" />
            <div>
              <p className="micro-label text-fg-subtle">6 · Learn</p>
              <p className="text-[13px] text-fg-muted">The Critic scores the result and feeds lessons back into step 2.</p>
            </div>
          </div>
          <div className="sm:ml-auto sm:w-56">
            <AgentChip agent={critic} />
          </div>
        </div>
      )}
    </Card>
  );
}
