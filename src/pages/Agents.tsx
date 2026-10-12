import { Link } from "react-router";
import { Play } from "lucide-react";
import { useScenarioStore } from "@/store/scenarioStore";
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentLoop } from "@/components/agents/AgentLoop";
import { GuardrailRules } from "@/components/agents/GuardrailRules";
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
          ? `All agents are idle. Last decision at ${formatTime(decisions[0].startedAt)}: “${decisions[0].title}”.`
          : "All agents are idle.";

  const regular = agents?.filter((a) => a.id !== "guardrail") ?? [];
  const guardrail = agents?.find((a) => a.id === "guardrail");

  return (
    <>
      <PageHeader title="Agents" description="Who the agents are, what they are doing right now, and how they decide." />

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

      {!agents && status !== "error" && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      )}

      {agents && (
        <>
          <div className="mt-4">
            <AgentLoop agents={agents} />
          </div>

          <section aria-labelledby="roster-title" className="mt-8">
            <h2 id="roster-title" className="mb-4 text-lg font-bold text-fg">
              The team
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {regular.map((a) => (
                <AgentCard key={a.id} agent={a} />
              ))}
              {guardrail && (
                <AgentCard agent={guardrail} className="md:col-span-2 xl:col-span-3">
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="mb-3 text-sm font-semibold text-fg">Hard rules no agent can override</p>
                    <GuardrailRules columns={3} />
                  </div>
                </AgentCard>
              )}
            </div>
          </section>
        </>
      )}

      <section aria-label="Decision history" className="mt-8 max-w-3xl">
        <ThoughtTrace />
      </section>
    </>
  );
}
