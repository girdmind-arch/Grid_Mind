import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, PlayCircle } from "lucide-react";
import { USE_MOCKS, getGridState } from "@/services";
import { useService } from "@/hooks/useService";
import { Badge, Button, Skeleton } from "@/components/ui";
import { GridDiagram } from "@/components/grid/GridDiagram";
import { formatKw } from "@/utils/format";

/** The page's one gradient hero: tagline, what GridMind is, the demo button, and a live grid preview. */
export function LandingHero() {
  // With the live backend the preview refreshes every few seconds.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (USE_MOCKS) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, []);
  const grid = useService(getGridState, [tick]);
  const env = grid.data?.environment;

  return (
    <div className="mx-auto w-full max-w-[var(--content-max)] px-[var(--gutter)] pt-6 sm:pt-10 lg:px-[var(--gutter-lg)]">
      <section aria-labelledby="hero-title" className="overflow-hidden rounded-xl bg-hero text-hero-text shadow-hero">
        <div className="grid items-center gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:p-14">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-white/16 px-3 py-1 text-[13px] font-semibold">BITSETGO'26 · Agentic AI & ML</span>
            <h1 id="hero-title" className="mt-5 text-[36px] leading-[1.08] font-extrabold tracking-tight sm:text-[52px]">
              A control room that thinks, acts, and explains.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-hero-text-muted">
              GridMind's AI agents run a campus microgrid of solar, battery and the main grid. They forecast demand, test every
              plan in a digital twin, act within hard safety rules, explain why, and learn from each incident.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="onHero" size="lg">
                <Link to="/app">
                  Open the live demo <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="onHeroGhost" size="lg">
                <a href="#demo">
                  <PlayCircle /> Watch the walkthrough
                </a>
              </Button>
            </div>
          </div>

          {/* Live preview: the same diagram and data as the Control Room. */}
          <div className="min-w-0 rounded-lg border border-border bg-surface p-4 text-fg shadow-lg sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Campus grid · right now</p>
              <Badge tone="success" size="sm" dot pulse>
                {grid.data ? `${formatKw(grid.data.demandKw)} demand` : "Live"}
              </Badge>
            </div>
            {grid.data ? (
              <GridDiagram state={grid.data} />
            ) : (
              <Skeleton className="h-[380px]" />
            )}
            <p className="mt-3 text-[13px] text-fg-subtle">
              Simulated campus · 4 hostels, 2 labs, library, admin block
              {env && env.weatherSource === "open-meteo" && ` · live weather, ${env.location} ${Math.round(env.temperatureC)}°C`}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
