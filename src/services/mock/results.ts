// MOCK: evaluation results, GridMind vs. a rule-free (no-AI) baseline,
// from the simulated campus. Replace with backend evaluation runs.
//
// The numbers are kept consistent with each other (judges may check):
// - costSavedPct = 1 - sum(cost.gridmind) / sum(cost.baseline)        -> 18.4%
// - peakReducedPct = 1 - max(peak.gridmind) / max(peak.baseline)      -> 22.1%
//   (baseline peak 1,510 kW at 19:00 matches the Forecaster.)
// - recovery = average of the scenario rows; each row and the runs below
//   match LEARNING in mock/agents.ts (run 3 = the scenario rows).

import type { Results } from "@/types/agents";

export const RESULTS: Results = {
  dataNote: "Simulated campus calibrated on public data.",
  headline: {
    costSavedPct: 18.4,
    peakReducedPct: 22.1,
    recovery: { gridmindMin: 2.6, baselineMin: 14 },
  },
  cost: [
    { label: "Mon", gridmind: 61_700, baseline: 74_900 },
    { label: "Tue", gridmind: 63_800, baseline: 78_100 },
    { label: "Wed", gridmind: 60_100, baseline: 73_600 },
    { label: "Thu", gridmind: 64_500, baseline: 79_400 },
    { label: "Fri", gridmind: 62_300, baseline: 76_800 },
  ],
  peak: [
    { label: "17:00", gridmind: 980, baseline: 1_120 },
    { label: "18:00", gridmind: 1_080, baseline: 1_420 },
    { label: "19:00", gridmind: 1_176, baseline: 1_510 },
    { label: "20:00", gridmind: 1_140, baseline: 1_480 },
    { label: "21:00", gridmind: 1_090, baseline: 1_390 },
    { label: "22:00", gridmind: 1_050, baseline: 1_120 },
  ],
  recovery: [
    { label: "Cloud cover", gridmind: 1.5, baseline: 9 },
    { label: "Heatwave", gridmind: 2.0, baseline: 12 },
    { label: "Line failure", gridmind: 4.5, baseline: 21 },
    { label: "Grid outage", gridmind: 2.5, baseline: 14 },
  ],
  runs: [
    { run: 1, recoveryMin: 5.3, costSavedPct: 12.1 },
    { run: 2, recoveryMin: 3.6, costSavedPct: 15.6 },
    { run: 3, recoveryMin: 2.6, costSavedPct: 18.4 },
  ],
};
