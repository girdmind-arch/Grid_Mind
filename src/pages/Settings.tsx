import { Clock3, Lock, MapPin, Palette, Target } from "lucide-react";
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger, ThemeSwitcher } from "@/components/ui";
import { ControlModeHero } from "@/components/settings/ControlModeHero";
import { GoalPresets } from "@/components/settings/GoalPresets";
import { SimulationClock } from "@/components/settings/SimulationClock";
import { CampusLocationPicker } from "@/components/settings/CampusLocationPicker";
import { GuardrailRules } from "@/components/agents/GuardrailRules";

const TABS = [
  {
    value: "goal",
    label: "Goal",
    icon: Target,
    description: "What the Commander should aim for.",
    content: <GoalPresets />,
  },
  {
    value: "location",
    label: "Location",
    icon: MapPin,
    description: "Anywhere in India. Sets the live weather and the state's electricity tariff.",
    content: <CampusLocationPicker />,
  },
  {
    value: "clock",
    label: "Clock",
    icon: Clock3,
    description: "Live follows real Indian time and today's weather. Demo evening starts at 17:20 and runs faster.",
    content: <SimulationClock />,
  },
  {
    value: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "System follows your device and switches with it.",
    content: <ThemeSwitcher className="w-full max-w-md" />,
  },
  {
    value: "guardrails",
    label: "Guardrails",
    icon: Lock,
    description: "Hard safety rules. No agent, goal or mode can override them, so they cannot be edited here.",
    content: <GuardrailRules columns={2} />,
  },
];

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" description="Who is in control, what GridMind aims for, and how the app looks." />

      <ControlModeHero />

      <Tabs defaultValue="goal" className="mt-6">
        <TabsList aria-label="Settings">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value}>
                <Icon strokeWidth={1.75} /> {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="max-w-4xl rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
            <p className="mb-5 text-sm text-fg-muted">{t.description}</p>
            {t.content}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
