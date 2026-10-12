import { useState } from "react";
import { Download } from "lucide-react";
import type { Results as ResultsData } from "@/types/agents";
import { getResults, getRunHistory } from "@/services";
import { useService } from "@/hooks/useService";
import { useScenarioStore } from "@/store/scenarioStore";
import { Button, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { ResultsHero } from "@/components/results/ResultsHero";
import { CostChart, PeakChart, RecoveryChart } from "@/components/results/ComparisonCharts";
import { RunImprovement } from "@/components/results/RunImprovement";
import { WhatIfPanel } from "@/components/results/WhatIfPanel";
import { formatDate, formatNumber } from "@/utils/format";
import { simNow } from "@/utils/simTime";
import { printPage } from "@/utils/printPage";

export default function Results() {
  const results = useService(getResults);
  const runHistory = useService(getRunHistory);
  const sessionRuns = useScenarioStore((s) => s.history);
  // A what-if run replaces the numbers until the operator goes back to the real campus.
  const [whatIf, setWhatIf] = useState<ResultsData | null>(null);
  const base = whatIf ?? results.data;
  const data = base && whatIf?.settings
    ? {
        ...base,
        dataNote: `What-if: ${whatIf.settings.batteryKwh === 0 ? "no battery" : `${formatNumber(whatIf.settings.batteryKwh / 1000, 2)} MWh battery`}, ${whatIf.settings.solarPct}% solar, peak ₹${whatIf.settings.peakRate.toFixed(2)}/kWh${whatIf.settings.tempOffsetC ? `, ${whatIf.settings.tempOffsetC > 0 ? "+" : ""}${whatIf.settings.tempOffsetC}°C` : ""}`,
      }
    : base;

  return (
    <>
      {/* Only in the PDF: says what the document is when it is read away from the app. */}
      <p className="mb-4 hidden text-sm text-fg-muted print:block">
        GridMind · Results report · BITSETGO'26 · Simulated campus, {formatDate(simNow())} 2026
      </p>

      <PageHeader
        title="Results"
        description="GridMind compared with a no-AI baseline on the same simulated campus."
        actions={
          data && (
            <Button variant="secondary" onClick={printPage} className="print:hidden" title="Opens the print dialog. Choose “Save as PDF”.">
              <Download /> Save as PDF
            </Button>
          )
        }
      />

      {results.status === "error" && !data && <ErrorState message={results.error} onRetry={results.retry} />}

      {!data && results.status === "loading" && (
        <div className="space-y-6">
          <Skeleton className="h-80" />
          <div className="grid gap-6 xl:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      )}

      {data && (
        <>
          <ResultsHero results={data} />
          <div className="mt-6">
            <WhatIfPanel
              key={results.data?.settings ? JSON.stringify(results.data.settings) : "default"}
              defaults={results.data?.settings}
              onResults={(r) => setWhatIf(r)}
            />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2 print:block print:space-y-6">
            <CostChart data={data.cost} />
            <PeakChart data={data.peak} />
            <RecoveryChart data={data.recovery} />
            <RunImprovement
              runs={data.runs}
              baselineMin={data.headline.recovery.baselineMin}
              history={runHistory.data}
              sessionRuns={sessionRuns}
            />
          </div>
        </>
      )}
    </>
  );
}
