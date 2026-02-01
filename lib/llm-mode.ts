/**
 * LLM behavior is controlled by LLM_MODE (env).
 * - remote: real API calls (e.g. Vercel API → Anthropic)
 * - mock: no external LLM; deterministic mock responses for local dev
 */

export type LLMMode = "remote" | "mock";

const MODE_VALUES: LLMMode[] = ["remote", "mock"];

export function getLLMMode(): LLMMode {
  const raw = process.env.LLM_MODE?.trim().toLowerCase();
  if (raw === "mock") return "mock";
  return "remote";
}

export function isMockMode(): boolean {
  return getLLMMode() === "mock";
}
