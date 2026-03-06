"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  X,
  ExternalLink,
  Pencil,
  Ban,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiKeyClient } from "@/hooks/use-api-client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TutorialOverlay } from "@/components/tutorial-overlay";

interface ClassEvent {
  id: string;
  title: string;
  description: string | null;
  classType: string;
  status: string;
  language: string;
  maxStudents: number;
  scheduledAt: string;
  durationMinutes: number;
  cancellationMinutes: number;
  teacher: { id: string; name: string; email: string } | null;
  teacherUrl: string;
  studentUrl: string;
  roomId: string | null;
  lessonId: string | null;
  createdAt: string;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
}

interface Lesson {
  id: string;
  title: string;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#3b82f6",
  confirmed: "#22c55e",
  in_progress: "#8b5cf6",
  completed: "#6b7280",
  cancelled: "#ef4444",
};

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  in_progress: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  completed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function ClassesPage() {
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } = useAcademy();
  const apiKey = selectedAcademyData?.apiKey;
  const api = useApiKeyClient();
  const calendarRef = useRef<FullCalendar>(null);

  const [classes, setClasses] = useState<ClassEvent[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newDuration, setNewDuration] = useState(60);
  const [newClassType, setNewClassType] = useState("individual");
  const [newLanguage, setNewLanguage] = useState("en");
  const [newMaxStudents, setNewMaxStudents] = useState(1);
  const [newTeacherId, setNewTeacherId] = useState("");
  const [newLessonId, setNewLessonId] = useState("");
  const [newStudentEmails, setNewStudentEmails] = useState("");
  const [newCancellationMinutes, setNewCancellationMinutes] = useState(60);
  const [newCourseId, setNewCourseId] = useState("");
  const [newZoomLink, setNewZoomLink] = useState("");

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassEvent | null>(null);

  const fetchClasses = useCallback(async (from?: string, to?: string) => {
    if (!apiKey) return;

    try {
      const data = await api.classes.list({
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      });
      setClasses(data.data as unknown as ClassEvent[]);
    } catch {
      /* ignore */
    }
  }, [apiKey, api]);

  const fetchTeachers = useCallback(async () => {
    if (!apiKey) return;
    try {
      const data = await api.teachers.list();
      setTeachers(data as unknown as Teacher[]);
    } catch {
      /* ignore */
    }
  }, [apiKey, api]);

  const fetchLessons = useCallback(async () => {
    if (!apiKey) return;
    try {
      const data = await api.lessons.list({ limit: 100 });
      setLessons(data.data as unknown as Lesson[]);
    } catch {
      /* ignore */
    }
  }, [apiKey, api]);

  useEffect(() => {
    if (apiKey) {
      fetchTeachers();
      fetchLessons();
    }
  }, [apiKey, fetchTeachers, fetchLessons]);

  useEffect(() => {
    if (dateRange) {
      fetchClasses(dateRange.from, dateRange.to);
    }
  }, [dateRange, fetchClasses]);

  function handleDatesSet(arg: DatesSetArg) {
    setDateRange({
      from: arg.startStr,
      to: arg.endStr,
    });
  }

  function handleEventClick(arg: EventClickArg) {
    const cls = classes.find((c) => c.id === arg.event.id);
    if (cls) {
      setSelectedClass(cls);
      setDetailOpen(true);
    }
  }

  function handleDateClick(dateStr: string) {
    setNewScheduledAt(dateStr.slice(0, 16));
    setCreateOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !newTitle || !newScheduledAt) return;

    setSaving(true);
    try {
      const studentEmails = newStudentEmails ? newStudentEmails.split(",").map((e) => e.trim()).filter(Boolean) : undefined;
      await api.classes.create({
        title: newTitle,
        scheduledAt: new Date(newScheduledAt).toISOString(),
        durationMinutes: newDuration,
        classType: newClassType,
        language: newLanguage,
        maxStudents: newMaxStudents,
        teacherId: newTeacherId || undefined,
        lessonId: newLessonId || undefined,
        courseId: newCourseId || undefined,
        zoomLink: newZoomLink || undefined,
        studentEmails: studentEmails && studentEmails.length > 0 ? studentEmails : undefined,
        cancellationMinutes: newCancellationMinutes,
      });

      toast.success("Class created!");
      setCreateOpen(false);
      resetCreateForm();
      if (dateRange) fetchClasses(dateRange.from, dateRange.to);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create class";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!apiKey || !selectedClass) return;

    const reason = prompt("Cancellation reason (optional):");

    try {
      await api.classes.cancel(selectedClass.id);
      toast.success("Class cancelled");
      setDetailOpen(false);
      if (dateRange) fetchClasses(dateRange.from, dateRange.to);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel class";
      toast.error(message);
    }
  }

  function resetCreateForm() {
    setNewTitle("");
    setNewScheduledAt("");
    setNewDuration(60);
    setNewClassType("individual");
    setNewLanguage("en");
    setNewMaxStudents(1);
    setNewTeacherId("");
    setNewLessonId("");
    setNewStudentEmails("");
    setNewCancellationMinutes(60);
    setNewCourseId("");
    setNewZoomLink("");
  }

  const calendarEvents = classes.map((c) => {
    const start = new Date(c.scheduledAt);
    const end = new Date(start.getTime() + c.durationMinutes * 60_000);
    return {
      id: c.id,
      title: c.title,
      start: start.toISOString(),
      end: end.toISOString(),
      backgroundColor: STATUS_COLORS[c.status] ?? "#6b7280",
      borderColor: STATUS_COLORS[c.status] ?? "#6b7280",
    };
  });

  if (academyLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="glass h-[600px] animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <CalendarIcon className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to manage classes</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <TutorialOverlay
        sectionId="classes"
        steps={[
          { title: "Class Calendar", description: "View and manage all your scheduled classes in calendar format." },
          { title: "Create Classes", description: "Schedule individual or group classes with teachers and students." },
        ]}
      />
      <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Classes</h1>
          <p className="text-sm text-zinc-500">Schedule and manage your classes</p>
        </div>
        <Button onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Class
        </Button>
      </div>

      <div className="glass rounded-xl p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          events={calendarEvents}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          dateClick={(info: DateClickArg) => handleDateClick(info.dateStr)}
          height="auto"
          nowIndicator
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            meridiem: false,
            hour12: false,
          }}
        />
      </div>

      {/* Create Class Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Class</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Title *</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="English Class" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Date & Time *</label>
                <Input type="datetime-local" value={newScheduledAt} onChange={(e) => setNewScheduledAt(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Duration (min)</label>
                <Input type="number" value={newDuration} onChange={(e) => setNewDuration(Number(e.target.value))} min={15} max={240} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Class Type</label>
                <select value={newClassType} onChange={(e) => setNewClassType(e.target.value)} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="individual">Individual</option>
                  <option value="group">Group</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Language</label>
                <Input value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)} placeholder="en" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Max Students</label>
                <Input type="number" value={newMaxStudents} onChange={(e) => setNewMaxStudents(Number(e.target.value))} min={1} max={50} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Cancel Policy (min)</label>
                <Input type="number" value={newCancellationMinutes} onChange={(e) => setNewCancellationMinutes(Number(e.target.value))} min={0} />
              </div>
            </div>
            {teachers.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Teacher</label>
                <select value={newTeacherId} onChange={(e) => setNewTeacherId(e.target.value)} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="">Auto-assign</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>
            )}
            {lessons.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Lesson Plan</label>
                <select value={newLessonId} onChange={(e) => setNewLessonId(e.target.value)} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="">None</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Zoom Link</label>
              <Input value={newZoomLink} onChange={(e) => setNewZoomLink(e.target.value)} placeholder="https://zoom.us/j/..." />
              <p className="mt-1 text-xs text-zinc-400">Optional — use Zoom instead of LiveKit</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Student Emails</label>
              <Input value={newStudentEmails} onChange={(e) => setNewStudentEmails(e.target.value)} placeholder="student1@email.com, student2@email.com" />
              <p className="mt-1 text-xs text-zinc-400">Comma-separated emails</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving || !newTitle || !newScheduledAt}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Class
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Class Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedClass?.title}</DialogTitle>
          </DialogHeader>
          {selectedClass && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={STATUS_BADGE[selectedClass.status] ?? ""}>
                  {selectedClass.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {selectedClass.classType}
                </Badge>
                <Badge variant="outline">
                  {selectedClass.language}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Scheduled</span>
                  <span>{new Date(selectedClass.scheduledAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Duration</span>
                  <span>{selectedClass.durationMinutes} minutes</span>
                </div>
                {selectedClass.teacher && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Teacher</span>
                    <span>{selectedClass.teacher.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Max Students</span>
                  <span>{selectedClass.maxStudents}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                {(selectedClass.status === "scheduled" || selectedClass.status === "confirmed" || selectedClass.status === "in_progress") && (
                  <Button asChild variant="default" className="w-full">
                    <a href={selectedClass.teacherUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> Enter Room (Teacher)
                    </a>
                  </Button>
                )}
                {(selectedClass.status === "scheduled" || selectedClass.status === "confirmed") && (
                  <Button variant="destructive" className="w-full" onClick={handleCancel}>
                    <Ban className="mr-2 h-4 w-4" /> Cancel Class
                  </Button>
                )}
              </div>

              <div className="border-t pt-3 text-xs text-zinc-400">
                <p>Teacher URL: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{selectedClass.teacherUrl}</code></p>
                <p className="mt-1">Student URL: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{selectedClass.studentUrl}</code></p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
