"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  ExternalLink,
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
import { PageHeader, PageSkeleton, EmptyState, PrimaryAction } from "@/components/dashboard-list";

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
  language: string;
  cefrLevel: string;
}

const CALENDAR_COLORS: Record<string, string> = {
  scheduled: "#3b82f6",
  confirmed: "#22c55e",
  in_progress: "#8b5cf6",
  completed: "#6b7280",
  cancelled: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
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
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newDuration, setNewDuration] = useState(60);
  const [newClassType, setNewClassType] = useState("individual");
  const [newMaxStudents, setNewMaxStudents] = useState(1);
  const [newTeacherId, setNewTeacherId] = useState("");
  const [newLessonId, setNewLessonId] = useState("");
  const [newCancellationMinutes, setNewCancellationMinutes] = useState(60);
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
    const selectedLesson = lessons.find((l) => l.id === newLessonId);
    if (!apiKey || !newScheduledAt || !selectedLesson) return;

    setSaving(true);
    try {
      await api.classes.create({
        title: selectedLesson.title,
        scheduledAt: new Date(newScheduledAt).toISOString(),
        durationMinutes: newDuration,
        classType: newClassType,
        language: selectedLesson.language,
        maxStudents: newClassType === "individual" ? 1 : newMaxStudents,
        teacherId: newTeacherId || undefined,
        lessonId: newLessonId,
        zoomLink: newZoomLink || undefined,
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
    setNewScheduledAt("");
    setNewDuration(60);
    setNewClassType("individual");
    setNewMaxStudents(1);
    setNewTeacherId("");
    setNewLessonId("");
    setNewCancellationMinutes(60);
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
      backgroundColor: CALENDAR_COLORS[c.status] ?? "#6b7280",
      borderColor: CALENDAR_COLORS[c.status] ?? "#6b7280",
    };
  });

  if (academyLoading) {
    return <PageSkeleton maxWidth="max-w-7xl" contentHeight="h-[600px]" />;
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-7xl">
        <EmptyState icon={CalendarIcon} title="No academy selected" description="Select an academy from the sidebar to manage classes" />
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
      <PageHeader
        title="Classes"
        subtitle="Schedule and manage your classes"
        action={
          <PrimaryAction onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Class
          </PrimaryAction>
        }
      />

      <div className="glass rounded-xl p-5">
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
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4">
          {Object.entries(CALENDAR_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize">{status.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create Class Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Class</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Lesson *</label>
              <select value={newLessonId} onChange={(e) => setNewLessonId(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <option value="">Select a lesson...</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
            {(() => { const sl = lessons.find((l) => l.id === newLessonId); return sl ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">{sl.title}</span>
                <Badge variant="outline">{sl.cefrLevel}</Badge>
                <Badge variant="outline" className="uppercase">{sl.language}</Badge>
              </div>
            ) : null; })()}
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
                <select value={newClassType} onChange={(e) => { setNewClassType(e.target.value); if (e.target.value === "individual") setNewMaxStudents(1); else setNewMaxStudents(5); }} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  <option value="individual">Individual</option>
                  <option value="group">Group</option>
                </select>
              </div>
              {newClassType === "group" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Max Students</label>
                  <Input type="number" value={newMaxStudents} onChange={(e) => setNewMaxStudents(Number(e.target.value))} min={2} max={50} />
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cancellation Policy (min)</label>
              <Input type="number" value={newCancellationMinutes} onChange={(e) => setNewCancellationMinutes(Number(e.target.value))} min={0} />
            </div>
            {teachers.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Teacher</label>
                <select value={newTeacherId} onChange={(e) => setNewTeacherId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  <option value="">Auto-assign</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">External Room Link</label>
              <Input value={newZoomLink} onChange={(e) => setNewZoomLink(e.target.value)} placeholder="https://zoom.us/... or https://meet.google.com/..." />
              <p className="mt-1 text-xs text-zinc-400">Optional — use Zoom or Google Meet instead of LiveKit</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving || !newScheduledAt || !newLessonId}>
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
                <Badge className={STATUS_COLORS[selectedClass.status] ?? ""}>
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
