/** True when the browser can create a WebGL context (checked once). */
let cached: boolean | null = null;
export function webglAvailable() {
  if (cached !== null) return cached;
  try {
    const c = document.createElement("canvas");
    cached = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}
