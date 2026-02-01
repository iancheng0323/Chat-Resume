"use client";

import { useState, useCallback } from "react";
import ChatInterface from "@/components/ChatInterface";
import NotesPanel from "@/components/NotesPanel";

interface ChatPageClientProps {
  userId: string;
}

export default function ChatPageClient({ userId }: ChatPageClientProps) {
  const [notesRefetchTrigger, setNotesRefetchTrigger] = useState(0);

  const handleChatFinish = useCallback(() => {
    // Refetch now (in case server was fast) and again after 2s so we catch the server's onFinish DB write
    setNotesRefetchTrigger((t) => t + 1);
    setTimeout(() => {
      setNotesRefetchTrigger((t) => t + 1);
    }, 2000);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b bg-card px-4 py-2 flex justify-between shrink-0 items-center">
        <h1 className="text-lg font-semibold">Resume Chat</h1>
        <a
          href="/profile"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Edit profile
        </a>
      </header>
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex flex-col border-r">
          <ChatInterface userId={userId} onChatFinish={handleChatFinish} />
        </div>
        <div className="w-[400px] shrink-0 flex flex-col bg-muted/30">
          <NotesPanel userId={userId} refetchTrigger={notesRefetchTrigger} />
        </div>
      </div>
    </div>
  );
}
