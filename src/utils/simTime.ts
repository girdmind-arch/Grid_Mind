// The demo runs on a simulated clock that starts at 17:20 IST on a hot May
// evening (just before the 18:00 peak) and then ticks at real speed.
// When the backend is connected, it should send its own simulation time instead.

/** Simulated "now" when the app opens: Tue 12 May 2026, 17:20 IST. */
export const SIM_START = "2026-05-12T17:20:00+05:30";

let simStartMs = new Date(SIM_START).getTime();
let realStartMs = Date.now();

/** Current simulated time. */
export const simNow = () => new Date(simStartMs + (Date.now() - realStartMs));

/** Aligns the clock with the backend's simulation time (called on each grid update). */
export function syncSimClock(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return;
  simStartMs = t;
  realStartMs = Date.now();
}
