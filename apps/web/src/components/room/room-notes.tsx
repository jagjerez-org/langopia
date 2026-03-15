"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDataChannel } from "@livekit/components-react";
import { Plus, Trash2, BookOpen, PenLine, CheckCircle, Target } from "lucide-react";
import { createPublicClient } from "@/hooks/use-api-client";

interface VocabularyItem {
  word: string;
  definition: string;
  example: string;
}

interface CorrectionItem {
  error: string;
  correction: string;
  context: string;
}

interface NotesData {
  vocabulary: VocabularyItem[];
  corrections: CorrectionItem[];
  homework: string;
  objectives: string;
}

interface RoomNotesProps {
  roomId: string;
  isTeacher: boolean;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function RoomNotes({ roomId, isTeacher }: RoomNotesProps) {
  const api = useMemo(() => createPublicClient(), []);
  const [notes, setNotes] = useState<NotesData>({
    vocabulary: [],
    corrections: [],
    homework: "",
    objectives: "",
  });
  const [activeTab, setActiveTab] = useState<
    "vocabulary" | "corrections" | "homework" | "objectives"
  >("vocabulary");

  const onMessage = useCallback((msg: { payload: Uint8Array }) => {
    try {
      const data = JSON.parse(decoder.decode(msg.payload));
      if (data.type === "notes-sync") {
        setNotes(data.notes);
      }
    } catch {}
  }, []);

  const { send } = useDataChannel("notes", onMessage);

  // Load existing notes
  useEffect(() => {
    api.rooms
      .getNotes(roomId)
      .then((data) => {
        if (data) {
          setNotes({
            vocabulary: data.vocabulary ?? [],
            corrections: data.corrections ?? [],
            homework: data.homework ?? "",
            objectives: data.objectives ?? "",
          });
        }
      })
      .catch(() => {});
  }, [roomId, api]);

  function broadcastAndSave(updated: NotesData) {
    setNotes(updated);
    const payload = encoder.encode(
      JSON.stringify({ type: "notes-sync", notes: updated })
    );
    send(payload, { reliable: true });

    // Persist
    api.roomInternal.saveNotes(roomId, updated).catch(() => {});
  }

  function addVocabulary() {
    const updated = {
      ...notes,
      vocabulary: [
        ...notes.vocabulary,
        { word: "", definition: "", example: "" },
      ],
    };
    broadcastAndSave(updated);
  }

  function addCorrection() {
    const updated = {
      ...notes,
      corrections: [
        ...notes.corrections,
        { error: "", correction: "", context: "" },
      ],
    };
    broadcastAndSave(updated);
  }

  const tabs = [
    { key: "vocabulary" as const, label: "Vocab", icon: BookOpen },
    { key: "corrections" as const, label: "Corrections", icon: PenLine },
    { key: "homework" as const, label: "Homework", icon: CheckCircle },
    { key: "objectives" as const, label: "Objectives", icon: Target },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-violet-500 text-violet-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "vocabulary" && (
          <div className="space-y-2">
            {notes.vocabulary.map((item, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-2"
              >
                {isTeacher ? (
                  <>
                    <input
                      value={item.word}
                      onChange={(e) => {
                        const updated = { ...notes };
                        updated.vocabulary[i] = {
                          ...item,
                          word: e.target.value,
                        };
                        broadcastAndSave(updated);
                      }}
                      placeholder="Word"
                      className="mb-1 w-full bg-transparent text-sm font-semibold text-white placeholder:text-zinc-600 focus:outline-none"
                    />
                    <input
                      value={item.definition}
                      onChange={(e) => {
                        const updated = { ...notes };
                        updated.vocabulary[i] = {
                          ...item,
                          definition: e.target.value,
                        };
                        broadcastAndSave(updated);
                      }}
                      placeholder="Definition"
                      className="w-full bg-transparent text-xs text-zinc-400 placeholder:text-zinc-600 focus:outline-none"
                    />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-white">
                      {item.word || "..."}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {item.definition || "..."}
                    </p>
                  </>
                )}
              </div>
            ))}
            {isTeacher && (
              <button
                onClick={addVocabulary}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-2 text-xs text-zinc-500 hover:border-violet-500 hover:text-violet-400"
              >
                <Plus className="h-3 w-3" /> Add word
              </button>
            )}
          </div>
        )}

        {activeTab === "corrections" && (
          <div className="space-y-2">
            {notes.corrections.map((item, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-2"
              >
                {isTeacher ? (
                  <>
                    <input
                      value={item.error}
                      onChange={(e) => {
                        const updated = { ...notes };
                        updated.corrections[i] = {
                          ...item,
                          error: e.target.value,
                        };
                        broadcastAndSave(updated);
                      }}
                      placeholder="Error"
                      className="mb-1 w-full bg-transparent text-sm text-red-400 placeholder:text-zinc-600 focus:outline-none"
                    />
                    <input
                      value={item.correction}
                      onChange={(e) => {
                        const updated = { ...notes };
                        updated.corrections[i] = {
                          ...item,
                          correction: e.target.value,
                        };
                        broadcastAndSave(updated);
                      }}
                      placeholder="Correction"
                      className="w-full bg-transparent text-sm text-emerald-400 placeholder:text-zinc-600 focus:outline-none"
                    />
                  </>
                ) : (
                  <>
                    <p className="text-sm text-red-400 line-through">
                      {item.error || "..."}
                    </p>
                    <p className="text-sm text-emerald-400">
                      {item.correction || "..."}
                    </p>
                  </>
                )}
              </div>
            ))}
            {isTeacher && (
              <button
                onClick={addCorrection}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-700 py-2 text-xs text-zinc-500 hover:border-violet-500 hover:text-violet-400"
              >
                <Plus className="h-3 w-3" /> Add correction
              </button>
            )}
          </div>
        )}

        {activeTab === "homework" && (
          <div>
            {isTeacher ? (
              <textarea
                value={notes.homework}
                onChange={(e) =>
                  broadcastAndSave({ ...notes, homework: e.target.value })
                }
                placeholder="Write homework instructions..."
                className="min-h-[200px] w-full resize-none bg-transparent text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
              />
            ) : (
              <div className="whitespace-pre-wrap text-sm text-zinc-300">
                {notes.homework || "No homework assigned yet."}
              </div>
            )}
          </div>
        )}

        {activeTab === "objectives" && (
          <div>
            {isTeacher ? (
              <textarea
                value={notes.objectives}
                onChange={(e) =>
                  broadcastAndSave({ ...notes, objectives: e.target.value })
                }
                placeholder="Write class objectives..."
                className="min-h-[200px] w-full resize-none bg-transparent text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
              />
            ) : (
              <div className="whitespace-pre-wrap text-sm text-zinc-300">
                {notes.objectives || "No objectives set yet."}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
