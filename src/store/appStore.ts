import { create } from "zustand";
import type { ControlMode } from "@/types/grid";

// Small shared app state. Anything that comes from the backend lives in
// services; this store only holds UI-level state shared across pages.

export const DEFAULT_GOAL = "Keep labs at full power and keep tonight's bill low.";

interface AppState {
  /** Who is in control: AI agents, safe fallback rules, or a human operator. */
  mode: ControlMode;
  setMode: (mode: ControlMode) => void;

  /** The operator's current goal, and how the Commander understood it. */
  goal: string;
  goalInterpretation: string | null;
  setGoal: (goal: string, interpretation: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: "ai",
  setMode: (mode) => set({ mode }),
  goal: DEFAULT_GOAL,
  goalInterpretation: null,
  setGoal: (goal, goalInterpretation) => set({ goal, goalInterpretation }),
}));
