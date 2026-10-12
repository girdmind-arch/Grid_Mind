import { Boxes, BrainCircuit, Building, ChartSpline, CircleCheckBig, ClipboardCheck, Crown, Eye, GitCompareArrows, Play, ShieldCheck, Siren } from "lucide-react";
import type { IconTileTone } from "@/components/ui/IconTile";
import type { AgentId, AgentStatus, TraceStepKind } from "@/types/agents";

export const AGENT_NAMES: Record<AgentId, string> = {
  commander: "Commander",
  forecaster: "Forecaster",
  zone: "Zone Agents",
  planner: "Planner",
  fault: "Fault Responder",
  critic: "Critic",
  guardrail: "Guardrail",
};

/** Observe → Reason → Plan → Safety → Act → Result */
export const STEP_META: Record<TraceStepKind, { label: string; icon: typeof Eye }> = {
  observe: { label: "Observe", icon: Eye },
  reason: { label: "Reason", icon: BrainCircuit },
  plan: { label: "Plan A vs Plan B", icon: GitCompareArrows },
  safety: { label: "Safety check", icon: ShieldCheck },
  act: { label: "Act", icon: Play },
  result: { label: "Result", icon: CircleCheckBig },
};

/** Icon and tint per agent, used everywhere an agent appears. */
export const AGENT_LOOK: Record<AgentId, { icon: typeof Eye; tone: IconTileTone }> = {
  commander: { icon: Crown, tone: "ai" },
  forecaster: { icon: ChartSpline, tone: "solar" },
  zone: { icon: Building, tone: "accent" },
  planner: { icon: Boxes, tone: "ai" },
  fault: { icon: Siren, tone: "danger" },
  critic: { icon: ClipboardCheck, tone: "success" },
  guardrail: { icon: ShieldCheck, tone: "success" },
};

export const STATUS_LOOK: Record<AgentStatus, { label: string; tone: "neutral" | "ai" | "accent" | "warning" }> = {
  idle: { label: "Idle", tone: "neutral" },
  thinking: { label: "Thinking", tone: "ai" },
  acting: { label: "Acting", tone: "accent" },
  waiting: { label: "Waiting for you", tone: "warning" },
};
