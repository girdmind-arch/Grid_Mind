import { Cloud, Flame, Unplug, Zap } from "lucide-react";
import type { FaultType } from "@/types/grid";
import type { IconTileTone } from "@/components/ui/IconTile";

// How each scenario is named and shown across the app.

export const SCENARIOS: Record<
  FaultType,
  { title: string; blurb: string; icon: typeof Cloud; tone: IconTileTone; activeLabel: string }
> = {
  cloud_cover: {
    title: "Cloud Cover",
    blurb: "Solar output drops suddenly.",
    icon: Cloud,
    tone: "solar",
    activeLabel: "Cloud cover is cutting solar output",
  },
  heatwave: {
    title: "Heatwave",
    blurb: "Cooling demand spikes across hostels.",
    icon: Flame,
    tone: "warning",
    activeLabel: "Heatwave is pushing demand up",
  },
  line_failure: {
    title: "Line Failure",
    blurb: "A feeder cable to a hostel trips.",
    icon: Zap,
    tone: "danger",
    activeLabel: "Line failure near Narmada Hostel",
  },
  grid_outage: {
    title: "Grid Outage",
    blurb: "The main grid supply is lost.",
    icon: Unplug,
    tone: "accent",
    activeLabel: "Main grid supply is lost",
  },
};

export const SCENARIO_ORDER: FaultType[] = ["cloud_cover", "heatwave", "line_failure", "grid_outage"];
