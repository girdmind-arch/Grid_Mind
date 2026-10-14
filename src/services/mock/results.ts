// MOCK: evaluation results, GridNova vs. a rule-free (no-AI) baseline,
// from the simulated campus. Replace with backend evaluation runs.
//
// These numbers are a snapshot of the backend's own evaluation (GET /api/results
// from backend/gridnova/evaluation.py), so the offline demo shows the same
// figures as the live backend. Regenerate them if the simulation changes.
// - costSavedPct = 1 - sum(cost.gridnova) / sum(cost.baseline)
// - peakReducedPct = 1 - (GridNova's highest grid import) / (baseline's), over the 5 days
// - recovery = average of the scenario rows; runs match LEARNING in mock/agents.ts.

import type { Results, ScenarioRunHistory } from "@/types/agents";
import type { FaultType } from "@/types/grid";
import { LEARNING } from "./agents";

export const RESULTS: Results = {
  dataNote: "Simulated campus calibrated on public data.",
  headline: {
    costSavedPct: 5.4,
    peakReducedPct: 26.5,
    recovery: { gridnovaMin: 2.6, baselineMin: 14.0 },
  },
  cost: [
    { label: "Mon", gridnova: 164_209, baseline: 173_827 },
    { label: "Tue", gridnova: 173_356, baseline: 183_179 },
    { label: "Wed", gridnova: 159_039, baseline: 168_511 },
    { label: "Thu", gridnova: 179_532, baseline: 189_415 },
    { label: "Fri", gridnova: 167_251, baseline: 176_944 },
  ],
  peak: [
    { label: "17:00", gridnova: 1106, baseline: 1324 },
    { label: "18:00", gridnova: 1106, baseline: 1507 },
    { label: "19:00", gridnova: 1106, baseline: 1521 },
    { label: "20:00", gridnova: 1106, baseline: 1493 },
    { label: "21:00", gridnova: 1106, baseline: 1387 },
    { label: "22:00", gridnova: 1112, baseline: 1110 },
  ],
  recovery: [
    { label: "Cloud cover", gridnova: 1.5, baseline: 9.0 },
    { label: "Heatwave", gridnova: 2.0, baseline: 12.0 },
    { label: "Line failure", gridnova: 4.5, baseline: 21.0 },
    { label: "Grid outage", gridnova: 2.5, baseline: 14.0 },
  ],
  runs: [
    { run: 1, recoveryMin: 5.3, costSavedPct: 4.0 },
    { run: 2, recoveryMin: 3.6, costSavedPct: 4.4 },
    { run: 3, recoveryMin: 2.6, costSavedPct: 5.4 },
  ],
};

// MOCK: run-by-run recovery for each scenario, from the same LEARNING table the
// Scenarios page uses, so a replay in the demo lands on the same numbers.
const RUN_ORDER: FaultType[] = ["cloud_cover", "heatwave", "line_failure", "grid_outage"];

export const RUN_HISTORY: ScenarioRunHistory[] = RUN_ORDER.map((type) => {
  const l = LEARNING[type];
  return {
    type,
    baselineMin: l.baselineMin,
    runs: l.recoveryByRun.map((recoveryMin, i) => ({
      run: i + 1,
      recoveryMin,
      // Run 1 learns the lesson; runs 2 and 3 apply it.
      lessonApplied: i > 0 ? l.lesson : undefined,
    })),
  };
});
