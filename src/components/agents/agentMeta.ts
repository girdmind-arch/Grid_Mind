import { BrainCircuit, CircleCheckBig, Eye, GitCompareArrows, Play, ShieldCheck } from "lucide-react";
import type { AgentId, TraceStepKind } from "@/types/agents";

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
