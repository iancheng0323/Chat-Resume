import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/llm-mode";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/** Deterministic mock summary when LLM_MODE=mock. */
const MOCK_SESSION_SUMMARY =
  "Session wrapped up (mock mode). We captured what you shared. Come back anytime to add more.";

/**
 * POST: End the current session and generate a summary (what was captured, what's missing).
 * Body: { sessionId: string }
 * When LLM_MODE=mock, returns a fixed summary without calling Anthropic.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await req.json().catch(() => ({}));
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId required" },
      { status: 400 }
    );
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session || session.status === "ended") {
    return NextResponse.json(
      { error: "Session not found or already ended" },
      { status: 404 }
    );
  }

  // Fetch current profile state to list what's "missing"
  const [profileRes, workRes, projectsRes] = await Promise.all([
    supabase.from("profiles").select("bio, current_job_role, career_summary, skills").eq("user_id", user.id).single(),
    supabase.from("work_experience").select("id").eq("user_id", user.id),
    supabase.from("projects").select("id").eq("user_id", user.id),
  ]);

  const hasProfile = profileRes.data && (profileRes.data.bio || profileRes.data.current_job_role || profileRes.data.career_summary || (profileRes.data.skills?.length ?? 0) > 0);
  const hasWork = (workRes.data?.length ?? 0) > 0;
  const hasProjects = (projectsRes.data?.length ?? 0) > 0;
  const missing: string[] = [];
  if (!hasProfile) missing.push("profile (bio, role, or skills)");
  if (!hasWork) missing.push("work experience");
  if (!hasProjects) missing.push("projects");

  let summary = MOCK_SESSION_SUMMARY;
  if (!isMockMode()) {
    const { data: messages } = await supabase
      .from("conversations")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const conversationText =
      messages
        ?.map((m) => `${m.role}: ${m.content}`)
        .join("\n\n") ?? "";

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemPrompt = `You are helping wrap up a resume-building chat session. Based on the conversation, write a short, friendly session summary (2-4 sentences) that:
1. Summarizes what was captured in this session (e.g. jobs, projects, skills mentioned).
2. Gently notes what's still missing if anything (e.g. "We didn't get to projects yet" or "Your profile summary is still light").
3. Encourages the user to come back and continue when they're ready.

Keep the tone warm and concise. Output only the summary text, no JSON.`;
    const userPrompt = `Conversation:\n${conversationText}\n\nCurrent gaps: ${missing.length ? missing.join("; ") : "None"}.\n\nWrite the session summary:`;

    const modelId =
      process.env.ANTHROPIC_CHAT_MODEL?.trim() || "claude-3-5-sonnet-20241022";
    try {
      const resp = await anthropic.messages.create({
        model: modelId,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const textBlock = resp.content.find((c) => c.type === "text");
      if (textBlock && "text" in textBlock) summary = textBlock.text;
    } catch (e) {
      console.error("Summary generation error:", e);
    }
  }

  const { error: updateErr } = await supabase
    .from("sessions")
    .update({
      status: "ended",
      end_time: new Date().toISOString(),
      summary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("Session end update error:", updateErr);
    return NextResponse.json(
      { error: "Failed to end session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ summary, missing });
}
