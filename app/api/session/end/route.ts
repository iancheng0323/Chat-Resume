import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/llm-mode";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/** Deterministic mock summary when LLM_MODE=mock. */
const MOCK_SESSION_SUMMARY = `Session summary
- Session wrapped up (mock mode). We captured what you shared.

What's still missing
- Set LLM_MODE=remote to get a detailed summary.

Next time we could chat about
- Come back anytime to add more to your story.`;

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
    const systemPrompt = `You are wrapping up a resume-building / autobiography interview session. Based on the conversation, write a detailed session wrap-up in plain text using this exact structure. Use bullet points (lines starting with "- ") for all lists. No JSON or markdown code blocks.

Structure your response exactly like this:

Session summary
- [Bullet 1: what was captured in this session — be specific: jobs, roles, companies, projects, skills, dates, or themes discussed]
- [Bullet 2: another concrete thing captured]
- [Add as many bullets as needed to cover the session in detail]

What's still missing
- [Bullet 1: what we didn't cover or what's still light — e.g. "No projects added yet", "Career summary could be expanded", "Skills list is thin"]
- [Add more if relevant; if nothing is missing, say "Nothing critical — we covered a lot!"]

Next time we could chat about
- [Bullet 1: concrete topic or question to pick up next — e.g. "Dive into the Acme project impact", "Add dates for your role at X", "Your career pivot story"]
- [Bullet 2: another suggestion]
- [Add 2–4 suggestions so they have clear options for the next session]

Keep the tone warm and helpful. Be specific: reference actual companies, roles, or topics from the conversation where relevant.`;
    const userPrompt = `Conversation:\n${conversationText}\n\nCurrent profile gaps (for "What's still missing"): ${missing.length ? missing.join("; ") : "None"}.\n\nWrite the detailed session wrap-up using the structure above:`;

    const modelId =
      process.env.ANTHROPIC_CHAT_MODEL?.trim() || "claude-3-5-sonnet-20241022";
    try {
      const resp = await anthropic.messages.create({
        model: modelId,
        max_tokens: 1200,
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
