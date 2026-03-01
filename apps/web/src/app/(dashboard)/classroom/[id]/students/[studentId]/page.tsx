"use client";

import { useEffect, useState, use } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LearningProfileViewer } from "@/components/classroom/learning-profile-viewer";
import { useSession } from "next-auth/react";
import { UserRole } from "@langopia/shared/types";

interface ProgressReportData {
  id: string;
  periodStart: string;
  periodEnd: string;
  scores: Record<string, number>;
  teacherComments: string | null;
  createdAt: string;
}

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { id: classroomId, studentId } = use(params);
  const { data: authSession } = useSession();
  const [reports, setReports] = useState<ProgressReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const role = authSession?.user?.role as UserRole | undefined;
  const canGenerate = role === UserRole.TEACHER || role === UserRole.ADMIN;

  useEffect(() => {
    fetch(`/api/classrooms/${classroomId}/progress-reports?studentId=${studentId}`)
      .then((r) => r.json())
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [classroomId, studentId]);

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerating(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(
        `/api/classrooms/${classroomId}/progress-reports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            periodStart: form.get("periodStart"),
            periodEnd: form.get("periodEnd"),
          }),
        }
      );
      if (res.ok) {
        const created = await res.json();
        setReports((prev) => [created, ...prev]);
        setGenerateOpen(false);
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <a
          href={`/classroom/${classroomId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to classroom
        </a>
        <h1 className="mt-2 text-2xl font-bold">Student Profile</h1>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Learning Profile</TabsTrigger>
          <TabsTrigger value="progress">Progress Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Learning Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <LearningProfileViewer studentId={studentId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="mt-4 space-y-4">
          {canGenerate && (
            <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
              <DialogTrigger asChild>
                <Button>Generate Progress Report</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Progress Report</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleGenerate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="periodStart">Period Start</Label>
                    <Input
                      id="periodStart"
                      name="periodStart"
                      type="date"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="periodEnd">Period End</Label>
                    <Input
                      id="periodEnd"
                      name="periodEnd"
                      type="date"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={generating}>
                    {generating ? "Generating..." : "Generate"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading reports...</p>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No progress reports generated yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {new Date(report.periodStart).toLocaleDateString()} &ndash;{" "}
                      {new Date(report.periodEnd).toLocaleDateString()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Scores */}
                    {report.scores && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {Object.entries(report.scores).map(([key, value]) => (
                          <div key={key} className="text-center">
                            <p className="text-2xl font-bold">{value}</p>
                            <p className="text-xs capitalize text-muted-foreground">
                              {key}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Report text */}
                    {report.teacherComments && (
                      <div className="rounded-md bg-muted p-4">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {report.teacherComments}
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Generated {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
