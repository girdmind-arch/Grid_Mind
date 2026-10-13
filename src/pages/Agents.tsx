import { Link } from "react-router";
import { Play } from "lucide-react";
import { useScenarioStore } from "@/store/scenarioStore";
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { AgentCard } from "@/components/agents/AgentCard";
import { ThoughtTrace } from "@/components/agents/ThoughtTrace";
import { useLiveAgents } from "@/components/agents/useLiveAgents";
import { formatTime } from "@/utils/format";

export default function Agents() {
  const { agents, status, error, retry } = useLiveAgents();
  const phase = useScenarioStore((s) => s.phase);
  const decisions = useScenarioStore((s) => s.decisions);
  const busy = agents?.filter((a) => a.status !== "idle") ?? [];

  const liveLine =
    phase === "responding"
      ? `${busy.map((a) => a.name).join(", ")} are working on a scenario right now.`
      : phase === "awaiting-approval"
        ? "The Guardrail paused a high-impact plan. It is waiting for your approval."
        : decisions[0]
          ? `All agents are idle. Last decision at ${formatTime(decisions[0].startedAt)}.`
          : "All agents are idle.";

  return (
    <>
      <PageHeader title="Agents" description="The seven agents and what each one is doing right now." />

      <Card variant="hero" padding="lg">
        <Badge tone="onHero" size="sm" dot pulse={phase !== "idle" && phase !== "stable"}>
          Live
        </Badge>
        <h2 className="mt-4 max-w-2xl text-[26px] leading-tight font-bold tracking-tight sm:text-[30px]">
          Seven agents. One loop. Every decision explained.
        </h2>
        <p className="mt-2.5 max-w-xl text-[15px] text-hero-text-muted" aria-live="polite">
          {liveLine}
        </p>
        <Button asChild variant="onHero" size="lg" className="mt-6">
          <Link to="/app/scenarios">
            <Play /> Watch them handle a fault
          </Link>
        </Button>
      </Card>

      {status === "error" && !agents && <ErrorState className="mt-4" message={error ?? undefined} onRetry={retry} />}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents
          ? agents.map((a) => <AgentCard key={a.id} agent={a} />)
          : status !== "error" && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-64" />)}
      </div>

      {/* Folded away: the full reasoning behind every decision so far. */}
      <details id="decisions" className="group mt-8 max-w-3xl rounded-lg border border-border bg-surface shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-base font-semibold text-fg [&::-webkit-details-marker]:hidden">
          Decision history
          <span className="text-sm font-medium text-fg-muted">
            {decisions.length} {decisions.length === 1 ? "decision" : "decisions"} · <span className="text-accent group-open:hidden">Show</span>
            <span className="hidden text-accent group-open:inline">Hide</span>
          </span>
        </summary>
        <div className="border-t border-border p-5">
          <ThoughtTrace />
        </div>
      </details>
    </>
  );
}
