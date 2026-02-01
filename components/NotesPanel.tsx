"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Profile, WorkExperience, Project } from "@/types";

interface NotesPanelProps {
  userId: string;
  /** When this value changes, notes are refetched (e.g. after chat stream finishes). */
  refetchTrigger?: number;
}

export default function NotesPanel({ userId, refetchTrigger }: NotesPanelProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [work, setWork] = useState<WorkExperience[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const supabase = createClient();
    const [profileRes, workRes, projectsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase.from("work_experience").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("projects").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    setProfile(profileRes.data ?? null);
    setWork(workRes.data ?? []);
    setProjects(projectsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  // Refetch when parent signals (e.g. chat stream finished and wrote to DB)
  useEffect(() => {
    if (refetchTrigger != null && refetchTrigger > 0) fetchData();
  }, [refetchTrigger]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notes-panel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_experience", filter: `user_id=eq.${userId}` },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects", filter: `user_id=eq.${userId}` },
        () => fetchData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        Loading notes…
      </div>
    );
  }

  const hasAny =
    (profile && (profile.bio || profile.current_job_role || profile.career_summary || (profile.skills?.length ?? 0) > 0)) ||
    work.length > 0 ||
    projects.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-sm text-foreground">Live notes</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Updates as you chat
        </p>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
          {!hasAny && (
            <p className="text-muted-foreground text-sm">
              Nothing captured yet. Start the conversation and the AI will
              organize what you share here.
            </p>
          )}
          {profile && (profile.bio || profile.current_job_role || profile.career_summary) && (
            <section className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">About</h3>
              {profile.current_job_role && (
                <p className="text-sm mb-1">
                  <strong>Current role:</strong> {profile.current_job_role}
                </p>
              )}
              {profile.bio && (
                <p className="text-sm mb-1">{profile.bio}</p>
              )}
              {profile.career_summary && (
                <p className="text-sm">{profile.career_summary}</p>
              )}
            </section>
          )}
          {profile && (profile.skills?.length ?? 0) > 0 && (
            <section className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">Skills</h3>
              <p className="text-sm">
                {(profile.skills ?? []).join(", ")}
              </p>
            </section>
          )}
          {work.length > 0 && (
            <section className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">Work experience</h3>
              <div className="space-y-4">
                {work.map((w) => (
                  <div key={w.id} className="text-sm">
                    <p className="font-medium text-foreground">
                      {w.role} at {w.company}
                    </p>
                    {(w.start_date || w.end_date) && (
                      <p className="text-muted-foreground text-xs mb-1">
                        {w.start_date ?? "?"} – {w.end_date ?? "Present"}
                      </p>
                    )}
                    {w.responsibilities?.length > 0 && (
                      <ul className="list-disc pl-4 mb-1">
                        {w.responsibilities.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                    {w.achievements?.length > 0 && (
                      <ul className="list-disc pl-4">
                        {w.achievements.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {projects.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">Projects</h3>
              <div className="space-y-4">
                {projects.map((p) => (
                  <div key={p.id} className="text-sm">
                    <p className="font-medium text-foreground">{p.title}</p>
                    {p.description && (
                      <p className="text-muted-foreground mb-1">{p.description}</p>
                    )}
                    {p.impact && (
                      <p className="mb-1">{p.impact}</p>
                    )}
                    {p.technologies?.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {p.technologies.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
