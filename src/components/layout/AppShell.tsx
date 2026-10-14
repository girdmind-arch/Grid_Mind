import { Suspense } from "react";
import { useLocation, useOutlet } from "react-router";
import { Skeleton } from "@/components/ui";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { useLiveBackend } from "@/hooks/useLiveBackend";

/** Layout for every /app page: sidebar (desktop), top bar, content, bottom nav (mobile). */
export function AppShell() {
  const { pathname } = useLocation();
  // useOutlet() captures the current page, so the old page can fade out
  // while the new one waits (a plain <Outlet /> would swap instantly).
  const outlet = useOutlet();
  useLiveBackend();

  return (
    <div className="relative min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-md focus:bg-surface-raised focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-fg focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)] print:pl-0">
        <TopBar />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto max-w-[var(--content-max)] px-[var(--gutter)] pt-6 pb-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom)+32px)] focus:outline-none sm:pt-8 lg:px-[var(--gutter-lg)] lg:pb-12 print:max-w-none print:p-0"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={<PageLoading />}>{outlet}</Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

/** Shown for a moment the first time a page's code is downloaded. */
function PageLoading() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <Skeleton className="mb-3 h-4 w-40" />
      <Skeleton className="mb-6 h-9 w-72" />
      <Skeleton className="h-56" />
    </div>
  );
}
