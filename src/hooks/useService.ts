import { useCallback, useEffect, useState, type DependencyList } from "react";
import { ServiceError } from "@/services";

type State<T> =
  | { status: "loading"; data: T | undefined; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: T | undefined; error: string };

/**
 * Loads data from a service function and tracks loading / error state.
 * Errors are always human-readable (never raw stack traces).
 *
 *   const grid = useService(getGridState);
 *   if (grid.status === "error") return <ErrorState message={grid.error} onRetry={grid.retry} />;
 *
 * Pass `deps` to reload when something changes. While reloading, the previous
 * data stays available so the screen does not flash back to skeletons.
 */
export function useService<T>(fn: () => Promise<T>, deps: DependencyList = []) {
  const [state, setState] = useState<State<T>>({ status: "loading", data: undefined, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ status: "loading", data: s.data, error: null }));
    fn()
      .then((data) => !cancelled && setState({ status: "success", data, error: null }))
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ServiceError ? err.message : "Something went wrong loading this. Please try again.";
        setState((s) => ({ status: "error", data: s.data, error: message }));
      });
    return () => {
      cancelled = true;
    };
  }, [fn, attempt, ...deps]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}
