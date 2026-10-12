import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge, IconTile } from "@/components/ui";
import type { IconTileTone } from "@/components/ui/IconTile";
import { cn } from "@/utils/cn";

export type NodeState = "normal" | "reduced" | "faulted" | "idle";

interface GridNodeProps {
  name: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  tone: IconTileTone;
  state?: NodeState;
  /** Labs: never shed. Shown as a small shield. */
  protectedZone?: boolean;
  compact?: boolean;
  style: React.CSSProperties;
}

const stateLabel: Partial<Record<NodeState, { text: string; tone: "warning" | "danger" | "neutral" }>> = {
  reduced: { text: "Reduced", tone: "warning" },
  faulted: { text: "Fault", tone: "danger" },
};

/** A box in the grid diagram (source or zone). Absolutely positioned by GridDiagram. */
export function GridNode({ name, value, sub, icon, tone, state = "normal", protectedZone, compact, style }: GridNodeProps) {
  const label = stateLabel[state];
  return (
    <div
      style={style}
      className={cn(
        "absolute flex items-center gap-2.5 rounded-md border bg-surface-raised px-3 shadow-sm transition-[border-color,box-shadow,background-color] duration-300",
        state === "normal" && "border-border",
        state === "idle" && "border-border",
        state === "reduced" && "border-warning/50",
        state === "faulted" && "border-danger bg-danger/6 shadow-glow-danger",
      )}
    >
      {!compact && <IconTile icon={icon} tone={state === "faulted" ? "danger" : tone} size="sm" />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm leading-tight font-semibold text-fg">
          <span className={compact ? "line-clamp-2" : "truncate"}>{name}</span>
          {protectedZone && (
            <ShieldCheck aria-label="Protected: labs never lose power" className="size-3.5 shrink-0 text-success" />
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className={cn("font-mono text-sm font-semibold tabular", state === "faulted" ? "text-danger" : "text-fg")}>{value}</span>
          {label && (
            <Badge tone={label.tone} size="sm" dot className="h-5 px-1.5 text-xs">
              {label.text}
            </Badge>
          )}
        </p>
        {sub && <p className="mt-0.5 truncate text-[13px] text-fg-muted">{sub}</p>}
      </div>
    </div>
  );
}
