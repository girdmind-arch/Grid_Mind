import { useEffect, useState } from "react";
import { useAppStore } from "@/store/appStore";

/** Current simulated time. Runs at real speed from the demo start (17:20 IST). */
export function useSimClock(tickMs = 1000) {
  const simStartMs = useAppStore((s) => s.simStartMs);
  const realStartMs = useAppStore((s) => s.realStartMs);
  const [now, setNow] = useState(() => new Date(simStartMs + (Date.now() - realStartMs)));

  useEffect(() => {
    const tick = () => setNow(new Date(simStartMs + (Date.now() - realStartMs)));
    const id = window.setInterval(tick, tickMs);
    return () => window.clearInterval(id);
  }, [simStartMs, realStartMs, tickMs]);

  return now;
}
