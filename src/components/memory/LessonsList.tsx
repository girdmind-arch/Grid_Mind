import { ClipboardCheck, Repeat } from "lucide-react";
import type { Lesson } from "@/types/agents";
import { Badge, Card, IconTile } from "@/components/ui";

/** The Critic's "lessons learned" notes, with how often each has been reused. */
export function LessonsList({ lessons, sessionIds, className }: { lessons: Lesson[]; sessionIds: Set<string>; className?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={<ClipboardCheck />} tone="success" size="sm" />
        <h2 className="text-base font-semibold text-fg">Lessons learned</h2>
        <span className="ml-auto text-[13px] text-fg-subtle">by the Critic</span>
      </div>
      <p className="mt-2 text-sm text-fg-muted">
        After every incident the Critic writes down what to do better. The Commander checks these before each new decision.
      </p>

      <ul className="mt-4 space-y-3">
        {lessons.map((l) => (
          <li key={l.id} className="rounded-md border border-border bg-surface-sunken p-3.5">
            <p className="text-sm font-medium text-fg">“{l.note}”</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge size="sm">From {l.incidentId}</Badge>
              <Badge tone={l.appliedCount > 0 ? "success" : "neutral"} size="sm" icon={<Repeat />}>
                {l.appliedCount > 0 ? `Applied ${l.appliedCount}×` : "Not used yet"}
              </Badge>
              {sessionIds.has(l.incidentId) && (
                <Badge tone="ai" size="sm" dot>
                  New
                </Badge>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
