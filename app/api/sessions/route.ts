import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export interface SessionListItem {
  id: string;
  start_time: string;
  end_time: string | null;
  summary: string | null;
  status: "active" | "ended";
  life_story_mode: boolean;
}

/**
 * GET /api/sessions
 * Returns the current user's sessions (active and ended), newest first.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("sessions")
    .select("id, start_time, end_time, summary, status, life_story_mode")
    .eq("user_id", user.id)
    .order("start_time", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Sessions list error:", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }

  const sessions: SessionListItem[] = (rows ?? []).map((s) => ({
    id: s.id,
    start_time: s.start_time,
    end_time: s.end_time ?? null,
    summary: s.summary ?? null,
    status: s.status as "active" | "ended",
    life_story_mode: s.life_story_mode ?? false,
  }));

  return NextResponse.json({ sessions });
}
