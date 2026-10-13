import { lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "@/hooks/useTheme";
import { Toaster } from "@/components/ui";
import { AppShell } from "@/components/layout/AppShell";
import { GridBackdrop } from "@/components/layout/GridBackdrop";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/NotFound";

// App pages load on demand, so the landing page opens fast and each page only
// downloads its own code (charts, diagrams) when it is first visited.
const ControlRoom = lazy(() => import("@/pages/ControlRoom"));
const Agents = lazy(() => import("@/pages/Agents"));
const Scenarios = lazy(() => import("@/pages/Scenarios"));
const Memory = lazy(() => import("@/pages/Memory"));
const Results = lazy(() => import("@/pages/Results"));
const Settings = lazy(() => import("@/pages/Settings"));

// Routes: "/" is the public website, "/app/*" is the Control Room app.
const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  {
    path: "/app",
    element: <AppShell />,
    children: [
      { index: true, element: <ControlRoom /> },
      { path: "agents", element: <Agents /> },
      { path: "scenarios", element: <Scenarios /> },
      { path: "memory", element: <Memory /> },
      { path: "results", element: <Results /> },
      { path: "settings", element: <Settings /> },
    ],
  },
  { path: "*", element: <NotFound /> },
], {
  // Matches Vite's `base`, so routes work when the site lives in a sub-folder.
  basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
});

export default function App() {
  return (
    <ThemeProvider>
      {/* reducedMotion="user": Framer Motion respects prefers-reduced-motion */}
      <MotionConfig reducedMotion="user">
        <GridBackdrop />
        <RouterProvider router={router} />
        <Toaster />
      </MotionConfig>
    </ThemeProvider>
  );
}
