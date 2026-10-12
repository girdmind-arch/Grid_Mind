// Tiny HTTP helper for the real FastAPI backend.
// Set VITE_API_URL (e.g. http://localhost:8000) in .env.local to switch the
// services from mock data to the backend. Use "/" when the backend serves this
// website itself (same origin). No API keys belong in the frontend.

export const API_URL: string | undefined = import.meta.env.VITE_API_URL || undefined;
export const USE_MOCKS = !API_URL;
const API_BASE = API_URL === "/" ? "" : (API_URL ?? "").replace(/\/$/, "");

/** Error with a human-readable message the UI can show as-is. */
export class ServiceError extends Error {}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ServiceError("The AI service is unreachable. Safe rule-based control is active.");
  }
  if (!res.ok) {
    throw new ServiceError("The AI service had a problem. Safe rule-based control is active.");
  }
  return res.json() as Promise<T>;
}

/** Simulates network latency for mocks, so loading states are visible. */
export const mockDelay = (ms = 450) => new Promise((r) => setTimeout(r, ms));
