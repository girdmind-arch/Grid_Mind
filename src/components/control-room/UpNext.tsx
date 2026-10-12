import { CalendarClock, IndianRupee, Sunset, TrendingUp, CloudSun } from "lucide-react";
import type { ForecastEvent } from "@/types/grid";
import { getForecast } from "@/services";
import { useService } from "@/hooks/useService";
import { Card, ErrorState, IconTile, Skeleton } from "@/components/ui";
import type { IconTileTone } from "@/components/ui/IconTile";
import { formatTime } from "@/utils/format";

const KIND: Record<ForecastEvent["kind"], { icon: typeof Sunset; tone: IconTileTone }> = {
  peak: { icon: TrendingUp, tone: "accent" },
  solar: { icon: Sunset, tone: "solar" },
  tariff: { icon: IndianRupee, tone: "neutral" },
  weather: { icon: CloudSun, tone: "warning" },
};

/** Forecast events coming up in the next hours. */
export function UpNext({ className }: { className?: string }) {
  const forecast = useService(getForecast);

  return (
    <Card className={className}>
      <div className="mb-4 flex items-center gap-2.5">
        <IconTile icon={<CalendarClock />} tone="neutral" size="sm" />
        <h2 className="text-base font-semibold text-fg">Up next</h2>
        <span className="ml-auto text-[13px] text-fg-subtle">Forecaster</span>
      </div>
      {forecast.status === "error" && <ErrorState message={forecast.error} onRetry={forecast.retry} />}
      {!forecast.data && forecast.status === "loading" && (
        <div className="space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      )}
      {forecast.data && (
        <ol className="space-y-1">
          {forecast.data.events.map((ev) => {
            const { icon: Icon, tone } = KIND[ev.kind];
            return (
              <li key={ev.id} className="flex gap-3 rounded-md py-2">
                <span className="w-12 shrink-0 pt-0.5 font-mono text-sm font-semibold tabular text-fg">{formatTime(ev.time)}</span>
                <IconTile icon={<Icon />} tone={tone} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">{ev.title}</span>
                  <span className="block text-[13px] text-fg-muted">{ev.detail}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
