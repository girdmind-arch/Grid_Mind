import { Bot } from "lucide-react";
import { PagePlaceholder } from "./PagePlaceholder";

// Built in Step 4.
export default function Agents() {
  return (
    <PagePlaceholder
      title="Agents"
      description="Who the agents are, what they are doing, and how they decide."
      step={4}
      icon={<Bot />}
    />
  );
}
