import { createClient } from "@/lib/supabase/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  streamText,
  type UIMessage,
} from "ai";
import { getSystemPrompt } from "@/lib/chat-system-prompt";
import { extractAllResumeJsonFromText } from "@/lib/extract-data";
import { isMockMode } from "@/lib/llm-mode";
import { upsertExtracted } from "@/lib/upsert-extracted";

/** Deterministic mock reply when LLM_MODE=mock (no external API calls). */
const MOCK_CHAT_MESSAGE =
  "This is a mock response for local development. Your message was received. Set LLM_MODE=remote to use the real model.";

/**
 * POST /api/chat
 * Body: { messages: UIMessage[], id: sessionId, lifeStoryMode?: boolean }
 * Streams Claude response and on finish saves messages + extracts data to Supabase.
 * When LLM_MODE=mock, streams a deterministic mock response instead of calling Anthropic.
 */
export async function POST(req: Request) {
  const useMock = isMockMode();
  if (!useMock) {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return Response.json(
        {
          error:
            "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.",
        },
        { status: 503 }
      );
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    messages?: UIMessage[];
    id?: string;
    lifeStoryMode?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const messages = body.messages ?? [];
  const sessionId = body.id;
  const lifeStoryMode = Boolean(body.lifeStoryMode);

  if (!sessionId) {
    return new Response("Session id required", { status: 400 });
  }

  // Ensure session belongs to user and is active
  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id, life_story_mode")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  // Optional: update session life_story_mode
  await supabase
    .from("sessions")
    .update({ life_story_mode: lifeStoryMode, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  // Missing suggestions for system prompt
  const [profileRes, workRes, projectsRes] = await Promise.all([
    supabase.from("profiles").select("bio, current_job_role, career_summary, skills").eq("user_id", user.id).single(),
    supabase.from("work_experience").select("id").eq("user_id", user.id),
    supabase.from("projects").select("id").eq("user_id", user.id),
  ]);
  const missingSuggestions: string[] = [];
  const p = profileRes.data;
  if (!p?.bio && !p?.current_job_role && !p?.career_summary && (p?.skills?.length ?? 0) === 0) missingSuggestions.push("profile (bio, role, or skills)");
  if ((workRes.data?.length ?? 0) === 0) missingSuggestions.push("work experience");
  if ((projectsRes.data?.length ?? 0) === 0) missingSuggestions.push("projects");

  const systemPrompt = getSystemPrompt({
    lifeStoryMode,
    missingSuggestions,
  });

  async function persistChatFinish(text: string) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("session_id", sessionId);
    if (existing?.length) {
      await supabase.from("conversations").delete().eq("session_id", sessionId);
    }
    for (const msg of messages) {
      const content =
        msg.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("") ?? "";
      if (!content.trim()) continue;
      await supabase.from("conversations").insert({
        session_id: sessionId,
        role: msg.role,
        content,
      });
    }
    if (text?.trim()) {
      await supabase.from("conversations").insert({
        session_id: sessionId,
        role: "assistant",
        content: text,
      });
    }
    const extracted = extractAllResumeJsonFromText(text ?? "");
    for (const item of extracted) {
      try {
        await upsertExtracted(supabase, user.id, item);
      } catch (e) {
        console.error("Upsert extracted error:", e);
      }
    }
  }

  if (useMock) {
    const messageId = generateId();
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "text-start", id: messageId });
        writer.write({ type: "text-delta", id: messageId, delta: MOCK_CHAT_MESSAGE });
        writer.write({ type: "text-end", id: messageId });
      },
      originalMessages: messages,
      onFinish: async ({ messages: updated }) => {
        const last = updated[updated.length - 1];
        const text =
          last?.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("") ?? MOCK_CHAT_MESSAGE;
        await persistChatFinish(text);
      },
      generateId,
    });
    return createUIMessageStreamResponse({
      stream,
      headers: {},
    });
  }

  const modelMessages = await convertToModelMessages(messages);
  const apiKey = process.env.ANTHROPIC_API_KEY!.trim();
  const anthropic = createAnthropic({ apiKey });
  const modelId =
    process.env.ANTHROPIC_CHAT_MODEL?.trim() || "claude-3-5-sonnet-20241022";
  const result = streamText({
    model: anthropic(modelId),
    system: systemPrompt,
    messages: modelMessages,
    onFinish: async ({ text }) => {
      await persistChatFinish(text ?? "");
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
  });
}
