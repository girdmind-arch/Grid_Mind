import { ChartColumn } from "lucide-react";
import { PagePlaceholder } from "./PagePlaceholder";

// Built in Step 6.
export default function Results() {
  return (
    <PagePlaceholder
      title="Results"
      description="GridMind compared with a no-AI baseline."
      step={6}
      icon={<ChartColumn />}
    />
  );
}
