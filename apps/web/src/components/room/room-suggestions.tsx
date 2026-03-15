"use client";

import { BookOpen, MessageCircle, PenLine, Loader2, Lightbulb } from "lucide-react";
import type { ContentSuggestion } from "@/hooks/use-end-of-class-suggestions";

interface RoomSuggestionsProps {
  suggestions: ContentSuggestion[] | null;
  loading: boolean;
}

const typeConfig = {
  topic: { icon: BookOpen, color: "text-blue-400", bg: "bg-blue-500/10" },
  vocabulary: { icon: MessageCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  grammar: { icon: PenLine, color: "text-amber-400", bg: "bg-amber-500/10" },
};

export function RoomSuggestions({ suggestions, loading }: RoomSuggestionsProps) {
  if (!loading && !suggestions) return null;

  return (
    <div className="absolute bottom-16 right-4 z-50 w-80 rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <Lightbulb className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-semibold text-white">
          Content Suggestions
        </span>
      </div>

      <div className="max-h-64 overflow-y-auto p-3">
        {loading && !suggestions && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing session...
          </div>
        )}

        {suggestions && suggestions.length === 0 && (
          <p className="py-4 text-center text-sm text-zinc-500">
            No suggestions available
          </p>
        )}

        {suggestions?.map((s, i) => {
          const config = typeConfig[s.type] ?? typeConfig.topic;
          const Icon = config.icon;
          return (
            <div
              key={i}
              className="mb-2 rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 last:mb-0"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-md ${config.bg}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                </div>
                <span className="text-sm font-medium text-white">
                  {s.title}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">{s.description}</p>
              {s.keywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
