import { Link } from "react-router";
import {
  ArrowRight,
  BrainCircuit,
  ChartSpline,
  Clock3,
  FlaskConical,
  GitCompareArrows,
  GraduationCap,
  IndianRupee,
  PlayCircle,
  ShieldCheck,
  Sun,
  TrendingDown,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { getAgents, getResults } from "@/services";
import { useService } from "@/hooks/useService";
import { Badge, Button, Card, IconTile, Skeleton } from "@/components/ui";
import { AGENT_LOOK } from "@/components/agents/agentMeta";
import { formatNumber } from "@/utils/format";
import { LandingSection } from "./LandingSection";

// ---------- The problem ----------

// PLACEHOLDER: figures to be replaced with cited public sources before submission.
const PROBLEM = [
  {
    icon: IndianRupee,
    tone: "warning" as const,
    value: "~35%",
    label: "of a campus power bill is paid in the 18:00–22:00 peak, at the highest tariff slab.",
  },
  {
    icon: Sun,
    tone: "solar" as const,
    value: "1 in 5",
    label: "solar units is wasted or sold cheaply at midday, when the campus cannot use it.",
  },
  {
    icon: TriangleAlert,
    tone: "danger" as const,
    value: "15+ min",
    label: "to restore power after a line fault when operators reroute by hand.",
  },
];

export function ProblemSection() {
  return (
    <LandingSection
      id="problem"
      eyebrow="The problem"
      title="Campus grids are run by hand, one alarm at a time."
      description="Solar, a battery and the main grid could cover the evening peak cheaply. Without planning, they don't."
    >
      <ul className="grid gap-4 md:grid-cols-3">
        {PROBLEM.map((p) => {
          const Icon = p.icon;
          return (
            <li key={p.value}>
              <Card className="h-full">
                <div className="flex items-center justify-between gap-3">
                  <IconTile icon={<Icon />} tone={p.tone} />
                  <Badge tone="neutral" size="sm">
                    Placeholder figure
                  </Badge>
                </div>
                <p className="mt-5 font-mono text-[34px] leading-none font-semibold tracking-[-0.03em] text-fg">{p.value}</p>
                <p className="mt-3 text-[15px] text-fg-muted">{p.label}</p>
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-fg-subtle">Figures are illustrative placeholders until sources are added.</p>
    </LandingSection>
  );
}

// ---------- How it works ----------

const STEPS = [
  { icon: ChartSpline, tone: "solar" as const, title: "Forecast", text: "Predicts demand and solar for the next 12 hours, from weather and campus patterns." },
  { icon: GitCompareArrows, tone: "ai" as const, title: "Plan and test", text: "Builds Plan A and Plan B and runs both in a digital twin before touching the grid." },
  { icon: ShieldCheck, tone: "success" as const, title: "Act safely", text: "Every action passes hard guardrails. Big moves wait for an operator's approval." },
  { icon: GraduationCap, tone: "accent" as const, title: "Explain and learn", text: "Says why in plain words, scores the result, and remembers the lesson for next time." },
];

export function HowItWorksSection() {
  return (
    <LandingSection
      id="how-it-works"
      eyebrow="How it works"
      title="Four steps, every few minutes, all of them visible."
      description="The same loop runs for a normal evening peak and for a sudden fault."
    >
      <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.title}>
              <Card className="h-full">
                <div className="flex items-center gap-3">
                  <IconTile icon={<Icon />} tone={s.tone} />
                  <span className="font-mono text-sm font-semibold text-fg-subtle">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-fg">{s.title}</h3>
                <p className="mt-1.5 text-[15px] text-fg-muted">{s.text}</p>
              </Card>
            </li>
          );
        })}
      </ol>
    </LandingSection>
  );
}

// ---------- Agents ----------

export function AgentsSection() {
  const agents = useService(getAgents);
  return (
    <LandingSection
      id="agents"
      eyebrow="The agents"
      title="Seven agents, one Commander."
      description="Each agent has one job and a small set of tools. The Commander brings their answers together and explains the decision."
    >
      {!agents.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {agents.data.map((a) => {
            const look = AGENT_LOOK[a.id];
            const Icon = look.icon;
            return (
              <li key={a.id}>
                <Card className="h-full">
                  <IconTile icon={<Icon />} tone={look.tone} />
                  <h3 className="mt-4 text-base font-semibold text-fg">{a.name}</h3>
                  <p className="mt-1 text-[15px] text-fg-muted">{a.role}</p>
                </Card>
              </li>
            );
          })}
          <li>
            <Link
              to="/app/agents"
              className="flex h-full min-h-36 flex-col justify-between rounded-lg border border-dashed border-border-strong p-5 text-accent transition-colors hover:bg-surface sm:p-6"
            >
              <BrainCircuit aria-hidden strokeWidth={1.75} className="size-6" />
              <span className="flex items-center gap-1.5 font-semibold">
                Watch them think <ArrowRight aria-hidden strokeWidth={1.75} className="size-4" />
              </span>
            </Link>
          </li>
        </ul>
      )}
    </LandingSection>
  );
}

// ---------- Results teaser ----------

export function ResultsTeaserSection() {
  const results = useService(getResults);
  const r = results.data;
  const stats = r
    ? [
        { icon: IndianRupee, value: `${formatNumber(r.headline.costSavedPct, 1)}%`, label: "lower electricity cost" },
        { icon: TrendingDown, value: `${formatNumber(r.headline.peakReducedPct, 1)}%`, label: "lower evening peak" },
        {
          icon: Clock3,
          value: `${formatNumber(r.headline.recovery.gridmindMin, 1)} min`,
          label: `fault recovery, vs ${formatNumber(r.headline.recovery.baselineMin)} min without AI`,
        },
      ]
    : [];

  return (
    <LandingSection
      id="results"
      eyebrow="Results"
      title="Measured against the same campus with no AI."
      description={
        <span className="inline-flex items-start gap-2">
          <FlaskConical aria-hidden strokeWidth={1.75} className="mt-1 size-4 shrink-0" />
          {r?.dataNote ?? "Simulated campus calibrated on public data."}
        </span>
      }
    >
      {!r ? (
        <Skeleton className="h-40" />
      ) : (
        <Card padding="none">
          <dl className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="p-6 sm:p-8">
                  <dt className="flex items-center gap-2 text-[15px] text-fg-muted">
                    <Icon aria-hidden strokeWidth={1.75} className="size-4 text-success" />
                    {s.label}
                  </dt>
                  <dd className="mt-2 font-mono text-[40px] leading-none font-semibold tracking-[-0.04em] text-fg">{s.value}</dd>
                </div>
              );
            })}
          </dl>
        </Card>
      )}
      <Button asChild variant="secondary" className="mt-6">
        <Link to="/app/results">
          See how it was measured <ArrowRight />
        </Link>
      </Button>
    </LandingSection>
  );
}

// ---------- Demo video + architecture ----------

const LAYERS = [
  { title: "Control Room (this website)", text: "React app: live grid, agent reasoning, scenarios, results." },
  { title: "Service layer", text: "One place the UI gets data from. Mock data today." },
  { title: "FastAPI backend", text: "Grid simulator and digital twin, ML forecaster, agent loop, memory." },
];

export function DemoSection() {
  return (
    <LandingSection id="demo" eyebrow="See it run" title="The two‑minute walkthrough." description="A line fails, the agents reroute power, and the replay recovers faster.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-h-64 min-w-0 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface-sunken p-6 text-center sm:aspect-video">
          <PlayCircle aria-hidden strokeWidth={1.75} className="size-12 text-fg-subtle" />
          <p className="font-semibold text-fg">Demo video coming soon</p>
          <p className="max-w-sm text-sm text-fg-muted">Until then, try it yourself: open the demo and run a line failure from Scenarios.</p>
          <Button asChild variant="primary" size="sm" className="mt-1">
            <Link to="/app/scenarios">Try a scenario</Link>
          </Button>
        </div>

        <Card className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-fg">Architecture</h3>
            <Badge tone="neutral" size="sm">
              Draft
            </Badge>
          </div>
          <ol className="mt-5 space-y-2.5">
            {LAYERS.map((l, i) => (
              <li key={l.title}>
                <div className="rounded-md border border-border bg-surface-sunken p-3.5">
                  <p className="text-[15px] font-semibold text-fg">{l.title}</p>
                  <p className="mt-0.5 text-sm text-fg-muted">{l.text}</p>
                </div>
                {i < LAYERS.length - 1 && <div aria-hidden className="mx-auto h-3 w-px bg-border-strong" />}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-fg-subtle">Full diagram to be added.</p>
        </Card>
      </div>
    </LandingSection>
  );
}

// ---------- Team ----------

export function TeamSection() {
  return (
    <LandingSection id="team" eyebrow="Team" title="Who built GridMind." description="Names and roles to be added.">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <li key={n}>
            <Card className="flex h-full items-center gap-4">
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-sunken text-fg-subtle">
                <UserRound strokeWidth={1.75} className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-fg">Team member {n}</p>
                <p className="text-sm text-fg-muted">Role to be added</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </LandingSection>
  );
}
