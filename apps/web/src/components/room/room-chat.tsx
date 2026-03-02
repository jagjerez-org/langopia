"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDataChannel } from "@livekit/components-react";
import { Send } from "lucide-react";

interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: "teacher" | "student";
  message: string;
  createdAt: string;
}

interface RoomChatProps {
  roomId: string;
  role: "teacher" | "student";
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function RoomChat({ roomId, role }: RoomChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const onMessage = useCallback((msg: { payload: Uint8Array }) => {
    try {
      const data = JSON.parse(decoder.decode(msg.payload));
      if (data.type === "chat") {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch {}
  }, []);

  const { send } = useDataChannel("chat", onMessage);

  // Load existing messages
  useEffect(() => {
    fetch(`/api/v1/rooms/${roomId}/chat`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(() => {});
  }, [roomId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      senderName: "You",
      senderRole: role,
      message: input.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, msg]);

    // Broadcast via data channel
    const payload = encoder.encode(
      JSON.stringify({ type: "chat", message: msg })
    );
    send(payload, { reliable: true });

    // Persist to server
    fetch(`/api/room/${roomId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderName: msg.senderName,
        senderRole: role,
        message: msg.message,
      }),
    }).catch(() => {});

    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-zinc-600">No messages yet</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="group">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-xs font-semibold ${
                  msg.senderRole === "teacher"
                    ? "text-violet-400"
                    : "text-emerald-400"
                }`}
              >
                {msg.senderName}
              </span>
              <span className="text-[10px] text-zinc-600">
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm text-zinc-300">{msg.message}</p>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-zinc-800 p-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-lg bg-violet-600 p-2 text-white transition-colors hover:bg-violet-500 disabled:opacity-30"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
