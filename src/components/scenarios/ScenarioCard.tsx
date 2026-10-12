import type { FaultType } from "@/types/grid";
import { IconTile } from "@/components/ui";
import { cn } from "@/utils/cn";
import { SCENARIOS } from "./scenarioMeta";

interface ScenarioCardProps {
  type: FaultType;
  onRun: (type: FaultType) => void;
  disabled?: boolean;
  /** This scenario is the one currently running. */
  running?: boolean;
  className?: string;
}

/** Compact "break the grid" card. The Scenarios page uses a larger version. */
export function ScenarioCard({ type, onRun, disabled, running, className }: ScenarioCardProps) {
  const s = SCENARIOS[type];
  const Icon = s.icon;
  return (
    <button
      type="button"
      onClick={() => onRun(type)}
      disabled={disabled}
      aria-label={`Run scenario: ${s.title}. ${s.blurb}`}
      className={cn(
        "group flex h-full min-h-[112px] flex-col items-start gap-3 rounded-lg border bg-surface p-4 text-left shadow-sm",
        "transition-[transform,box-shadow,border-color] duration-200 ease-out",
        "enabled:hover:-translate-y-0.5 enabled:hover:border-border-strong enabled:hover:shadow-md motion-reduce:enabled:hover:translate-y-0",
        "disabled:cursor-not-allowed disabled:opacity-55",
        running ? "border-warning/60" : "border-border",
        className,
      )}
    >
      <IconTile icon={<Icon />} tone={s.tone} size="sm" />
      <span>
        <span className="block text-[15px] font-semibold text-fg">{s.title}</span>
        <span className="mt-0.5 block text-[13px] text-fg-muted">{running ? "Running now" : s.blurb}</span>
      </span>
    </button>
  );
}
