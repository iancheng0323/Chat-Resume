import { createClient } from "@/lib/supabase/server";
import ChatPageClient from "@/components/ChatPageClient";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return <ChatPageClient userId={user.id} />;
}
