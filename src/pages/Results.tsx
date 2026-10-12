import { getResults } from "@/services";
import { useService } from "@/hooks/useService";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { ResultsHero } from "@/components/results/ResultsHero";
import { CostChart, PeakChart, RecoveryChart } from "@/components/results/ComparisonCharts";
import { RunImprovement } from "@/components/results/RunImprovement";

export default function Results() {
  const results = useService(getResults);
  const data = results.data;

  return (
    <>
      <PageHeader title="Results" description="GridMind compared with a no-AI baseline on the same simulated campus." />

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
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <CostChart data={data.cost} />
            <PeakChart data={data.peak} />
            <RecoveryChart data={data.recovery} />
            <RunImprovement runs={data.runs} baselineMin={data.headline.recovery.baselineMin} />
          </div>
        </>
      )}
    </>
  );
}
