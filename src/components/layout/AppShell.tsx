import { useLocation, useOutlet } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

/** Layout for every /app page: sidebar (desktop), top bar, content, bottom nav (mobile). */
export function AppShell() {
  const { pathname } = useLocation();
  // useOutlet() captures the current page, so the old page can fade out
  // while the new one waits (a plain <Outlet /> would swap instantly).
  const outlet = useOutlet();

  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-md focus:bg-surface-raised focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-fg focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <TopBar />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto max-w-[var(--content-max)] px-[var(--gutter)] pt-6 pb-[calc(var(--bottomnav-h)+32px)] focus:outline-none sm:pt-8 lg:px-[var(--gutter-lg)] lg:pb-12"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
