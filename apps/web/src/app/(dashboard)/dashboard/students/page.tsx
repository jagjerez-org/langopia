"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Search, UserX, UserCheck, Plus } from "lucide-react";
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
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="glass h-64 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <Users className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to view students</p>
        </div>
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{total} students tracked</p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Student
          </Button>
          <Button
            variant={showInactive ? "default" : "outline"}
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
          >
            <UserX className="mr-1.5 h-3.5 w-3.5" />
            {showInactive ? "Showing inactive" : "Show inactive"}
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students..."
              className="rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200/40 dark:border-zinc-700/40">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Student
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                CEFR
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Classes
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Hours
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Last Seen
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {students.map((student) => (
              <tr
                key={student.id}
                className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 ${!student.isActive ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{student.name}</p>
                  <p className="text-xs text-zinc-500">{student.email}</p>
                </td>
                <td className="px-4 py-3">
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
                </td>
                <td className="px-4 py-3">
                  {student.cefrEstimate ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        cefrColors[student.cefrEstimate] ?? cefrColors.B1
                      }`}
                    >
                      {student.cefrEstimate}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">--</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {student.totalRooms}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {Math.round((student.totalMinutes / 60) * 10) / 10}h
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {new Date(student.lastSeenAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {students.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 h-10 w-10 text-zinc-400" />
            <p className="font-medium text-zinc-500">No students yet</p>
            <p className="mt-1 text-sm text-zinc-400">
              Students appear when they join rooms or you add them manually
            </p>
          </div>
        )}
      </div>

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
