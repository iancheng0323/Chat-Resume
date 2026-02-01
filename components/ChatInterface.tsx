"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Square, BookHeart, MessageSquarePlus, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionItem {
  id: string;
  start_time: string;
  end_time: string | null;
  summary: string | null;
  status: "active" | "ended";
  life_story_mode: boolean;
}

interface ChatInterfaceProps {
  userId: string;
  /** Called when an AI response stream finishes (so live notes can refetch). */
  onChatFinish?: () => void;
}

export default function ChatInterface({ userId, onChatFinish }: ChatInterfaceProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [lifeStoryMode, setLifeStoryMode] = useState(false);
  const [endSummary, setEndSummary] = useState<string | null>(null);
  const [endChatLoading, setEndChatLoading] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  // Fetch sessions list (for sidebar); refetch when session changes (e.g. after end chat)
  useEffect(() => {
    let cancelled = false;
    setSessionsLoading(true);
    (async () => {
      const res = await fetch("/api/sessions");
      if (cancelled) return;
      setSessionsLoading(false);
      if (!res.ok) return;
      const data = await res.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Load chat history when we have a session
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setMessages([]);
    setHistoryLoading(true);
    (async () => {
      const res = await fetch(`/api/messages?sessionId=${encodeURIComponent(sessionId)}`);
      if (cancelled) return;
      setHistoryLoading(false);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.messages) ? data.messages : [];
      setMessages(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setMessages]);

  // Scroll to bottom when messages change so latest is visible
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      setEndSummary(null); // clear session summary when user starts typing again
      sendMessage({ text });
      setInput("");
    },
    [input, sendMessage, status]
  );

  const handleEndChat = useCallback(async () => {
    if (!sessionId) return;
    setEndChatLoading(true);
    try {
      const res = await fetch("/api/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setEndSummary(data.summary ?? "Session ended.");
        setMessages([]);
        const next = await fetch("/api/session");
        if (next.ok) {
          const d = await next.json();
          setSessionId(d.sessionId);
        }
      }
    } finally {
      setEndChatLoading(false);
    }
  }, [sessionId, setMessages]);

  const handleSelectSession = useCallback(async (s: SessionItem) => {
    if (s.id === sessionId) {
      setSessionsOpen(false);
      return;
    }
    if (s.status === "ended") {
      const res = await fetch("/api/session/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: s.id }),
      });
      if (!res.ok) return;
    }
    setSessionId(s.id);
    setEndSummary(null);
    setSessionsOpen(false);
  }, [sessionId]);

  const handleNewChat = useCallback(async () => {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.sessionId) {
      setSessionId(data.sessionId);
      setMessages([]);
      setEndSummary(null);
      setSessionsOpen(false);
    }
  }, [setMessages]);

  const isLoading = status === "streaming" || status === "submitted";
  const endChatDisabled = !sessionId || isLoading || endChatLoading;

  function sessionLabel(s: SessionItem): string {
    const date = s.start_time ? new Date(s.start_time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
    if (s.summary?.trim()) {
      const line = s.summary.trim().split(/\n/)[0] ?? "";
      const first = line.slice(0, 40) + (line.length > 40 ? "…" : "");
      return first || date;
    }
    return date || "Chat";
  }

  return (
    <div className="flex h-full min-w-0">
      {/* Toggle sessions panel */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setSessionsOpen((v) => !v)}
        className="shrink-0 rounded-r-none border-r border-border h-9 px-2"
        title={sessionsOpen ? "Hide sessions" : "Show sessions"}
      >
        {sessionsOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>

      {/* Sessions sidebar */}
      <div
        className={cn(
          "flex flex-col border-r bg-muted/30 shrink-0 transition-[width] overflow-hidden",
          sessionsOpen ? "w-56" : "w-0"
        )}
      >
        <div className="p-2 flex flex-col gap-1 shrink-0">
          <span className="text-sm font-medium text-foreground px-2">Sessions</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            className="text-xs justify-start"
          >
            <MessageSquarePlus className="h-4 w-4 mr-1 shrink-0" />
            New chat
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-0.5">
            {sessionsLoading && (
              <p className="text-muted-foreground text-xs px-2 py-2 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </p>
            )}
            {!sessionsLoading && sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSession(s)}
                className={cn(
                  "w-full text-left rounded-md px-2 py-2 text-xs transition-colors",
                  s.id === sessionId
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className="block truncate">{sessionLabel(s)}</span>
                <span className={cn(
                  "text-[10px] mt-0.5 block",
                  s.status === "active" ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                )}>
                  {s.status === "active" ? "Active" : "Ended"}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat */}
      <div className="flex flex-col flex-1 min-w-0">
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
          disabled={endChatDisabled}
        >
          {endChatLoading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin shrink-0" />
          ) : (
            <Square className="h-4 w-4 mr-1" />
          )}
          {endChatLoading ? "Ending…" : "End chat"}
        </Button>
      </div>

      {endSummary && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-muted text-sm">
          {endSummary}
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-2xl">
          {historyLoading && (
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Loading conversation…
            </p>
          )}
          {!historyLoading && messages.length === 0 && !isLoading && (
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
          <div ref={messagesEndRef} />
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
          placeholder="e.g. I'm a software engineer at Acme, or tell me what you're proud of…"
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
    </div>
  );
}
