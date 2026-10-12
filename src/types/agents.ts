import type { FaultType, ISODate } from "./grid";

export type AgentId =
  | "commander"
  | "forecaster"
  | "zone"
  | "planner"
  | "fault"
  | "critic"
  | "guardrail";

export type AgentStatus = "idle" | "thinking" | "acting";

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  status: AgentStatus;
  lastAction: string;
  tools: string[];
}

// ---------- Thought trace ----------
export type TraceStepKind = "observe" | "reason" | "plan" | "safety" | "act" | "result";

export interface TraceStep {
  id: string;
  kind: TraceStepKind;
  agent: AgentId;
  at: ISODate;
  summary: string;
  detail?: string;
}

export type RiskLevel = "low" | "medium" | "high";

export interface Plan {
  id: "A" | "B";
  title: string;
  summary: string;
  costInr: number;
  risk: RiskLevel;
  comfortPct: number; // 0–100, how much of normal comfort is kept
  actions: string[];
}

export interface Decision {
  id: string;
  startedAt: ISODate;
  title: string;
  trigger: string;
  steps: TraceStep[];
  plans: [Plan, Plan];
  chosenPlanId: Plan["id"];
  chosenReason: string;
  /** Plain-language answer to "Why did you do that?" */
  explanation: string;
  usedMemory?: { incidentId: string; summary: string };
  /** Set when this decision responded to a scenario / incident. */
  incidentId?: string;
  /** Scenario outcome measured in the digital twin (simulated minutes). */
  outcome?: ScenarioOutcome;
  /** High-impact decisions pause for operator approval. */
  approval?: Approval;
}

export interface ScenarioOutcome {
  /** Which time this scenario type has been run (1, 2, 3…). */
  run: number;
  /** Simulated minutes from fault to a stable grid. */
  recoveryMin: number;
  /** Same scenario with no AI (rule-free baseline). */
  baselineMin: number;
  /** Lesson from an earlier run that made this one faster. */
  lessonApplied?: string;
}

export type ApprovalStatus = "pending" | "approved" | "modified" | "rejected";

export interface Approval {
  status: ApprovalStatus;
  /** What the agent wants to do, in one line. */
  request: string;
  risk: string;
  /** Options the operator can pick from when choosing "Modify". */
  modifyOptions?: { id: string; label: string }[];
  /** Filled in once the operator responds. */
  response?: { optionId?: string; note: string; at: ISODate };
}

export type ApprovalResponse =
  | { decision: "approve" }
  | { decision: "modify"; optionId: string }
  | { decision: "reject" };

export interface GoalAck {
  goal: string;
  interpretation: string;
  acceptedAt: ISODate;
}

// ---------- Memory ----------
export interface Incident {
  id: string;
  occurredAt: ISODate;
  type: FaultType;
  title: string;
  cause: string;
  action: string;
  outcome: string;
  recoveryMin: number;
}

export interface Lesson {
  id: string;
  incidentId: string;
  note: string;
  appliedCount: number;
}

export interface IncidentMemory {
  incidents: Incident[];
  lessons: Lesson[];
}

// ---------- Results ----------
export interface ResultsSeriesPoint {
  label: string;
  gridmind: number;
  baseline: number;
}

export interface Results {
  dataNote: string;
  headline: {
    costSavedPct: number;
    peakReducedPct: number;
    recovery: { gridmindMin: number; baselineMin: number };
  };
  cost: ResultsSeriesPoint[]; // INR per day
  peak: ResultsSeriesPoint[]; // kW per hour
  recovery: ResultsSeriesPoint[]; // minutes per scenario
  runs: { run: 1 | 2 | 3; recoveryMin: number; costSavedPct: number }[];
}
