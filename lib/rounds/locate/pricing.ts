// What a Locate call cost, from the token counts the API returns. Prices in
// US dollars per million tokens (Anthropic's list prices); a model not listed
// here is costed at the dearest listed price, so the total is never
// understated. When a request falls back to another model, each attempt is
// costed at its own model's price. Pure.

export const LOCATE_MODEL = "claude-opus-5-5";

export const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
};
const DEAREST = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

export type TokenCounts = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };
export type Attempt = TokenCounts & { type: string; model?: string | null };

const costOfCounts = (t: TokenCounts, model: string) => {
  const p = PRICES[model] ?? DEAREST;
  return (t.input_tokens * p.input + t.output_tokens * p.output + (t.cache_read_input_tokens ?? 0) * p.cacheRead + (t.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1e6;
};

// `usage` as the API returns it; `iterations` lists each attempt when a
// fallback ran (the first at the requested model).
export function costUsd(usage: TokenCounts & { iterations?: Attempt[] | null }, requested: string = LOCATE_MODEL): number {
  const attempts = (usage.iterations ?? []).filter((a) => a.type === "message" || a.type === "fallback_message");
  const total = attempts.length ? attempts.reduce((sum, a) => sum + costOfCounts(a, a.type === "fallback_message" ? (a.model ?? "") : requested), 0) : costOfCounts(usage, requested);
  return Math.round(total * 1e6) / 1e6;
}

export function tokensOf(usage: TokenCounts & { iterations?: Attempt[] | null }): { input: number; output: number } {
  const attempts = (usage.iterations ?? []).filter((a) => a.type === "message" || a.type === "fallback_message");
  if (!attempts.length) return { input: usage.input_tokens, output: usage.output_tokens };
  return attempts.reduce((t, a) => ({ input: t.input + a.input_tokens, output: t.output + a.output_tokens }), { input: 0, output: 0 });
}
