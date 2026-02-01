import { createAnthropic } from "@ai-sdk/anthropic";
import { APICallError, generateText } from "ai";

/**
 * GET /api/chat/check
 * Validates ANTHROPIC_API_KEY with a minimal request. Returns 200 with { ok, error? }.
 * Call from the client to show a clear message when the key returns 403.
 */
export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { ok: false, error: "NO_KEY", message: "ANTHROPIC_API_KEY is not set in .env.local" },
      { status: 200 }
    );
  }

  const modelId =
    process.env.ANTHROPIC_CHAT_MODEL?.trim() || "claude-3-5-sonnet-20241022";
  const anthropic = createAnthropic({ apiKey });

  try {
    await generateText({
      model: anthropic(modelId),
      maxOutputTokens: 1,
      prompt: "Hi",
    });
    return Response.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    if (APICallError.isInstance(e)) {
      if (e.statusCode === 403) {
        return Response.json(
          {
            ok: false,
            error: "FORBIDDEN",
            message:
              "Your API key doesn't have permission. Use a key from https://console.anthropic.com → API Keys (same account that has API access).",
          },
          { status: 200 }
        );
      }
      if (e.statusCode === 401) {
        return Response.json(
          {
            ok: false,
            error: "INVALID_KEY",
            message:
              "Invalid API key. Check ANTHROPIC_API_KEY in .env.local and create a new key at console.anthropic.com",
          },
          { status: 200 }
        );
      }
    }
    return Response.json(
      {
        ok: false,
        error: "UNKNOWN",
        message: e instanceof Error ? e.message : "Anthropic API error",
      },
      { status: 200 }
    );
  }
}
