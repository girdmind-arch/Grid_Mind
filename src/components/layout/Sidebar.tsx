import { NavLink } from "react-router";
import { FlaskConical } from "lucide-react";
import { cn } from "@/utils/cn";
import { NAV_ITEMS } from "./nav";
import { Logo } from "./Logo";

/** Desktop sidebar (lg and up). */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-[var(--topbar-h)] items-center px-5">
        <Logo to="/app" />
      </div>

      <nav aria-label="Main" className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/app"}
                className={({ isActive }) =>
                  cn(
                    "group flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors duration-150",
                    isActive ? "bg-accent/10 text-accent" : "text-fg-muted hover:bg-surface-sunken hover:text-fg",
                  )
                }
              >
                <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="m-3 flex items-start gap-2.5 rounded-md bg-surface-sunken p-3 text-[13px] leading-snug text-fg-muted">
        <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>Simulated campus. Demo data until the backend is connected.</span>
      </div>
    </aside>
  );
}
