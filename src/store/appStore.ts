import { create } from "zustand";
import type { ControlMode } from "@/types/grid";
import { SIM_START } from "@/services/mock/campus";

// Small shared app state. Anything that comes from the backend lives in
// services; this store only holds UI-level state shared across pages.

interface AppState {
  /** Who is in control: AI agents, safe fallback rules, or a human operator. */
  mode: ControlMode;
  setMode: (mode: ControlMode) => void;

  /** Simulated clock: sim time = simStartMs + (real now - realStartMs). */
  simStartMs: number;
  realStartMs: number;
}

export const useAppStore = create<AppState>((set) => ({
  mode: "ai",
  setMode: (mode) => set({ mode }),
  simStartMs: new Date(SIM_START).getTime(),
  realStartMs: Date.now(),
}));
