import { create } from "zustand";
import type { FaultRequest, FaultType } from "@/types/grid";
import type { ApprovalResponse, Decision, Incident, Lesson, ScenarioOutcome } from "@/types/agents";
import { clearScenario, getThoughtTrace, injectFault, respondToApproval, runCommanderStep } from "@/services";
import { useAppStore } from "./appStore";
import { toast } from "./toastStore";

// The live loop shown on the Control Room (and later the Scenarios page):
//   scenario fires → grid reacts → Commander thinks → (approval?) → stable.
// All data still comes from the service layer; this store only orchestrates it.

export type ScenarioPhase = "idle" | "responding" | "awaiting-approval" | "stable";

interface ActiveScenario extends FaultRequest {
  incidentId: string;
  /** Real-time ms, used for the recovery timer. */
  startedAtMs: number;
  stabilisedAtMs: number | null;
}

interface ScenarioState {
  phase: ScenarioPhase;
  active: ActiveScenario | null;
  /** Thought trace, newest first. */
  decisions: Decision[];
  traceStatus: "loading" | "ready" | "error";
  /** Bumped whenever the grid changes, so views reload getGridState(). */
  gridVersion: number;
  /** True while the Commander is thinking (shows ThinkingSteps). */
  thinking: boolean;
  /** Outcome of every run this session, per scenario type (oldest first). */
  history: Partial<Record<FaultType, ScenarioOutcome[]>>;
  /** Settings of the last scenario, used by "Replay same scenario". */
  lastRequest: FaultRequest | null;
  /** Incidents and lessons created during this session (shown on Memory). */
  sessionIncidents: Incident[];
  sessionLessons: Lesson[];

  loadTrace: () => Promise<void>;
  run: (type: FaultType, opts?: Partial<Omit<FaultRequest, "type">>) => Promise<void>;
  respond: (decision: Decision, response: ApprovalResponse) => Promise<void>;
  end: () => Promise<void>;
  replay: () => Promise<void>;
}

const DEFAULTS = { severity: 3, durationMin: 30 };

/** Turns a scenario decision into a memory entry (what happened, what was done, result). */
function incidentFrom(type: FaultType, d: Decision): Incident {
  const act = d.steps.find((s) => s.kind === "act")?.summary;
  const result = d.steps.find((s) => s.kind === "result")?.summary;
  return {
    id: d.incidentId ?? d.id,
    occurredAt: d.startedAt,
    type,
    title: d.title,
    cause: d.trigger,
    action: act ?? `Proposed: ${d.plans.find((p) => p.id === d.chosenPlanId)?.summary ?? ""} Waiting for operator approval.`,
    outcome: result ?? "Pending operator approval.",
    recoveryMin: d.outcome?.recoveryMin ?? 0,
  };
}

/** Adds a new lesson (first run) or counts a reuse (replay). */
function updateLessons(lessons: Lesson[], d: Decision): Lesson[] {
  const o = d.outcome;
  if (!o || !d.incidentId) return lessons;
  if (o.lessonLearned && !lessons.some((l) => l.note === o.lessonLearned)) {
    return [{ id: `L-${d.incidentId}`, incidentId: d.incidentId, note: o.lessonLearned, appliedCount: 0 }, ...lessons];
  }
  if (o.lessonApplied) {
    return lessons.map((l) => (l.note === o.lessonApplied ? { ...l, appliedCount: l.appliedCount + 1 } : l));
  }
  return lessons;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  phase: "idle",
  active: null,
  decisions: [],
  traceStatus: "loading",
  gridVersion: 0,
  thinking: false,
  history: {},
  lastRequest: null,
  sessionIncidents: [],
  sessionLessons: [],

  loadTrace: async () => {
    if (get().decisions.length) return;
    set({ traceStatus: "loading" });
    try {
      set({ decisions: await getThoughtTrace(), traceStatus: "ready" });
    } catch {
      set({ traceStatus: "error" });
    }
  },

  run: async (type, opts) => {
    if (get().phase === "responding" || get().phase === "awaiting-approval") return;
    const req: FaultRequest = { type, ...DEFAULTS, ...opts };
    set({ lastRequest: req });
    try {
      const fault = await injectFault(req);
      set((s) => ({
        phase: "responding",
        thinking: true,
        active: { ...req, incidentId: fault.incidentId, startedAtMs: Date.now(), stabilisedAtMs: null },
        gridVersion: s.gridVersion + 1,
      }));
      // Scenarios demo the agents, so they take control back from Manual / Fallback.
      if (useAppStore.getState().mode !== "ai") {
        useAppStore.getState().setMode("ai");
        toast({ title: "AI Control is back on", description: "Scenarios show the agents responding, so they take over for this run.", tone: "ai" });
      }

      const decision = await runCommanderStep();
      const needsApproval = decision.approval?.status === "pending";
      const outcome = decision.outcome;
      set((s) => ({
        thinking: false,
        decisions: [decision, ...s.decisions],
        history: outcome ? { ...s.history, [type]: [...(s.history[type] ?? []), outcome] } : s.history,
        sessionIncidents: [incidentFrom(type, decision), ...s.sessionIncidents],
        sessionLessons: updateLessons(s.sessionLessons, decision),
        phase: needsApproval ? "awaiting-approval" : "stable",
        active: s.active && { ...s.active, stabilisedAtMs: needsApproval ? null : Date.now() },
        gridVersion: s.gridVersion + 1,
      }));
      if (needsApproval) toast({ title: "Approval needed", description: decision.approval!.request, tone: "warning" });
    } catch {
      set({ thinking: false, phase: "idle" });
      useAppStore.getState().setMode("fallback");
      toast({ title: "The AI service is unreachable.", description: "Safe rule-based control is active.", tone: "warning" });
    }
  },

  respond: async (decision, response) => {
    const updated = await respondToApproval(decision, response);
    set((s) => ({
      decisions: s.decisions.map((d) => (d.id === updated.id ? updated : d)),
      sessionIncidents: s.sessionIncidents.map((i) =>
        i.id === updated.incidentId && s.active ? incidentFrom(s.active.type, updated) : i,
      ),
      phase: "stable",
      active: s.active && { ...s.active, stabilisedAtMs: Date.now() },
      gridVersion: s.gridVersion + 1,
    }));
    if (response.decision === "reject") useAppStore.getState().setMode("fallback");
    toast({
      title: response.decision === "reject" ? "Plan rejected" : "Plan applied",
      description: updated.approval?.response?.note,
      tone: response.decision === "reject" ? "warning" : "success",
    });
  },

  end: async () => {
    await clearScenario();
    set((s) => ({ phase: "idle", active: null, thinking: false, gridVersion: s.gridVersion + 1 }));
    useAppStore.getState().setMode("ai");
    toast({ title: "Scenario ended", description: "The grid is back to normal operation.", tone: "neutral" });
  },

  replay: async () => {
    const req = get().lastRequest;
    if (!req) return;
    // Back to normal first, then the same fault again. The agents remember the last run.
    await clearScenario();
    set((s) => ({ phase: "idle", active: null, gridVersion: s.gridVersion + 1 }));
    await get().run(req.type, req);
  },
}));
