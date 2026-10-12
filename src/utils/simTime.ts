// The demo runs on a simulated clock that starts at 17:20 IST on a hot May
// evening (just before the 18:00 peak) and then ticks at real speed.
// When the backend is connected, it should send its own simulation time instead.

/** Simulated "now" when the app opens: Tue 12 May 2026, 17:20 IST. */
export const SIM_START = "2026-05-12T17:20:00+05:30";

const simStartMs = new Date(SIM_START).getTime();
const realStartMs = Date.now();

/** Current simulated time. */
export const simNow = () => new Date(simStartMs + (Date.now() - realStartMs));
