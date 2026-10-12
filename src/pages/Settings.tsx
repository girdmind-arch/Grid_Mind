import { Settings as SettingsIcon } from "lucide-react";
import { PagePlaceholder } from "./PagePlaceholder";

// Built in Step 7.
export default function Settings() {
  return (
    <PagePlaceholder
      title="Settings"
      description="Theme, operating mode, guardrails and goal presets."
      step={7}
      icon={<SettingsIcon />}
    />
  );
}
