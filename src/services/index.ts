// The service layer: the ONLY place pages and components get data from.
//
// Each function has the signature the real FastAPI backend will use. Today they
// return mock data (marked // MOCK:). When VITE_API_URL is set, they call the
// backend instead. Endpoint paths are the proposed contract; adjust them here
// in one place if the backend team picks different ones.

import type { FaultRequest, FaultResult, Forecast, GridState } from "@/types/grid";
import type { ApprovalResponse, Decision, GoalAck, IncidentMemory, Results } from "@/types/agents";
import { USE_MOCKS, mockDelay, request } from "./api";
import { applyApproval, buildGridState, clearFault, currentFault, mitigateFault, startFault } from "./mock/state";
import { buildForecast } from "./mock/forecast";
import { DECISIONS, SCENARIO_DECISIONS } from "./mock/agents";
import { MEMORY } from "./mock/memory";
import { RESULTS } from "./mock/results";
import { simNow } from "@/utils/simTime";

/** Current grid snapshot: sources, battery, zones, flows, cost. */
export async function getGridState(): Promise<GridState> {
  if (!USE_MOCKS) return request<GridState>("/api/grid/state");
  // MOCK: consistent snapshot from the in-browser demo campus.
  await mockDelay(300);
  return buildGridState(simNow());
}

/** Forecaster output for the next hours, plus notable upcoming events. */
export async function getForecast(): Promise<Forecast> {
  if (!USE_MOCKS) return request<Forecast>("/api/forecast");
  // MOCK: fixed 12-hour forecast for a hot May evening.
  await mockDelay(350);
  return buildForecast();
}

/** Starts a scenario (cloud cover, heatwave, line failure, grid outage). */
export async function injectFault(req: FaultRequest): Promise<FaultResult> {
  if (!USE_MOCKS) return request<FaultResult>("/api/scenarios/inject", { method: "POST", body: JSON.stringify(req) });
  // MOCK: flips the in-memory state; agents do not really run.
  await mockDelay(250);
  const fault = startFault(req);
  return { incidentId: fault.incidentId, startedAt: fault.startedAt, message: "Scenario started." };
}

/** Clears the active scenario (used by the Scenarios page and replay). */
export async function clearScenario(): Promise<void> {
  if (!USE_MOCKS) return request<void>("/api/scenarios/clear", { method: "POST" });
  // MOCK: resets the in-memory fault.
  await mockDelay(150);
  clearFault();
}

/**
 * Asks the Commander to run one observe→plan→act cycle and return its decision.
 * High-impact decisions come back with approval.status "pending" and are NOT
 * applied until respondToApproval() is called.
 */
export async function runCommanderStep(): Promise<Decision> {
  if (!USE_MOCKS) return request<Decision>("/api/agents/commander/step", { method: "POST" });
  // MOCK: returns a pre-written decision for the active scenario. No AI is called.
  await mockDelay(2600);
  const fault = currentFault();
  if (!fault) return DECISIONS[0];

  const template = SCENARIO_DECISIONS[fault.type];
  const startedAt = simNow().toISOString();
  const needsApproval = template.approval?.status === "pending";
  if (!needsApproval) mitigateFault();
  return {
    ...template,
    id: `dec-${fault.incidentId}`,
    incidentId: fault.incidentId,
    startedAt,
    steps: template.steps
      // Until approved, the "act" and "result" steps have not happened yet.
      .filter((s) => !needsApproval || (s.kind !== "act" && s.kind !== "result"))
      .map((s) => ({ ...s, at: startedAt })),
  };
}

// MOCK: battery runtime by hostel level in a grid outage (2 MWh, 79% → 20% floor).
const BATTERY_RUNTIME: Record<number, string> = { 50: "~1 h 50 min", 60: "~1 h 40 min", 70: "~1 h 35 min" };

/** Operator's answer to a paused high-impact decision. Returns the updated decision. */
export async function respondToApproval(decision: Decision, response: ApprovalResponse): Promise<Decision> {
  if (!USE_MOCKS)
    return request<Decision>(`/api/agents/decisions/${decision.id}/approval`, { method: "POST", body: JSON.stringify(response) });
  // MOCK: applies the response to the in-memory grid and completes the trace.
  await mockDelay(500);
  const fault = currentFault();
  const level = response.decision === "modify" ? Number(response.optionId) : undefined;
  applyApproval(response.decision, level);

  const at = simNow().toISOString();
  const template = fault ? SCENARIO_DECISIONS[fault.type] : undefined;
  const pct = Math.round((level ?? (response.decision === "reject" ? 0.5 : 0.6)) * 100);
  const note =
    response.decision === "approve"
      ? "Approved by Duty Operator."
      : response.decision === "modify"
        ? `Modified by Duty Operator: hostels at ${pct}%.`
        : "Rejected by Duty Operator. Safe rule-based control is active (hostels at 50%).";
  const status = response.decision === "approve" ? "approved" : response.decision === "modify" ? "modified" : "rejected";

  const finalSteps =
    response.decision === "reject"
      ? [
          { id: "s5", kind: "act" as const, agent: "guardrail" as const, at, summary: "Fallback rules applied: hostels at a fixed 50%." },
          { id: "s6", kind: "result" as const, agent: "critic" as const, at, summary: "All zones powered on safe rules. AI control can be resumed any time." },
        ]
      : (template?.steps ?? [])
          .filter((s) => s.kind === "act" || s.kind === "result")
          .map((s) => ({
            ...s,
            at,
            summary:
              s.kind === "act"
                ? `Hostels restored at ${pct}%; battery powering the campus.`
                : `All zones powered. Battery lasts ${BATTERY_RUNTIME[pct] ?? "~1 h 40 min"} at this load.`,
          }));

  return {
    ...decision,
    steps: [...decision.steps, ...finalSteps],
    approval: decision.approval && {
      ...decision.approval,
      status,
      response: { optionId: response.decision === "modify" ? response.optionId : undefined, note, at },
    },
  };
}

/** Recent decisions with their full thought trace, newest first. */
export async function getThoughtTrace(): Promise<Decision[]> {
  if (!USE_MOCKS) return request<Decision[]>("/api/agents/trace");
  // MOCK: pre-written decisions.
  await mockDelay(400);
  return DECISIONS;
}

/** Past incidents and the Critic's lessons learned. */
export async function getIncidentMemory(): Promise<IncidentMemory> {
  if (!USE_MOCKS) return request<IncidentMemory>("/api/memory");
  // MOCK: four past incidents and three lessons.
  await mockDelay(350);
  return MEMORY;
}

/** GridMind vs. no-AI baseline evaluation. */
export async function getResults(): Promise<Results> {
  if (!USE_MOCKS) return request<Results>("/api/results");
  // MOCK: evaluation numbers from the simulated campus.
  await mockDelay(350);
  return RESULTS;
}

/** Sets the operator's goal in plain English; the Commander restates how it understood it. */
export async function setGoal(goal: string): Promise<GoalAck> {
  if (!USE_MOCKS) return request<GoalAck>("/api/goal", { method: "POST", body: JSON.stringify({ goal }) });
  // MOCK: echoes the goal with a canned interpretation.
  await mockDelay(600);
  return {
    goal,
    interpretation: `Understood. I'll prioritise "${goal}" while labs keep full power and the battery stays between 20% and 90%.`,
    acceptedAt: simNow().toISOString(),
  };
}

export { ServiceError, USE_MOCKS } from "./api";
