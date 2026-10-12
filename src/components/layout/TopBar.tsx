import { useAppStore } from "@/store/appStore";
import { ModeIndicator, ThemeToggle } from "@/components/ui";
import { Logo } from "./Logo";
import { LiveWeather, Notifications, OperatorAvatar, SearchButton, SimClock } from "./TopBarParts";

/** Top bar: search, simulated clock, mode pill, theme, notifications, operator. */
export function TopBar() {
  const mode = useAppStore((s) => s.mode);

  return (
    <header className="print:hidden sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-[var(--topbar-h)] max-w-[var(--content-max)] items-center gap-2 px-[var(--gutter)] sm:gap-3 lg:px-[var(--gutter-lg)]">
        {/* Logo only on mobile/tablet; desktop has it in the sidebar */}
        <Logo to="/app" compact className="lg:hidden" />
        <SearchButton />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LiveWeather className="mr-3 hidden xl:flex" />
          <SimClock className="mr-2 hidden sm:flex" />
          <ModeIndicator mode={mode} className="hidden sm:inline-flex" />
          <ModeIndicator mode={mode} compact className="sm:hidden" />
          <ThemeToggle />
          <Notifications />
          <OperatorAvatar />
        </div>
      </div>
    </header>
  );
}
