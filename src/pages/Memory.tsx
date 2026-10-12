import { History } from "lucide-react";
import { PagePlaceholder } from "./PagePlaceholder";

// Built in Step 5.
export default function Memory() {
  return (
    <PagePlaceholder
      title="Memory"
      description="Past incidents and the lessons the Critic has learned."
      step={5}
      icon={<History />}
    />
  );
}
