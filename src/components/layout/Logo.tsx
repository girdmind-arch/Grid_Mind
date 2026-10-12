import { useId } from "react";
import { Link } from "react-router";
import { cn } from "@/utils/cn";

/** GridMind mark + wordmark. Links to the given route. */
export function Logo({ to = "/", className, compact }: { to?: string; className?: string; compact?: boolean }) {
  // Unique gradient id per instance: a shared id breaks when one copy is hidden.
  const gradientId = `gm-logo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <Link
      to={to}
      aria-label="GridMind home"
      className={cn("inline-flex items-center gap-2.5 rounded-md text-fg", className)}
    >
      <svg aria-hidden viewBox="0 0 32 32" className="size-8 shrink-0">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--hero-from)" />
            <stop offset="1" stopColor="var(--hero-to)" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
        <path d="M17.5 6 10 18h5.5L14 26l8-12h-5.5L17.5 6Z" fill="white" />
      </svg>
      {!compact && <span className="text-[17px] font-bold tracking-tight">GridMind</span>}
    </Link>
  );
}
