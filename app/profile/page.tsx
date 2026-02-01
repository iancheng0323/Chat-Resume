import { createClient } from "@/lib/supabase/server";
import ProfileEditor from "@/components/ProfileEditor";
import Link from "next/link";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, workRes, projectsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("work_experience").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-lg">Your profile</h1>
        <Link
          href="/chat"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to chat
        </Link>
      </header>
      <main className="max-w-2xl mx-auto p-6">
        <ProfileEditor
          userId={user.id}
          initialProfile={profileRes.data ?? null}
          initialWork={workRes.data ?? []}
          initialProjects={projectsRes.data ?? []}
        />
      </main>
    </div>
  );
}
