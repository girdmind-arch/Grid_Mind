import { useState } from "react";
import { Send, Target } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { setGoal as setGoalService } from "@/services";
import { Button, Card, IconTile, ThinkingSteps, toast } from "@/components/ui";

const EXAMPLES = ["Minimise cost tonight", "Maximise hostel comfort", "Protect battery health", "Prepare for a storm"];

/** Current operator goal in plain English, with a way to change it. */
export function GoalCard({ className }: { className?: string }) {
  const goal = useAppStore((s) => s.goal);
  const interpretation = useAppStore((s) => s.goalInterpretation);
  const saveGoal = useAppStore((s) => s.setGoal);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (text: string) => {
    const value = text.trim();
    if (!value) return;
    setSending(true);
    try {
      const ack = await setGoalService(value);
      saveGoal(ack.goal, ack.interpretation);
      setEditing(false);
      setDraft("");
      toast({ title: "Goal updated", description: "The Commander will plan around it from the next cycle.", tone: "ai" });
    } catch {
      toast({ title: "The goal could not be sent.", description: "Safe rule-based control is active. Try again.", tone: "warning" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className={className}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={<Target />} tone="ai" size="sm" />
        <h2 className="micro-label text-fg-muted">Operator goal</h2>
      </div>

      {!editing && (
        <>
          <p className="mt-3 text-lg leading-snug font-semibold text-fg">{goal}</p>
          {interpretation && <p className="mt-2 text-sm text-fg-muted">{interpretation}</p>}
          <Button className="mt-4" onClick={() => setEditing(true)}>
            Change goal
          </Button>
        </>
      )}

      {editing && sending && (
        <div className="mt-4 rounded-md bg-surface-sunken p-3.5">
          <ThinkingSteps steps={["Reading your goal", "Checking it against guardrails", "Goal accepted"]} stepMs={300} />
        </div>
      )}

      {editing && !sending && (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(draft);
          }}
        >
          <label htmlFor="goal-input" className="sr-only">
            Tell GridMind your goal
          </label>
          <div className="flex gap-2">
            <input
              id="goal-input"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Tell GridMind your goal..."
              className="h-11 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-3 text-[15px] text-fg placeholder:text-fg-subtle"
            />
            <Button type="submit" variant="primary" size="icon" aria-label="Send goal" disabled={!draft.trim()} className="size-11">
              <Send />
            </Button>
          </div>
          <p className="mt-3 text-[13px] text-fg-muted">Or pick one:</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => void submit(ex)}
                className="h-9 rounded-full border border-border bg-surface-sunken px-3 text-[13px] font-medium text-fg hover:border-ai/40 hover:text-ai pointer-coarse:h-11"
              >
                {ex}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-3 -ml-2" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      )}
    </Card>
  );
}
