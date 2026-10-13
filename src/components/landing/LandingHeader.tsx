import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Button, ThemeToggle } from "@/components/ui";
import { Logo } from "@/components/layout/Logo";

export const LANDING_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#agents", label: "Agents" },
  { href: "#results", label: "Results" },
];

/** Sticky site header: logo, section links (desktop), theme toggle, the demo button. */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-[var(--topbar-h)] w-full max-w-[var(--content-max)] items-center justify-between gap-4 px-[var(--gutter)] lg:px-[var(--gutter-lg)]">
        <Logo />
        <nav aria-label="Sections" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {LANDING_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="rounded-sm px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:text-fg">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="secondary" size="sm">
            <Link to="/app">
              Live demo <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
