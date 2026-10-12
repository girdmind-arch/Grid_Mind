// The service layer: the ONLY place pages and components get data from.
//
// Each function has the signature the real FastAPI backend will use. Today they
// return mock data (marked // MOCK:). When VITE_API_URL is set, they call the
// backend instead. Endpoint paths are the proposed contract; adjust them here
// in one place if the backend team picks different ones.

import type { FaultRequest, FaultResult, Forecast, GridState } from "@/types/grid";
import type { Decision, GoalAck, IncidentMemory, Results } from "@/types/agents";
import { USE_MOCKS, mockDelay, request } from "./api";
import { buildGridState, clearFault, simStart, startFault } from "./mock/state";
import { buildForecast } from "./mock/forecast";
import { DECISIONS } from "./mock/agents";
import { MEMORY } from "./mock/memory";
import { RESULTS } from "./mock/results";

/** Current grid snapshot: sources, battery, zones, flows, cost. */
export async function getGridState(): Promise<GridState> {
  if (!USE_MOCKS) return request<GridState>("/api/grid/state");
  // MOCK: consistent snapshot from the in-browser demo campus.
  await mockDelay(300);
  return buildGridState(simStart());
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

/** Asks the Commander to run one observe→plan→act cycle and return its decision. */
export async function runCommanderStep(): Promise<Decision> {
  if (!USE_MOCKS) return request<Decision>("/api/agents/commander/step", { method: "POST" });
  // MOCK: returns a pre-written decision. No AI is called.
  await mockDelay(900);
  return DECISIONS[0];
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
    acceptedAt: new Date().toISOString(),
  };
}

export { ServiceError, USE_MOCKS } from "./api";
