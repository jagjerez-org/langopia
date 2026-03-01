"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VocabEntry {
  word: string;
  cefrLevel: string;
  context: string;
  learnedAt: string;
}

interface GrammarPattern {
  rule: string;
  example: string;
  correction: string;
  date: string;
}

interface ProfileData {
  id: string;
  studentId: string;
  vocabularyBank: VocabEntry[];
  grammarPatterns: GrammarPattern[];
  cefrLevelEstimate: string | null;
  student?: { name: string; email: string };
}

const cefrColors: Record<string, string> = {
  A1: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  A2: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  B1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  B2: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  C1: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  C2: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
};

export function LearningProfileViewer({ studentId }: { studentId: string }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/students/${studentId}/learning-profile`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data) setProfile(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading profile...</p>;
  }

  if (!profile) {
    return (
      <p className="text-sm text-muted-foreground">
        No learning profile yet. Complete a session with AI analysis to generate one.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* CEFR Level */}
      {profile.cefrLevelEstimate && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Estimated CEFR Level:</span>
          <Badge
            variant="outline"
            className={`text-base px-3 py-1 ${cefrColors[profile.cefrLevelEstimate] ?? ""}`}
          >
            {profile.cefrLevelEstimate}
          </Badge>
        </div>
      )}

      {/* Vocabulary Bank */}
      <div>
        <h4 className="mb-2 text-sm font-medium">
          Vocabulary Bank ({profile.vocabularyBank.length} words)
        </h4>
        {profile.vocabularyBank.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vocabulary recorded yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profile.vocabularyBank.slice(-50).map((v, i) => (
              <Badge
                key={i}
                variant="outline"
                className={cefrColors[v.cefrLevel] ?? ""}
                title={`${v.context} (learned ${new Date(v.learnedAt).toLocaleDateString()})`}
              >
                {v.word}
                <span className="ml-1 opacity-60">{v.cefrLevel}</span>
              </Badge>
            ))}
            {profile.vocabularyBank.length > 50 && (
              <span className="text-xs text-muted-foreground self-center">
                +{profile.vocabularyBank.length - 50} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Grammar Patterns */}
      <div>
        <h4 className="mb-2 text-sm font-medium">
          Grammar Patterns ({profile.grammarPatterns.length} entries)
        </h4>
        {profile.grammarPatterns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No grammar patterns recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {profile.grammarPatterns.slice(-20).map((g, i) => (
              <Card key={i}>
                <CardContent className="space-y-1 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm line-through text-red-500">
                      {g.example}
                    </span>
                    <span className="text-sm text-green-600">{g.correction}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {g.rule} &middot;{" "}
                    {new Date(g.date).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
