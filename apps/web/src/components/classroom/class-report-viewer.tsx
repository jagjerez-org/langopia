"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface VocabularyItem {
  word: string;
  cefrLevel: string;
  context: string;
  isNew: boolean;
}

interface GrammarError {
  text: string;
  correction: string;
  rule: string;
  explanation: string;
}

interface SpeakingMetrics {
  studentSpeakingTime: number;
  teacherSpeakingTime: number;
  totalDuration: number;
  speakingRatio: number;
  fillerWordCount: number;
  averagePauseLength: number;
}

interface ClassReportData {
  id: string;
  summary: string;
  vocabulary: VocabularyItem[];
  grammarErrors: GrammarError[];
  speakingMetrics: SpeakingMetrics;
  suggestions: string[];
}

const cefrColors: Record<string, string> = {
  A1: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  A2: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  B1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  B2: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  C1: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  C2: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export function ClassReportViewer({ sessionId }: { sessionId: string }) {
  const [report, setReport] = useState<ClassReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/report`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setReport(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/report`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        setNotFound(false);
      }
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading report...</p>;
  }

  if (notFound && !report) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          No report generated yet for this session.
        </p>
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "Generate Report"}
        </Button>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div>
        <h4 className="mb-1 text-sm font-medium">Summary</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {report.summary}
        </p>
      </div>

      {/* Speaking Metrics */}
      <div>
        <h4 className="mb-2 text-sm font-medium">Speaking Metrics</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold">
                {Math.round(report.speakingMetrics.speakingRatio * 100)}%
              </p>
              <p className="text-xs text-muted-foreground">Student Talk Ratio</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold">
                {formatTime(report.speakingMetrics.studentSpeakingTime)}
              </p>
              <p className="text-xs text-muted-foreground">Student Speaking</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold">
                {report.speakingMetrics.fillerWordCount}
              </p>
              <p className="text-xs text-muted-foreground">Filler Words</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Vocabulary */}
      {report.vocabulary.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">
            Vocabulary ({report.vocabulary.length} items)
          </h4>
          <div className="space-y-2">
            {report.vocabulary.map((v, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border p-2"
              >
                <Badge
                  variant="outline"
                  className={cefrColors[v.cefrLevel] ?? ""}
                >
                  {v.cefrLevel}
                </Badge>
                <div>
                  <p className="text-sm font-medium">{v.word}</p>
                  {v.context && (
                    <p className="text-xs text-muted-foreground italic">
                      &ldquo;{v.context}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grammar Errors */}
      {report.grammarErrors.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">
            Grammar Notes ({report.grammarErrors.length})
          </h4>
          <div className="space-y-2">
            {report.grammarErrors.map((g, i) => (
              <Card key={i}>
                <CardContent className="space-y-1 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm line-through text-red-500">
                      {g.text}
                    </span>
                    <span className="text-sm text-green-600">{g.correction}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{g.rule}:</span>{" "}
                    {g.explanation}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {report.suggestions.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Suggestions</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {report.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0">&bull;</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
