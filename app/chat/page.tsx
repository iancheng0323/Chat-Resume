import { createClient } from "@/lib/supabase/server";
import ChatInterface from "@/components/ChatInterface";
import NotesPanel from "@/components/NotesPanel";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b bg-card px-4 py-2 flex items-center justify-between shrink-0">
        <h1 className="font-semibold text-lg">Resume Chat</h1>
        <a
          href="/profile"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Edit profile
        </a>
      </header>
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex flex-col border-r">
          <ChatInterface userId={user.id} />
        </div>
        <div className="w-[400px] shrink-0 flex flex-col bg-muted/30">
          <NotesPanel userId={user.id} />
        </div>
      </div>
    </div>
  );
}
