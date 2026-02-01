import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ExtractedWorkExperience,
  ExtractedProject,
  ExtractedProfile,
  ExtractedData,
} from "@/types";

/**
 * Upsert extracted data into Supabase. Called from chat API onFinish.
 */
export async function upsertExtracted(
  supabase: SupabaseClient,
  userId: string,
  extracted: ExtractedData
): Promise<void> {
  if (extracted.type === "profile") {
    const { bio, current_job_role, career_summary, skills } = extracted.data;
    const payload: Record<string, unknown> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    if (bio !== undefined) payload.bio = bio;
    if (current_job_role !== undefined) payload.current_job_role = current_job_role;
    if (career_summary !== undefined) payload.career_summary = career_summary;
    if (skills !== undefined && skills.length > 0) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("skills")
        .eq("user_id", userId)
        .maybeSingle();
      const existingSkills = (existing?.skills ?? []) as string[];
      const merged = [...new Set([...existingSkills, ...skills])];
      payload.skills = merged;
    }
    await supabase.from("profiles").upsert(payload, {
      onConflict: "user_id",
    });
    return;
  }

  if (extracted.type === "work_experience") {
    const { company, role, start_date, end_date, responsibilities, achievements } =
      extracted.data;
    await supabase.from("work_experience").insert({
      user_id: userId,
      company: company ?? "",
      role: role ?? "",
      start_date: start_date ?? null,
      end_date: end_date ?? null,
      responsibilities: responsibilities ?? [],
      achievements: achievements ?? [],
    });
    return;
  }

  if (extracted.type === "project") {
    const { title, description, impact, technologies } = extracted.data;
    await supabase.from("projects").insert({
      user_id: userId,
      title: title ?? "",
      description: description ?? null,
      impact: impact ?? null,
      technologies: technologies ?? [],
    });
  }
}
