import { createBrowserRouter, RouterProvider } from "react-router";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "@/hooks/useTheme";
import { Toaster } from "@/components/ui";
import { AppShell } from "@/components/layout/AppShell";
import Landing from "@/pages/Landing";
import ControlRoom from "@/pages/ControlRoom";
import Agents from "@/pages/Agents";
import Scenarios from "@/pages/Scenarios";
import Memory from "@/pages/Memory";
import Results from "@/pages/Results";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

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
]);

export default function App() {
  return (
    <ThemeProvider>
      {/* reducedMotion="user": Framer Motion respects prefers-reduced-motion */}
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
        <Toaster />
      </MotionConfig>
    </ThemeProvider>
  );
}
