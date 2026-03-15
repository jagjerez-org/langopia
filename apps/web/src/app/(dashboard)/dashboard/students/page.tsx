"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Search, UserX, UserCheck, Plus, Filter } from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient, useApiKeyClient } from "@/hooks/use-api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, PageSkeleton, EmptyState, ListItem, GradientAvatar, PrimaryAction } from "@/components/dashboard-list";

interface Student {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  totalRooms: number;
  totalMinutes: number;
  cefrEstimate: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export default function StudentsPage() {
  const router = useRouter();
  const { selectedAcademy, selectedAcademyData, loading } = useAcademy();
  const api = useApiKeyClient();
  const jwtApi = useApiClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCefr, setNewCefr] = useState<string>("");
  const [academyLevels, setAcademyLevels] = useState<{ code: string; label: string }[]>([]);

  const fetchStudents = useCallback(async () => {
    if (!selectedAcademy || !selectedAcademyData?.apiKey) return;
    try {
      const data = await api.students.list({
        search: search || undefined,
        includeInactive: showInactive || undefined,
        limit: 50,
      });
      setStudents((data.data ?? []) as unknown as Student[]);
      setTotal(data.total ?? 0);
    } catch {
      /* ignore */
    }
  }, [selectedAcademy, selectedAcademyData, search, showInactive, api]);

  useEffect(() => {
    setStudents([]);
    setTotal(0);
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (!selectedAcademy) return;
    jwtApi.academyLevels.list(selectedAcademy).then(setAcademyLevels).catch(() => {});
  }, [selectedAcademy, jwtApi]);

  async function handleCreateStudent() {
    if (!newName.trim() || !newEmail.trim()) return;
    setCreating(true);
    try {
      await api.students.create({
        name: newName.trim(),
        email: newEmail.trim(),
        cefrEstimate: newCefr || undefined,
      });
      toast.success("Student added successfully");
      setDialogOpen(false);
      setNewName("");
      setNewEmail("");
      setNewCefr("");
      fetchStudents();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add student";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(student: Student) {
    try {
      if (student.isActive) {
        await api.students.deactivate(student.id);
        toast.success(`${student.name || student.email} deactivated`);
      } else {
        await api.students.activate(student.id);
        toast.success(`${student.name || student.email} activated`);
      }
      fetchStudents();
    } catch {
      toast.error("Failed to update student status");
    }
  }

  if (loading) {
    return <PageSkeleton />;
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState icon={Users} title="No academy selected" description="Select an academy from the sidebar to view students" />
      </div>
    );
  }

  const cefrColors: Record<string, string> = {
    A1: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    A2: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    B1: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    B2: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    C1: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    C2: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Students"
        subtitle={`${total} students tracked`}
        action={
          <PrimaryAction onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Student
          </PrimaryAction>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-zinc-400" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-8 w-48 pl-8 text-xs"
          />
        </div>
        <Button
          variant={showInactive ? "default" : "outline"}
          size="sm"
          onClick={() => setShowInactive(!showInactive)}
          className="h-8 text-xs"
        >
          <UserX className="mr-1.5 h-3.5 w-3.5" />
          {showInactive ? "Showing inactive" : "Show inactive"}
        </Button>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Students appear when they join rooms or you add them manually"
          action={
            <div className="mt-4">
              <PrimaryAction onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Student
              </PrimaryAction>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <ListItem
              key={student.id}
              onClick={() => router.push(`/dashboard/students/${student.id}`)}
              className={!student.isActive ? "opacity-60" : ""}
              avatar={<GradientAvatar>{student.name.charAt(0).toUpperCase()}</GradientAvatar>}
              title={student.name}
              badges={
                <>
                  <Badge
                    variant="secondary"
                    className={
                      student.isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }
                  >
                    {student.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {student.cefrEstimate && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        cefrColors[student.cefrEstimate] ?? cefrColors.B1
                      }`}
                    >
                      {student.cefrEstimate}
                    </span>
                  )}
                </>
              }
              subtitle={
                <>
                  <span>{student.email}</span>
                  <span>&middot;</span>
                  <span>{student.totalRooms} classes</span>
                  <span>&middot;</span>
                  <span>{Math.round((student.totalMinutes / 60) * 10) / 10}h</span>
                  <span>&middot;</span>
                  <span>Last seen {new Date(student.lastSeenAt).toLocaleDateString()}</span>
                </>
              }
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleActive(student)}
                  title={student.isActive ? "Deactivate student" : "Activate student"}
                >
                  {student.isActive ? (
                    <UserX className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                  ) : (
                    <UserCheck className="h-4 w-4 text-zinc-400 hover:text-emerald-500" />
                  )}
                </Button>
              }
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="student-name">Name</Label>
              <Input
                id="student-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Student name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-email">Email</Label>
              <Input
                id="student-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="student@example.com"
              />
            </div>
            {academyLevels.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="student-cefr">Level (optional)</Label>
                <Select value={newCefr} onValueChange={setNewCefr}>
                  <SelectTrigger id="student-cefr">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {academyLevels.map((level) => (
                      <SelectItem key={level.code} value={level.code}>
                        {level.code} — {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateStudent}
              disabled={creating || !newName.trim() || !newEmail.trim()}
            >
              {creating ? "Adding..." : "Add Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
