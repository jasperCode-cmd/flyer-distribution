import { extractRoute, type ExtractOptions } from "@/lib/rounds/extract";

// Traces a route off the page's main thread, so the page stays responsive
// while a large screenshot is worked through.

type Request = { id: number; width: number; height: number; data: Uint8ClampedArray; options: ExtractOptions };
type WorkerScope = { onmessage: ((event: MessageEvent<Request>) => void) | null; postMessage(message: unknown): void };

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, width, height, data, options } = event.data;
  try {
    scope.postMessage({ id, ok: true, result: extractRoute({ width, height, data }, options) });
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : "Tracing failed" });
  }
};
