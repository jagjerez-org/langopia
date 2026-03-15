"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Send, Loader2, Bot, User, MessageSquare, Square } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface LessonInfo {
  title: string;
  description: string;
  language: string;
  cefrLevel: string;
  topic?: string;
  summary?: string;
}

interface PlanItem {
  type: string;
  count: number;
  reason: string;
}

interface ExerciseTypeRef {
  type: string;
  label: string;
  description: string;
}

interface LessonPlanChatProps {
  onSend: (message: string, signal?: AbortSignal) => Promise<string>;
  disabled?: boolean;
  materialText?: string;
  lessonInfo?: LessonInfo;
  planItems?: PlanItem[];
  exerciseTypes?: ExerciseTypeRef[];
}

interface ReferenceItem {
  key: string;
  label: string;
  value: string;
  prefix: "#" | "@";
}

export function LessonPlanChat({
  onSend,
  disabled,
  materialText,
  lessonInfo,
  planItems,
  exerciseTypes,
}: LessonPlanChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPrefix, setDropdownPrefix] = useState<"#" | "@">("#");
  const [dropdownFilter, setDropdownFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const triggerPosRef = useRef<number>(-1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Build # items from lessonInfo + plan items
  const hashItems = useMemo<ReferenceItem[]>(() => {
    const items: ReferenceItem[] = [];
    if (lessonInfo) {
      if (lessonInfo.title) items.push({ key: "title", label: "Title", value: lessonInfo.title, prefix: "#" });
      if (lessonInfo.description) items.push({ key: "description", label: "Description", value: lessonInfo.description, prefix: "#" });
      if (lessonInfo.language) items.push({ key: "language", label: "Language", value: lessonInfo.language, prefix: "#" });
      if (lessonInfo.cefrLevel) items.push({ key: "level", label: "CEFR Level", value: lessonInfo.cefrLevel, prefix: "#" });
      if (lessonInfo.topic) items.push({ key: "topic", label: "Topic", value: lessonInfo.topic, prefix: "#" });
      if (lessonInfo.summary) items.push({ key: "summary", label: "Summary", value: lessonInfo.summary, prefix: "#" });
    }
    if (planItems) {
      planItems.forEach((p, i) => {
        items.push({
          key: `plan-${i}`,
          label: `Plan: ${p.type.replace(/_/g, " ")} (×${p.count})`,
          value: `${p.type}: ${p.count}x - ${p.reason}`,
          prefix: "#",
        });
      });
    }
    return items;
  }, [lessonInfo, planItems]);

  // Build @ items from exercise types
  const atItems = useMemo<ReferenceItem[]>(() => {
    if (!exerciseTypes) return [];
    return exerciseTypes.map((et) => ({
      key: et.type,
      label: `${et.label} — ${et.description}`,
      value: `exercise type: ${et.label} (${et.type})`,
      prefix: "@" as const,
    }));
  }, [exerciseTypes]);

  const filteredItems = useMemo(() => {
    const items = dropdownPrefix === "#" ? hashItems : atItems;
    if (!dropdownFilter) return items;
    const lower = dropdownFilter.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(lower) || item.key.toLowerCase().includes(lower));
  }, [dropdownPrefix, dropdownFilter, hashItems, atItems]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInput(val);

    const cursorPos = e.target.selectionStart ?? val.length;

    // Find the last # or @ before cursor
    let triggerIdx = -1;
    let prefix: "#" | "@" = "#";
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (val[i] === " " || val[i] === "\n") break;
      if (val[i] === "#" || val[i] === "@") {
        triggerIdx = i;
        prefix = val[i] as "#" | "@";
        break;
      }
    }

    if (triggerIdx >= 0) {
      const filter = val.slice(triggerIdx + 1, cursorPos);
      const items = prefix === "#" ? hashItems : atItems;
      if (items.length > 0) {
        setDropdownPrefix(prefix);
        setDropdownFilter(filter);
        setShowDropdown(true);
        triggerPosRef.current = triggerIdx;
        return;
      }
    }

    setShowDropdown(false);
  }

  function handleSelectItem(item: ReferenceItem) {
    const triggerIdx = triggerPosRef.current;
    if (triggerIdx < 0) return;

    const cursorPos = inputRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, triggerIdx);
    const after = input.slice(cursorPos);
    const newInput = `${before}${item.prefix}${item.key} ${after}`;
    setInput(newInput);
    setShowDropdown(false);

    // Restore cursor position
    requestAnimationFrame(() => {
      const pos = before.length + item.prefix.length + item.key.length + 1;
      inputRef.current?.setSelectionRange(pos, pos);
      inputRef.current?.focus();
    });
  }

  // Serialize references in message before sending
  const serializeMessage = useCallback(
    (text: string): string => {
      let result = text;
      // Replace #key references
      for (const item of hashItems) {
        result = result.replace(
          new RegExp(`#${item.key}\\b`, "g"),
          `[#${item.key}: "${item.value}"]`,
        );
      }
      // Replace @key references
      for (const item of atItems) {
        result = result.replace(
          new RegExp(`@${item.key}\\b`, "g"),
          `[@${item.key}: ${item.value}]`,
        );
      }
      return result;
    },
    [hashItems, atItems],
  );

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setShowDropdown(false);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const serialized = serializeMessage(text);
      const response = await onSend(serialized, controller.signal);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) => [...prev, { role: "assistant", content: "(Stopped)" }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I couldn't process that. Please try again." },
        ]);
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-700/80 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
          <MessageSquare className="h-3 w-3 text-violet-600 dark:text-violet-400" />
        </div>
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Refine Exercises</span>
      </div>

      {/* Original prompt context */}
      {materialText && (
        <div className="border-b border-zinc-100 px-3.5 py-2 dark:border-zinc-800">
          <p className="line-clamp-3 text-[11px] italic leading-relaxed text-zinc-400">
            {materialText}
          </p>
        </div>
      )}

      {/* Message list */}
      <div
        ref={scrollRef}
        className="max-h-64 min-h-[100px] flex-1 space-y-2.5 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <Bot className="h-4 w-4 text-zinc-400" />
            </div>
            <p className="max-w-[200px] text-[11px] leading-relaxed text-zinc-400">
              Ask AI to adjust the exercises &mdash; e.g. &ldquo;Add more listening exercises&rdquo; or &ldquo;Make exercise 3 harder&rdquo;. Use <span className="font-mono font-semibold">#</span> to reference lesson info or <span className="font-mono font-semibold">@</span> to reference exercise types.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                <Bot className="h-3 w-3 text-violet-600 dark:text-violet-400" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-1.5 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                <User className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
              <Loader2 className="h-3 w-3 animate-spin text-violet-600" />
            </div>
            <span className="text-xs text-zinc-400">Thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="relative border-t border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
        {/* Reference dropdown */}
        {showDropdown && filteredItems.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            {filteredItems.map((item) => (
              <button
                key={`${item.prefix}${item.key}`}
                onClick={() => handleSelectItem(item)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-violet-50 dark:hover:bg-violet-900/20"
              >
                <span className="shrink-0 font-mono font-bold text-violet-500">{item.prefix}</span>
                <span className="truncate text-zinc-700 dark:text-zinc-300">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (showDropdown && e.key === "Escape") {
                e.preventDefault();
                setShowDropdown(false);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey && !showDropdown) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Refine exercises... (# info, @ types)"
            disabled={disabled || sending}
            className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-1.5 text-sm outline-none transition focus:border-violet-400 focus:bg-white disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:focus:border-violet-500 dark:focus:bg-zinc-800"
          />
          {sending ? (
            <button
              onClick={handleStop}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500 text-white shadow-sm transition hover:bg-red-400"
              title="Stop"
            >
              <Square className="h-3 w-3" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || disabled}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-40 disabled:shadow-none"
            >
              <Send className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
