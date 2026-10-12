import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Bell, Search } from "lucide-react";
import { useSimClock } from "@/hooks/useSimClock";
import { formatDate, formatTime } from "@/utils/format";
import { cn } from "@/utils/cn";
import { Button, Modal } from "@/components/ui";
import { NAV_ITEMS } from "./nav";

// ---------- Simulated clock ----------
export function SimClock({ className }: { className?: string }) {
  const now = useSimClock();
  return (
    <div className={cn("flex flex-col leading-tight", className)} title="Simulated campus time (IST)">
      <span className="micro-label text-[11px] text-fg-subtle">Sim time · IST</span>
      <span className="font-mono text-sm font-semibold tabular text-fg">
        <time dateTime={now.toISOString()}>
          {formatTime(now)} <span className="font-sans font-medium text-fg-muted">· {formatDate(now)}</span>
        </time>
      </span>
    </div>
  );
}

// ---------- Search (pages only for now) ----------
function useSearchResults(query: string) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter((i) => `${i.label} ${i.keywords}`.toLowerCase().includes(q));
  }, [query]);
}

function SearchPanel({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState("");
  const results = useSearchResults(query);
  const navigate = useNavigate();
  const go = (to: string) => {
    navigate(to);
    onDone();
  };

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (results[0]) go(results[0].to);
        }}
        className="relative"
      >
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-fg-subtle" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “battery”, “outage”, “results”…"
          aria-label="Search GridMind"
          className="h-11 w-full rounded-md border border-border bg-surface pr-3 pl-10 text-[15px] text-fg placeholder:text-fg-subtle"
        />
      </form>
      <ul className="mt-3 space-y-1" aria-label="Results">
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-muted">No matches. Try a page name.</li>}
        {results.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <button
              type="button"
              onClick={() => go(to)}
              className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-medium text-fg hover:bg-surface-sunken"
            >
              <Icon aria-hidden className="size-[18px] text-fg-muted" />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Search button: a field-like trigger on desktop, an icon on mobile. Opens a search dialog. */
export function SearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Jump to a page."
      trigger={
        <button
          type="button"
          aria-label="Search"
          className={cn(
            "flex items-center gap-2.5 rounded-md text-fg-subtle transition-colors hover:text-fg",
            "size-10 justify-center pointer-coarse:size-11 md:h-10 md:w-64 md:justify-start md:border md:border-border md:bg-surface-sunken md:px-3",
          )}
        >
          <Search aria-hidden className="size-[18px] shrink-0" />
          <span className="hidden text-sm md:inline">Search pages…</span>
        </button>
      }
    >
      <SearchPanel onDone={() => setOpen(false)} />
    </Modal>
  );
}

// ---------- Notifications ----------
// MOCK: notifications will come from the agent event stream.
const NOTIFICATIONS = [
  { id: 1, title: "Plan B is active", detail: "Battery held at 82% for the evening peak.", time: "17:15" },
  { id: 2, title: "Lesson applied", detail: "Pre-cooling hostels 30 min before peak.", time: "17:14" },
  { id: 3, title: "Forecast updated", detail: "Peak of 1,510 kW expected at 19:00.", time: "17:12" },
];

export function Notifications() {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications, ${NOTIFICATIONS.length} new`} className="relative">
          <Bell />
          <span aria-hidden className="absolute top-2 right-2 size-2 rounded-full bg-accent ring-2 ring-surface" />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 w-[min(340px,calc(100vw-32px))] rounded-lg border border-border bg-surface-raised p-1.5 shadow-lg data-[state=open]:animate-fade-in"
        >
          <Dropdown.Label className="micro-label px-2.5 pt-2 pb-1.5 text-fg-subtle">Notifications</Dropdown.Label>
          {NOTIFICATIONS.map((n) => (
            <Dropdown.Item
              key={n.id}
              className="flex cursor-default flex-col gap-0.5 rounded-md px-2.5 py-2.5 outline-none data-[highlighted]:bg-surface-sunken"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-fg">{n.title}</span>
                <span className="font-mono text-xs text-fg-subtle">{n.time}</span>
              </span>
              <span className="text-[13px] text-fg-muted">{n.detail}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

// ---------- Operator avatar ----------
export function OperatorAvatar() {
  return (
    <span
      role="img"
      aria-label="Signed in as Duty Operator"
      title="Duty Operator"
      className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface-sunken text-[13px] font-bold text-fg-muted"
    >
      DO
    </span>
  );
}
