import { Zap } from "lucide-react";
import { PagePlaceholder } from "./PagePlaceholder";

// Built in Step 3.
export default function Scenarios() {
  return (
    <PagePlaceholder
      title="Scenarios"
      description="Break the grid on purpose and watch the agents respond."
      step={3}
      icon={<Zap />}
    />
  );
}
