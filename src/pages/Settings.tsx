import type { ReactNode } from "react";
import { Link } from "react-router";
import { Clock3, Lock, Palette, Target } from "lucide-react";
import { Card, IconTile, PageHeader, ThemeSwitcher } from "@/components/ui";
import { ControlModeHero } from "@/components/settings/ControlModeHero";
import { GoalPresets } from "@/components/settings/GoalPresets";
import { SimulationClock } from "@/components/settings/SimulationClock";
import { GuardrailRules } from "@/components/agents/GuardrailRules";

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="text-base font-semibold text-fg">{title}</h2>
      </div>
      <p className="mt-2 mb-5 text-sm text-fg-muted">{description}</p>
      {children}
    </Card>
  );
}

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" description="Who is in control, what GridMind aims for, and how the app looks." />

      <ControlModeHero />

      {/* Phones: goals, appearance, guardrails. Desktop: appearance sits in the right column. */}
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <Section
            icon={<IconTile icon={<Target />} tone="ai" size="sm" />}
            title="Goal presets"
            description={
              <>
                Pick what the Commander should aim for. To type your own, use the goal card in the{" "}
                <Link to="/app" className="font-semibold text-accent hover:text-accent-hover">
                  Control Room
                </Link>
                .
              </>
            }
          >
            <GoalPresets />
          </Section>
        </div>
        <div className="min-w-0 space-y-6 xl:col-span-4 xl:col-start-9 xl:row-start-1 xl:row-span-2">
          <Section
            icon={<IconTile icon={<Clock3 />} tone="ai" size="sm" />}
            title="Simulation clock"
            description="Live follows real Indian time and today's weather. Demo evening starts at 17:20 and runs faster."
          >
            <SimulationClock />
          </Section>
          <Section
            icon={<IconTile icon={<Palette />} tone="accent" size="sm" />}
            title="Appearance"
            description="System follows your device and switches with it."
          >
            <ThemeSwitcher className="w-full" />
          </Section>
        </div>
        <div className="min-w-0 xl:col-span-8">
          <Section
            icon={<IconTile icon={<Lock />} tone="success" size="sm" />}
            title="Guardrails"
            description="Hard safety rules. No agent, goal or mode can override them, so they cannot be edited here."
          >
            <GuardrailRules columns={2} />
          </Section>
        </div>
      </div>
    </>
  );
}
