import { useState } from "react";
import { Battery, BrainCircuit, Gauge, IndianRupee, Plug, SunMedium, Zap } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import type { ControlMode } from "@/types/grid";
import { getGridState } from "@/services";
import { useService } from "@/hooks/useService";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  IconTile,
  MODE_INFO,
  Modal,
  ModeIndicator,
  PageHeader,
  ProgressBar,
  SegmentedControl,
  Skeleton,
  StatTile,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ThemeSwitcher,
  ThinkingSteps,
  toast,
} from "@/components/ui";

// TEMPORARY (Step 1): a foundation preview so the design system can be
// reviewed in both themes. Step 2 replaces this file with the real Control Room.

export default function ControlRoom() {
  const grid = useService(getGridState);
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const [thinkingDone, setThinkingDone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Step 1 · Foundation preview"
        title="Control Room"
        description="Design tokens, theme system and base components. The real Control Room replaces this page in Step 2."
        actions={<ThemeSwitcher />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hero: the one gradient element on this screen */}
        <Card variant="hero" padding="lg" className="lg:col-span-2">
          <Badge tone="onHero" dot pulse size="sm">
            Hero card
          </Badge>
          <p className="mt-4 max-w-xl text-2xl leading-snug font-bold sm:text-[28px]">
            Evening peak in 40 minutes. Battery at 82%. Plan B is active.
          </p>
          <p className="mt-2 text-[15px] text-hero-text-muted">
            The gradient is reserved for one hero per screen.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="onHero">Open live grid</Button>
            <Button variant="onHeroGhost">Secondary on hero</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Control mode</CardTitle>
              <CardDescription>{MODE_INFO[mode].description}</CardDescription>
            </div>
          </CardHeader>
          <SegmentedControl<ControlMode>
            label="Control mode"
            value={mode}
            onChange={setMode}
            className="w-full"
            options={[
              { value: "ai", label: "AI" },
              { value: "fallback", label: "Rules" },
              { value: "manual", label: "Manual" },
            ]}
          />
          <p className="mt-3 text-sm text-fg-muted">
            Changes the pill in the top bar: <ModeIndicator mode={mode} />
          </p>
        </Card>
      </div>

      {/* Stat strip, driven by the mock service layer */}
      <section aria-label="Grid stats" className="mt-4">
        {grid.status === "error" ? (
          <ErrorState message={grid.error} onRetry={grid.retry} />
        ) : grid.data ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="Demand" value={grid.data.demandKw} unit="kW" icon={<Gauge />} tone="accent" trend="up" />
            <StatTile label="Solar" value={grid.data.solarKw} unit="kW" icon={<SunMedium />} tone="solar" trend="down" />
            <StatTile label="Battery" value={grid.data.battery.socPct} unit="%" icon={<Battery />} tone="success" trend="flat" />
            <StatTile label="Grid draw" value={grid.data.gridImportKw} unit="kW" icon={<Plug />} tone="accent" trend="up" />
            <StatTile
              label="Cost today"
              value={grid.data.costTodayInr}
              prefix="₹"
              icon={<IndianRupee />}
              tone="neutral"
              trend="up"
              className="col-span-2 sm:col-span-1"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className={i === 4 ? "col-span-2 h-[122px] sm:col-span-1" : "h-[122px]"} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buttons & status pills</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Isolate zone</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="success" dot>Healthy</Badge>
            <Badge tone="warning" dot>Solar dropping</Badge>
            <Badge tone="danger" dot>Fault</Badge>
            <Badge tone="ai" dot pulse>Thinking</Badge>
            <Badge tone="accent">Plan B</Badge>
            <Badge>Idle</Badge>
          </div>
          <div className="mt-5 space-y-4">
            <ProgressBar label="Battery charge" value={82} tone="success" />
            <ProgressBar label="Solar vs. capacity" value={310} max={720} tone="solar" valueText="310 / 720 kW" />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tabs, modal & toasts</CardTitle>
          </CardHeader>
          <Tabs defaultValue="thinking">
            <TabsList aria-label="Preview">
              <TabsTrigger value="thinking">AI loading</TabsTrigger>
              <TabsTrigger value="empty">Empty</TabsTrigger>
              <TabsTrigger value="error">Error</TabsTrigger>
            </TabsList>
            <TabsContent value="thinking">
              <div className="flex items-start gap-3 rounded-md bg-surface-sunken p-4">
                <IconTile icon={<BrainCircuit />} tone="ai" size="sm" />
                <ThinkingSteps done={thinkingDone} className="flex-1" />
              </div>
              <Button size="sm" className="mt-3" onClick={() => setThinkingDone((d) => !d)}>
                {thinkingDone ? "Reset" : "Finish decision"}
              </Button>
            </TabsContent>
            <TabsContent value="empty">
              <div className="rounded-md bg-surface-sunken">
                <EmptyState
                  icon={<Zap />}
                  title="No scenarios run yet"
                  description="Break the grid on purpose and watch GridMind heal it."
                  action={<Button variant="primary" size="sm">Run a scenario</Button>}
                  className="py-8"
                />
              </div>
            </TabsContent>
            <TabsContent value="error">
              <ErrorState onRetry={() => toast({ title: "Retrying…", tone: "neutral" })} />
            </TabsContent>
          </Tabs>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
            <Modal
              open={modalOpen}
              onOpenChange={setModalOpen}
              title="Why did you do that?"
              description="Plain-language explanation from the Commander."
              trigger={<Button>Open modal</Button>}
              footer={
                <Button variant="primary" onClick={() => setModalOpen(false)}>
                  Got it
                </Button>
              }
            >
              <p className="text-[15px] text-fg-muted">
                Grid power is most expensive between 6 and 10 pm, so GridMind saves the battery now and uses it then.
                Labs are never touched.
              </p>
            </Modal>
            <Button onClick={() => toast({ title: "Goal updated", description: "Minimise cost tonight.", tone: "success" })}>
              Success toast
            </Button>
            <Button onClick={() => toast({ title: "Commander", description: "Testing 2 plans in the digital twin.", tone: "ai" })}>
              AI toast
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
