import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET: Get or create an active session for the current user.
 * Returns { sessionId, lifeStoryMode } for the active session.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find latest active session
  const { data: active } = await supabase
    .from("sessions")
    .select("id, life_story_mode")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active) {
    return NextResponse.json({
      sessionId: active.id,
      lifeStoryMode: active.life_story_mode ?? false,
    });
  }

  // Create new session
  const { data: newSession, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      status: "active",
      life_story_mode: false,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Session create error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sessionId: newSession.id,
    lifeStoryMode: false,
  });
}

/**
 * POST: Create a new session (e.g. when user clicks "New chat" or starts fresh).
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
  const lifeStoryMode = Boolean(body.lifeStoryMode);

  const { data: newSession, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      status: "active",
      life_story_mode: lifeStoryMode,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Session create error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sessionId: newSession.id,
    lifeStoryMode,
  });
}
