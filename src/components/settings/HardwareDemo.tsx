import { useCallback, useEffect, useState } from "react";
import { OctagonX, Plug, ShieldCheck } from "lucide-react";
import type { DataSource, HardwareState, RigCommand, RigReading } from "@/types/hardware";
import {
  ServiceError, USE_MOCKS, armHardware, disarmHardware, emergencyStopHardware, getHardwareState, resetEmergencyStop, setHardwareMode,
} from "@/services";
import { useCanAct } from "@/store/authStore";
import { Badge, Button, SegmentedControl, toast } from "@/components/ui";
import { formatTime } from "@/utils/format";

const POLL_MS = 3000;

/** Polls the rig's state every few seconds while this panel is open. */
export function useHardwareState() {
  const [state, setState] = useState<HardwareState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      setState(await getHardwareState());
      setError(null);
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : "The hardware status could not be loaded.");
    }
  }, []);
  useEffect(() => {
    void refresh();
    if (USE_MOCKS) return;
    const id = window.setInterval(() => document.visibilityState === "visible" && void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);
  return { state, error, refresh, set: setState };
}

export const COMMAND_LABEL: Record<string, string> = {
  select_source: "Source",
  set_load: "Load",
  estop: "Emergency stop",
  clear_estop: "Clear emergency stop",
};

/** One line about a rig command, saying plainly whether it really happened on the table. */
export function commandProgress(c: RigCommand): { text: string; tone: "success" | "warning" | "neutral" | "danger" | "ai" } {
  if (c.physicallyPerformed) return { text: "Done on the rig", tone: "success" };
  switch (c.status) {
    case "awaiting_approval": return { text: "Waiting for approval", tone: "warning" };
    case "queued": return { text: "Queued", tone: "ai" };
    case "delivered": return { text: "Sent to device", tone: "ai" };
    case "applied": return c.verified === false ? { text: "Acknowledged, not seen in readings", tone: "danger" } : { text: "Acknowledged, confirming", tone: "ai" };
    case "rejected": return { text: "Device refused", tone: "danger" };
    case "failed": return { text: "Failed", tone: "danger" };
    case "expired": return { text: "Expired, not performed", tone: "neutral" };
    default: return { text: "Cancelled", tone: "neutral" };
  }
}

function describe(c: RigCommand) {
  const p = c.params;
  if (c.type === "select_source") return `Source → ${p.source === "powerbank" ? "power bank" : "adapter"}`;
  if (c.type === "set_load") return `${String(p.load)} branch → ${p.on ? "on" : "off"}`;
  return COMMAND_LABEL[c.type];
}

function Reading({ label, r }: { label: string; r: RigReading | null }) {
  return (
    <div className="rounded-md border border-border bg-surface-sunken p-3">
      <p className="micro-label text-fg-subtle">{label}</p>
      {r ? (
        <>
          <p className="mt-1 font-mono text-sm font-semibold tabular text-fg">
            {r.voltageV.toFixed(2)} V · {r.currentA.toFixed(2)} A · {r.powerW.toFixed(2)} W
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">{r.fresh ? "Measured just now" : "Last measured value (stale)"} · power is V × A</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-fg-muted">No reading from this sensor.</p>
      )}
    </div>
  );
}

/** Settings → Hardware: simulation vs tabletop rig, arming, emergency stop and what the rig is doing. */
export function HardwareDemo() {
  const canAct = useCanAct();
  const { state, error, refresh, set } = useHardwareState();
  const [busy, setBusy] = useState(false);

  if (USE_MOCKS) {
    return (
      <p className="text-sm text-fg-muted">
        This copy runs on demo data, so there is no rig to connect. Open the live site and register an ESP32 device (see the README) to use the hardware demo.
      </p>
    );
  }
  if (!state) return <p className="text-sm text-fg-muted">{error ?? "Loading the hardware status…"}</p>;

  const run = async (fn: () => Promise<HardwareState>, ok: string) => {
    setBusy(true);
    try {
      set(await fn());
      toast({ title: ok, tone: "ai" });
    } catch (e) {
      toast({ title: "Not done.", description: e instanceof ServiceError ? e.message : "Try again.", tone: "warning" });
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  const d = state.device;
  const online = d.status === "online";
  const hardwareOn = state.mode === "hardware-demo";
  const label = { adapter: "Adapter (grid)", powerbank: "Power bank (storage)", none: "Switching…" } as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={hardwareOn ? "accent" : "neutral"} icon={<Plug />}>Data source: {hardwareOn ? "Hardware demo" : "Simulation"}</Badge>
        <Badge tone={online ? "success" : "neutral"} dot>{online ? "Rig online" : d.status === "never_seen" ? "Rig not seen yet" : "Rig offline"}</Badge>
        <Badge tone={state.armed ? "warning" : "neutral"} icon={<ShieldCheck />}>
          {state.armed ? `Armed${state.armedUntil ? ` until ${formatTime(state.armedUntil)}` : ""}` : "Not armed"}
        </Badge>
        {state.estop.active && <Badge tone="danger" icon={<OctagonX />}>Emergency stop</Badge>}
      </div>

      <p className="text-sm text-fg-muted">
        The campus on every other screen always comes from the simulation. The rig is a small USB-level demo: its readings are volts and amps, not campus kW, and nothing here changes the simulation.
      </p>

      <SegmentedControl<DataSource>
        label="Data source"
        value={state.mode}
        onChange={(v) => canAct && void run(() => setHardwareMode(v), v === "simulation" ? "Simulation only" : "Hardware demo mode on")}
        className="w-full max-w-md"
        options={[{ value: "simulation", label: "Simulation" }, { value: "hardware-demo", label: "Hardware demo" }]}
      />
      {!state.configured && <p className="text-sm text-warning">No device key is set on the server, so hardware demo mode is unavailable.</p>}

      {hardwareOn && (
        <>
          {d.status !== "never_seen" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Reading label="Adapter side" r={d.readings.adapter} />
              <Reading label="Power-bank side" r={d.readings.battery} />
              <div className="rounded-md border border-border bg-surface-sunken p-3">
                <p className="micro-label text-fg-subtle">Selected source</p>
                <p className="mt-1 text-sm font-semibold text-fg">{d.source ? label[d.source] : "Unknown"}</p>
                <p className="mt-0.5 text-xs text-fg-muted">Power-bank charge: unknown. A USB output voltage does not show it.</p>
              </div>
              <div className="rounded-md border border-border bg-surface-sunken p-3">
                <p className="micro-label text-fg-subtle">LED branches</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {state.capabilities.loads.map((l) => (
                    <Badge key={l.name} size="sm" tone={d.loads[l.name] ? "success" : "neutral"} dot>
                      {l.name} {d.loads[l.name] ? "on" : "off"}{l.essential ? " (always on)" : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          {d.warnings.map((w) => <p key={w} className="text-sm text-warning">{w}</p>)}

          {canAct ? (
            <div className="flex flex-wrap gap-2">
              {state.armed ? (
                <Button disabled={busy} onClick={() => void run(disarmHardware, "Disarmed. The rig is simulation-only again.")}>Disarm</Button>
              ) : (
                <Button variant="primary" disabled={busy || !online || state.estop.active} onClick={() => void run(() => armHardware(10), "Armed for 10 minutes")}>
                  Arm rig for 10 min
                </Button>
              )}
              {state.estop.active ? (
                <Button disabled={busy} onClick={() => void run(resetEmergencyStop, "Emergency stop reset. Loads stay off until commanded.")}>Reset emergency stop</Button>
              ) : (
                <Button variant="danger" disabled={busy} onClick={() => void run(emergencyStopHardware, "Emergency stop sent")}>
                  <OctagonX /> Emergency stop
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-fg-muted">View-only account: the rig can be watched but not armed.</p>
          )}
          <p className="text-xs text-fg-subtle">Arming lets scenario actions reach the rig for a short time. Outage and load-shed steps still wait for your approval.</p>
        </>
      )}

      {state.commands.length > 0 && (
        <section aria-labelledby="rig-cmds">
          <h3 id="rig-cmds" className="micro-label mb-2 text-fg-subtle">Latest commands</h3>
          <ul className="space-y-1.5">
            {state.commands.slice(0, 6).map((c) => {
              const p = commandProgress(c);
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium text-fg">{describe(c)}</span>
                  <Badge size="sm" tone={p.tone}>{p.text}</Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="rig-caps">
        <h3 id="rig-caps" className="micro-label mb-2 text-fg-subtle">What the rig can and cannot show</h3>
        <ul className="space-y-1.5 text-sm text-fg-muted">
          {Object.entries(state.capabilities.scenarios).map(([k, v]) => (
            <li key={k}><span className="font-semibold text-fg">{k.replace("_", " ")}:</span> {v.summary}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
