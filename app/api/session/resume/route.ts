import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/session/resume
 * Body: { sessionId: string }
 * Sets the session back to active so the user can continue chatting.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = body.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "sessionId required" },
      { status: 400 }
    );
  }

  const { data: session, error: fetchErr } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status === "active") {
    return NextResponse.json({ ok: true, sessionId });
  }

  const { error: updateErr } = await supabase
    .from("sessions")
    .update({
      status: "active",
      end_time: null,
      summary: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("Resume session error:", updateErr);
    return NextResponse.json({ error: "Failed to resume session" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessionId });
}
