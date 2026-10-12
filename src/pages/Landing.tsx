import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Button, ThemeToggle } from "@/components/ui";
import { Logo } from "@/components/layout/Logo";

// TEMPORARY (Step 1): the full landing page is built in Step 8.
export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="mx-auto flex h-[var(--topbar-h)] w-full max-w-[var(--content-max)] items-center justify-between px-[var(--gutter)] lg:px-[var(--gutter-lg)]">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="primary" size="sm">
            <Link to="/app">Open live demo</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-[var(--gutter)] py-16 text-center">
        <p className="micro-label text-fg-subtle">BITSETGO'26 · Agentic AI & ML</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          A control room that thinks, acts, and explains.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-fg-muted">
          GridMind's AI agents run a campus microgrid: they forecast, test plans in a digital twin, act safely, and
          learn from every incident.
        </p>
        <Button asChild variant="primary" size="lg" className="mt-8">
          <Link to="/app">
            Open live demo <ArrowRight />
          </Link>
        </Button>
        <p className="mt-10 text-sm text-fg-subtle">The full landing page is built in Step 8.</p>
      </main>
    </div>
  );
}
