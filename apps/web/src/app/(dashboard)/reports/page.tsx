"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserRole, SessionStatus } from "@langopia/shared/types";
import { Eye } from "lucide-react";

interface ClassroomData {
  id: string;
  name: string;
  languageTarget: string;
}

interface SessionData {
  id: string;
  classroomId: string;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  status: SessionStatus;
}

interface ReportEntry {
  session: SessionData;
  classroom: ClassroomData;
  hasReport: boolean;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const role = session?.user?.role as UserRole | undefined;

  useEffect(() => {
    if (!session?.user) return;

    async function loadReports() {
      try {
        // Fetch classrooms
        const classroomsRes = await fetch("/api/classrooms");
        if (!classroomsRes.ok) return;
        const classrooms: ClassroomData[] = await classroomsRes.json();

        // Fetch sessions for each classroom
        const allEntries: ReportEntry[] = [];
        for (const classroom of classrooms) {
          const sessionsRes = await fetch(
            `/api/classrooms/${classroom.id}/sessions`
          );
          if (!sessionsRes.ok) continue;
          const sessions: SessionData[] = await sessionsRes.json();

          for (const s of sessions) {
            if (s.status !== SessionStatus.COMPLETED) continue;

            // Check if report exists
            const reportRes = await fetch(`/api/sessions/${s.id}/report`);
            allEntries.push({
              session: s,
              classroom,
              hasReport: reportRes.ok,
            });
          }
        }

        allEntries.sort(
          (a, b) =>
            new Date(b.session.startedAt ?? b.session.scheduledAt).getTime() -
            new Date(a.session.startedAt ?? a.session.scheduledAt).getTime()
        );

        setEntries(allEntries);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, [session?.user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {role === UserRole.STUDENT ? "My Progress" : "Reports"}
        </h1>
        <p className="text-muted-foreground">
          {role === UserRole.STUDENT
            ? "Review your completed session reports and track your progress."
            : "View AI-generated class reports for completed sessions."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Completed Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground">
              No completed sessions yet. Reports will appear here after
              sessions are completed.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classroom</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Report</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.session.id}>
                    <TableCell className="font-medium">
                      {entry.classroom.name}
                    </TableCell>
                    <TableCell>{entry.classroom.languageTarget}</TableCell>
                    <TableCell>
                      {new Date(
                        entry.session.startedAt ?? entry.session.scheduledAt
                      ).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {entry.hasReport ? (
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        >
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(
                            `/classroom/${entry.classroom.id}/sessions/${entry.session.id}`
                          )
                        }
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
