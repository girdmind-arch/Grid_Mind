import { Component, Suspense, lazy, useState, type ReactNode } from "react";
import { Box, LayoutGrid } from "lucide-react";
import type { GridState } from "@/types/grid";
import { SegmentedControl, Skeleton } from "@/components/ui";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/utils/cn";
import { GridDiagram } from "./GridDiagram";
import { webglAvailable } from "./grid3d/webgl";

const Grid3D = lazy(() => import("./grid3d/Grid3D"));

type View = "3d" | "plan";
const KEY = "gridmind-grid-view";

function readView(): View {
  try {
    return localStorage.getItem(KEY) === "plan" ? "plan" : "3d";
  } catch {
    return "3d";
  }
}

/** Falls back to the 2D plan if the 3D view throws (e.g. WebGL lost). */
class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The live grid, as a 3D campus model (default) or the flat plan. The choice
 * is remembered on this device. Screen readers get the plan's text summary.
 */
export function GridView({ state, className, compactToggle }: { state: GridState; className?: string; compactToggle?: boolean }) {
  const canGl = webglAvailable();
  const [view, setView] = useState<View>(() => (canGl ? readView() : "plan"));
  const narrow = useMediaQuery("(max-width: 639px)");
  const height = narrow ? 500 : 460;

  const choose = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // ignore
    }
  };

  const plan = <GridDiagram state={state} />;

  return (
    <div className={cn("min-w-0", className)}>
      {canGl && (
        <div className={cn("mb-3 flex items-center gap-3", compactToggle ? "justify-end" : "justify-between")}>
          {!compactToggle && (
            <p className="text-[13px] text-fg-subtle">
              {view === "3d" ? (narrow ? "Live 3D campus. Tap a building for details." : "Live 3D campus. Drag to turn it, click a building for details.") : "Flat plan of the same grid."}
            </p>
          )}
          <SegmentedControl
            label="Grid view"
            value={view}
            onChange={choose}
            options={[
              { value: "3d", label: "3D", icon: <Box aria-hidden /> },
              { value: "plan", label: "Plan", icon: <LayoutGrid aria-hidden /> },
            ]}
          />
        </div>
      )}
      {view === "3d" && canGl ? (
        <Fallback fallback={plan}>
          <figure className="m-0">
            <figcaption className="sr-only">
              3D model of the campus grid. The same values are in the plan view.
            </figcaption>
            <Suspense fallback={<div style={{ height }}><Skeleton className="h-full" /></div>}>
              <Grid3D state={state} height={height} />
            </Suspense>
          </figure>
        </Fallback>
      ) : (
        plan
      )}
    </div>
  );
}
