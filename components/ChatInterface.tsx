"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Square, BookHeart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
  userId: string;
  /** Called when an AI response stream finishes (so live notes can refetch). */
  onChatFinish?: () => void;
}

export default function ChatInterface({ userId, onChatFinish }: ChatInterfaceProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lifeStoryMode, setLifeStoryMode] = useState(false);
  const [endSummary, setEndSummary] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const lifeStoryRef = useRef(lifeStoryMode);
  lifeStoryRef.current = lifeStoryMode;

  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, id }) => ({
        body: {
          messages,
          id,
          lifeStoryMode: lifeStoryRef.current,
        },
      }),
    })
  ).current;

  const {
    messages,
    sendMessage,
    status,
    setMessages,
    stop,
    error,
    clearError,
  } = useChat({
    id: sessionId ?? undefined,
    messages: [],
    transport,
  });

  // Check Anthropic API key on mount (shows clear message if 403)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/chat/check");
      if (cancelled) return;
      const data = await res.json().catch(() => ({}));
      if (data.ok === false && data.message) {
        setApiKeyError(data.message);
      } else {
        setApiKeyError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch or create session on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/session");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Clear end summary when we get a new session
  useEffect(() => {
    if (sessionId && endSummary) setEndSummary(null);
  }, [sessionId]);

  // Load messages when we have a session
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/messages?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(data.messages);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setMessages]);

  // Notify parent when AI stream finishes so live notes can refetch
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasLoading =
      prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    if (wasLoading && status === "ready" && onChatFinish) {
      onChatFinish();
    }
    prevStatusRef.current = status;
  }, [status, onChatFinish]);

  const [input, setInput] = useState("");
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || status !== "ready") return;
      sendMessage({ text });
      setInput("");
    },
    [input, sendMessage, status]
  );

  const handleEndChat = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch("/api/session/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (res.ok) {
      const data = await res.json();
      setEndSummary(data.summary ?? "Session ended.");
      setSessionId(null);
      setMessages([]);
      const next = await fetch("/api/session");
      if (next.ok) {
        const d = await next.json();
        setSessionId(d.sessionId);
      }
    }
  }, [sessionId, setMessages]);

  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="flex flex-col h-full">
      {apiKeyError && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-destructive/15 text-destructive text-sm border border-destructive/30">
          <strong>Anthropic API:</strong> {apiKeyError}
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <button
          type="button"
          onClick={() => setLifeStoryMode((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
            lifeStoryMode
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted"
          )}
          title="Life Story mode: deeper interview-style questions"
        >
          <BookHeart className="h-4 w-4" />
          Life Story
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleEndChat}
          disabled={!sessionId || isLoading}
        >
          <Square className="h-4 w-4 mr-1" />
          End chat
        </Button>
      </div>

      {endSummary && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-muted text-sm">
          {endSummary}
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-2xl">
          {messages.length === 0 && !isLoading && (
            <p className="text-muted-foreground text-sm">
              Say hello and tell the AI what kind of work you do or what you’re
              proud of. It’ll ask follow-ups and capture your experience.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                m.role === "user"
                  ? "bg-primary/10 text-foreground ml-8"
                  : "bg-muted/80 text-foreground mr-8"
              )}
            >
              {m.parts
                ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join("")}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking…
            </div>
          )}
        </div>
      </ScrollArea>

      {error && (
        <div className="px-4 py-2 text-sm text-destructive flex items-center justify-between">
          <span>{error.message}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
