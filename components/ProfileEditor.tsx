"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Profile, WorkExperience, Project } from "@/types";

interface ProfileEditorProps {
  userId: string;
  initialProfile: Profile | null;
  initialWork: WorkExperience[];
  initialProjects: Project[];
}

export default function ProfileEditor({
  userId,
  initialProfile,
  initialWork,
  initialProjects,
}: ProfileEditorProps) {
  const [profile, setProfile] = useState({
    bio: initialProfile?.bio ?? "",
    current_job_role: initialProfile?.current_job_role ?? "",
    career_summary: initialProfile?.career_summary ?? "",
    skills: (initialProfile?.skills ?? []).join(", "),
  });
  const [work, setWork] = useState(initialWork);
  const [projects, setProjects] = useState(initialProjects);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  const saveProfile = async () => {
    setSaving(true);
    setSaved(false);
    const skills = profile.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await supabase.from("profiles").update({
      bio: profile.bio || null,
      current_job_role: profile.current_job_role || null,
      career_summary: profile.career_summary || null,
      skills,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasCaptured =
    (initialProfile && (initialProfile.bio || initialProfile.current_job_role || initialProfile.career_summary || (initialProfile.skills?.length ?? 0) > 0)) ||
    initialWork.length > 0 ||
    initialProjects.length > 0;

  return (
    <div className="space-y-8">
      {hasCaptured && (
        <Card className="bg-muted/30 border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Captured from chat</CardTitle>
            <CardDescription>
              What the AI has saved from your conversations. You can edit details in the sections below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {initialProfile && (initialProfile.bio || initialProfile.current_job_role || initialProfile.career_summary) && (
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">About</h3>
                {initialProfile.current_job_role && (
                  <p className="text-sm mb-1">
                    <strong>Current role:</strong> {initialProfile.current_job_role}
                  </p>
                )}
                {initialProfile.bio && <p className="text-sm mb-1">{initialProfile.bio}</p>}
                {initialProfile.career_summary && (
                  <p className="text-sm text-muted-foreground">{initialProfile.career_summary}</p>
                )}
              </section>
            )}
            {initialProfile && (initialProfile.skills?.length ?? 0) > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">Skills</h3>
                <p className="text-sm text-muted-foreground">
                  {(initialProfile.skills ?? []).join(", ")}
                </p>
              </section>
            )}
            {initialWork.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">Work experience</h3>
                <div className="space-y-4">
                  {initialWork.map((w) => (
                    <div key={w.id} className="text-sm rounded-md border bg-background/50 p-3">
                      <p className="font-medium text-foreground">
                        {w.role} at {w.company}
                      </p>
                      {(w.start_date || w.end_date) && (
                        <p className="text-muted-foreground text-xs mt-1">
                          {w.start_date ?? "?"} – {w.end_date ?? "Present"}
                        </p>
                      )}
                      {w.responsibilities?.length > 0 && (
                        <ul className="list-disc pl-4 mt-2">
                          {w.responsibilities.map((r, i) => (
                            <li key={i} className="text-muted-foreground">{r}</li>
                          ))}
                        </ul>
                      )}
                      {w.achievements?.length > 0 && (
                        <ul className="list-disc pl-4 mt-1">
                          {w.achievements.map((a, i) => (
                            <li key={i} className="text-muted-foreground">{a}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            {initialProjects.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">Projects</h3>
                <div className="space-y-3">
                  {initialProjects.map((p) => (
                    <div key={p.id} className="text-sm">
                      <p className="font-medium text-foreground">{p.title}</p>
                      {p.description && (
                        <p className="text-muted-foreground text-sm">{p.description}</p>
                      )}
                      {p.impact && <p className="text-sm">{p.impact}</p>}
                      {p.technologies?.length > 0 && (
                        <p className="text-xs text-muted-foreground">{p.technologies.join(", ")}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Bio, current role, and skills. You can edit here or add via chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="current_job_role">Current role</Label>
            <Input
              id="current_job_role"
              value={profile.current_job_role}
              onChange={(e) =>
                setProfile((p) => ({ ...p, current_job_role: e.target.value }))
              }
              placeholder="e.g. Product Designer"
            />
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={profile.bio}
              onChange={(e) =>
                setProfile((p) => ({ ...p, bio: e.target.value }))
              }
              placeholder="Short bio"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="career_summary">Career summary</Label>
            <Textarea
              id="career_summary"
              value={profile.career_summary}
              onChange={(e) =>
                setProfile((p) => ({ ...p, career_summary: e.target.value }))
              }
              placeholder="A few sentences about your career"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="skills">Skills (comma-separated)</Label>
            <Input
              id="skills"
              value={profile.skills}
              onChange={(e) =>
                setProfile((p) => ({ ...p, skills: e.target.value }))
              }
              placeholder="Design, Research, Figma, …"
            />
          </div>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved" : "Save profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work experience</CardTitle>
          <CardDescription>
            Captured from chat. Add or edit entries here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {work.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No work experience yet. Talk about your jobs in the chat to capture
              them here.
            </p>
          ) : (
            <ul className="space-y-4">
              {work.map((w) => (
                <li
                  key={w.id}
                  className="rounded-lg border p-4 text-sm"
                >
                  <p className="font-medium">
                    {w.role} at {w.company}
                  </p>
                  {(w.start_date || w.end_date) && (
                    <p className="text-muted-foreground text-xs mt-1">
                      {w.start_date ?? "?"} – {w.end_date ?? "Present"}
                    </p>
                  )}
                  {w.responsibilities?.length > 0 && (
                    <ul className="list-disc pl-4 mt-2">
                      {w.responsibilities.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {w.achievements?.length > 0 && (
                    <ul className="list-disc pl-4 mt-1">
                      {w.achievements.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>
            Captured from chat. Add or edit here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No projects yet. Mention projects in the chat to capture them.
            </p>
          ) : (
            <ul className="space-y-4">
              {projects.map((p) => (
                <li key={p.id} className="rounded-lg border p-4 text-sm">
                  <p className="font-medium">{p.title}</p>
                  {p.description && (
                    <p className="text-muted-foreground mt-1">{p.description}</p>
                  )}
                  {p.impact && <p className="mt-1">{p.impact}</p>}
                  {p.technologies?.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.technologies.join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
