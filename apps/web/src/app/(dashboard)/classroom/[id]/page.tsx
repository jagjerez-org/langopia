"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { SessionStatusBadge } from "@/components/classroom/session-status-badge";
import { ClassroomTypeBadge } from "@/components/classroom/classroom-type-badge";
import { Plus, Play, Square, Video, UserPlus, UserMinus, Eye, GraduationCap } from "lucide-react";
import {
  UserRole,
  ClassroomType,
  SessionStatus,
} from "@langopia/shared/types";

interface SessionData {
  id: string;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  status: SessionStatus;
  livekitRoomId: string | null;
}

interface EnrollmentData {
  id: string;
  studentId: string;
  student: { id: string; name: string; email: string };
  enrolledAt: string;
}

interface ClassroomData {
  id: string;
  name: string;
  description: string | null;
  type: ClassroomType;
  languageTarget: string;
  maxStudents: number;
  teacherId: string;
  teacher: { id: string; name: string };
}

export default function ClassroomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: authSession } = useSession();
  const router = useRouter();
  const [classroom, setClassroom] = useState<ClassroomData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const role = authSession?.user?.role as UserRole | undefined;
  const isTeacher =
    role === UserRole.TEACHER && authSession?.user?.id === classroom?.teacherId;
  const isAdmin = role === UserRole.ADMIN;
  const canManage = isTeacher || isAdmin;

  useEffect(() => {
    Promise.all([
      fetch(`/api/classrooms/${id}`).then((r) => r.json()),
      fetch(`/api/classrooms/${id}/sessions`).then((r) => r.json()),
      fetch(`/api/classrooms/${id}/enrollments`).then((r) => r.json()),
    ])
      .then(([c, s, e]) => {
        setClassroom(c);
        setSessions(s);
        setEnrollments(e);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/classrooms/${id}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: form.get("scheduledAt") }),
    });
    if (res.ok) {
      const created = await res.json();
      setSessions((prev) => [created, ...prev]);
      setScheduleOpen(false);
    }
  }

  async function handleStartSession(sessionId: string) {
    const res = await fetch(`/api/sessions/${sessionId}/start`, {
      method: "POST",
    });
    if (res.ok) {
      const updated = await res.json();
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? updated : s))
      );
      router.push(`/session/${sessionId}`);
    }
  }

  async function handleEndSession(sessionId: string) {
    const res = await fetch(`/api/sessions/${sessionId}/end`, {
      method: "POST",
    });
    if (res.ok) {
      const updated = await res.json();
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? updated : s))
      );
    }
  }

  async function handleJoinSession(sessionId: string) {
    router.push(`/session/${sessionId}`);
  }

  async function handleEnroll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/classrooms/${id}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: form.get("studentId") }),
    });
    if (res.ok) {
      const created = await res.json();
      // Re-fetch enrollments to get student relation
      const enrollmentsRes = await fetch(`/api/classrooms/${id}/enrollments`);
      if (enrollmentsRes.ok) {
        setEnrollments(await enrollmentsRes.json());
      } else {
        setEnrollments((prev) => [...prev, created]);
      }
      setEnrollOpen(false);
    }
  }

  async function handleUnenroll(studentId: string) {
    const res = await fetch(`/api/classrooms/${id}/enrollments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    if (res.ok) {
      setEnrollments((prev) => prev.filter((e) => e.studentId !== studentId));
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!classroom) {
    return <div className="text-muted-foreground">Classroom not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{classroom.name}</h1>
          <ClassroomTypeBadge type={classroom.type} />
        </div>
        {classroom.description && (
          <p className="mt-1 text-muted-foreground">{classroom.description}</p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {classroom.languageTarget} &middot; Teacher: {classroom.teacher?.name}
        </p>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="students">
            Students ({enrollments.length}/{classroom.maxStudents})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          {canManage && (
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule Session
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule Session</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSchedule} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledAt">Date & Time</Label>
                    <Input
                      id="scheduledAt"
                      name="scheduledAt"
                      type="datetime-local"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Schedule
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No sessions scheduled yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <SessionStatusBadge status={s.status} />
                      <div>
                        <p className="font-medium">
                          {new Date(s.scheduledAt).toLocaleString()}
                        </p>
                        {s.startedAt && (
                          <p className="text-sm text-muted-foreground">
                            Started: {new Date(s.startedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {s.status === SessionStatus.SCHEDULED && canManage && (
                        <Button
                          size="sm"
                          onClick={() => handleStartSession(s.id)}
                        >
                          <Play className="mr-1 h-4 w-4" />
                          Start
                        </Button>
                      )}
                      {s.status === SessionStatus.IN_PROGRESS && canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleJoinSession(s.id)}
                          >
                            <Video className="mr-1 h-4 w-4" />
                            Rejoin
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleEndSession(s.id)}
                          >
                            <Square className="mr-1 h-4 w-4" />
                            End
                          </Button>
                        </>
                      )}
                      {s.status === SessionStatus.IN_PROGRESS && !canManage && (
                        <Button
                          size="sm"
                          onClick={() => handleJoinSession(s.id)}
                        >
                          <Video className="mr-1 h-4 w-4" />
                          Join
                        </Button>
                      )}
                      {s.status === SessionStatus.COMPLETED && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            router.push(`/classroom/${id}/sessions/${s.id}`)
                          }
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          View
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          {canManage && (
            <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Enroll Student
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enroll Student</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEnroll} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="studentId">Student ID</Label>
                    <Input
                      id="studentId"
                      name="studentId"
                      placeholder="Paste student UUID"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Enroll
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {enrollments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No students enrolled yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {enrollments.map((enrollment) => (
                <Card key={enrollment.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">
                        {enrollment.student?.name ?? enrollment.studentId}
                      </p>
                      {enrollment.student?.email && (
                        <p className="text-sm text-muted-foreground">
                          {enrollment.student.email}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(
                            `/classroom/${id}/students/${enrollment.studentId}`
                          )
                        }
                      >
                        <GraduationCap className="mr-1 h-4 w-4" />
                        Profile
                      </Button>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnenroll(enrollment.studentId)}
                        >
                          <UserMinus className="mr-1 h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>
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
