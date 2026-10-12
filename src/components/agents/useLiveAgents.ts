import { useEffect, useMemo } from "react";
import type { Agent, AgentId, AgentStatus } from "@/types/agents";
import type { FaultType } from "@/types/grid";
import { getAgents } from "@/services";
import { useService } from "@/hooks/useService";
import { useScenarioStore, type ScenarioPhase } from "@/store/scenarioStore";

/** Which agents are busy while a scenario is being handled. */
function liveStatus(id: AgentId, phase: ScenarioPhase, type: FaultType | undefined): AgentStatus {
  if (phase === "awaiting-approval") return id === "guardrail" ? "waiting" : "idle";
  if (phase !== "responding") return "idle";
  if (id === "commander" || id === "guardrail") return "thinking";
  if (id === "planner") return "acting";
  if (id === "fault" && (type === "line_failure" || type === "grid_outage")) return "acting";
  if (id === "forecaster" && (type === "cloud_cover" || type === "heatwave")) return "acting";
  if (id === "zone" && type === "heatwave") return "acting";
  return "idle";
}

/**
 * The agent roster from the service layer, with status and last action
 * updated live from the thought trace.
 */
export function useLiveAgents() {
  const liveTick = useScenarioStore((s) => s.liveTick);
  const roster = useService(getAgents, [liveTick]);
  const { decisions, phase, active, loadTrace } = useScenarioStore();

  useEffect(() => {
    void loadTrace();
  }, [loadTrace]);

  const agents = useMemo<Agent[] | undefined>(() => {
    if (!roster.data) return undefined;
    return roster.data.map((a) => {
      // decisions are newest first; take this agent's latest step
      const latestStep = decisions.flatMap((d) => [...d.steps].reverse()).find((s) => s.agent === a.id);
      return {
        ...a,
        status: liveStatus(a.id, phase, active?.type),
        lastAction: latestStep?.summary ?? a.lastAction,
      };
    });
  }, [roster.data, decisions, phase, active?.type]);

  return { agents, status: roster.status, error: roster.error, retry: roster.retry };
}
