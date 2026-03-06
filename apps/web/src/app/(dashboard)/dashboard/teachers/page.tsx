"use client";

import { useEffect, useState, useCallback } from "react";
import {
  GraduationCap,
  Plus,
  Loader2,
  Mail,
  FileText,
  Check,
  X,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiKeyClient, useApiClient } from "@/hooks/use-api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Teacher {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

interface Application {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  languages: string[];
  experience: string | null;
  cvUrl: string | null;
  attachments: string[];
  customFields: Record<string, unknown>;
  status: string;
  reviewNotes: string | null;
  createdAt: string;
}

const applicationStatusColors: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function TeachersPage() {
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } =
    useAcademy();
  const apiKey = useApiKeyClient();
  const api = useApiClient();

  const [tab, setTab] = useState<"teachers" | "applications">("teachers");

  // Teachers state
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // Applications state
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [reviewingApp, setReviewingApp] = useState<Application | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const fetchTeachers = useCallback(async () => {
    setLoadingTeachers(true);
    try {
      const data = await apiKey.teachers.list();
      setTeachers(data as unknown as Teacher[]);
    } catch {
      /* ignore */
    } finally {
      setLoadingTeachers(false);
    }
  }, [apiKey]);

  const fetchApplications = useCallback(async () => {
    if (!selectedAcademy) return;
    setLoadingApplications(true);
    try {
      const data = await api.teacherApplications.list(
        selectedAcademy,
        filterStatus !== "all" ? filterStatus : undefined,
      );
      setApplications(data as unknown as Application[]);
    } catch {
      /* ignore */
    } finally {
      setLoadingApplications(false);
    }
  }, [api, selectedAcademy, filterStatus]);

  useEffect(() => {
    if (selectedAcademyData?.apiKey) fetchTeachers();
  }, [selectedAcademyData?.apiKey, fetchTeachers]);

  useEffect(() => {
    if (selectedAcademy) fetchApplications();
  }, [selectedAcademy, fetchApplications]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await apiKey.teachers.invite({ email: inviteEmail.trim() });
      toast.success("Teacher invited!");
      setInviteEmail("");
      fetchTeachers();
    } catch {
      toast.error("Failed to invite teacher");
    } finally {
      setInviting(false);
    }
  }

  async function handleReview(status: "approved" | "rejected") {
    if (!reviewingApp || !selectedAcademy) return;
    try {
      await api.teacherApplications.review(selectedAcademy, reviewingApp.id, {
        status,
        reviewNotes: reviewNotes || undefined,
      });
      toast.success(`Application ${status}`);
      setReviewingApp(null);
      setReviewNotes("");
      fetchApplications();
    } catch {
      toast.error("Failed to review application");
    }
  }

  if (academyLoading) {
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
          <GraduationCap className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">
            Select an academy from the sidebar to manage teachers
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teachers</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage teachers and review applications
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-200/40 p-1 dark:border-zinc-700/40">
        <button
          onClick={() => setTab("teachers")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            tab === "teachers"
              ? "bg-gradient-accent text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <GraduationCap className="mr-2 inline h-4 w-4" />
          Teachers ({teachers.length})
        </button>
        <button
          onClick={() => setTab("applications")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            tab === "applications"
              ? "bg-gradient-accent text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          <FileText className="mr-2 inline h-4 w-4" />
          Applications (
          {applications.filter((a) => a.status === "pending").length} pending)
        </button>
      </div>

      {tab === "teachers" && (
        <>
          {/* Invite Form */}
          {selectedAcademyData?.academyType === "academy" && (
            <div className="glass-subtle rounded-xl border border-zinc-200/40 p-4 dark:border-zinc-700/40">
              <h3 className="mb-3 text-sm font-semibold">Invite Teacher</h3>
              <form onSubmit={handleInvite} className="flex gap-2">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teacher@email.com"
                  className="flex-1"
                  disabled={inviting}
                />
                <Button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                >
                  {inviting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Invite
                </Button>
              </form>
            </div>
          )}

          {loadingTeachers ? (
            <div className="glass h-40 animate-pulse rounded-xl" />
          ) : teachers.length === 0 ? (
            <div className="glass-subtle flex flex-col items-center justify-center rounded-xl border border-zinc-200/40 py-12 text-center dark:border-zinc-700/40">
              <GraduationCap className="mb-3 h-8 w-8 text-zinc-400" />
              <p className="text-sm text-zinc-500">No teachers yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="glass-subtle flex items-center gap-4 rounded-xl border border-zinc-200/40 p-4 dark:border-zinc-700/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white">
                    {teacher.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{teacher.name}</p>
                    <p className="flex items-center gap-1 truncate text-sm text-zinc-500">
                      <Mail className="h-3 w-3" /> {teacher.email}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {teacher.roles.map((role) => (
                      <Badge
                        key={role}
                        variant="secondary"
                        className="capitalize"
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "applications" && (
        <>
          {/* Filter */}
          <div className="flex gap-2">
            {["all", "pending", "approved", "rejected"].map((s) => (
              <Button
                key={s}
                variant={filterStatus === s ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(s)}
                className="capitalize"
              >
                {s === "pending" && (
                  <Clock className="mr-1.5 h-3 w-3" />
                )}
                {s === "approved" && (
                  <Check className="mr-1.5 h-3 w-3" />
                )}
                {s === "rejected" && (
                  <X className="mr-1.5 h-3 w-3" />
                )}
                {s}
              </Button>
            ))}
          </div>

          {loadingApplications ? (
            <div className="glass h-40 animate-pulse rounded-xl" />
          ) : applications.length === 0 ? (
            <div className="glass-subtle flex flex-col items-center justify-center rounded-xl border border-zinc-200/40 py-12 text-center dark:border-zinc-700/40">
              <FileText className="mb-3 h-8 w-8 text-zinc-400" />
              <p className="text-sm text-zinc-500">No applications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.id}
                  onClick={() => {
                    setReviewingApp(app);
                    setReviewNotes("");
                  }}
                  className="glass-subtle cursor-pointer rounded-xl border border-zinc-200/40 p-4 transition-all hover:shadow-md dark:border-zinc-700/40"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{app.fullName}</p>
                      <p className="text-sm text-zinc-500">{app.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {app.languages.length > 0 && (
                        <div className="flex gap-1">
                          {app.languages.map((lang) => (
                            <Badge
                              key={lang}
                              variant="outline"
                              className="text-xs"
                            >
                              {lang}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <Badge
                        className={
                          applicationStatusColors[app.status] ??
                          applicationStatusColors.pending
                        }
                      >
                        {app.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400">
                    <span>
                      Applied{" "}
                      {new Date(app.createdAt).toLocaleDateString()}
                    </span>
                    {app.phone && <span>Phone: {app.phone}</span>}
                    {app.cvUrl && <span>CV attached</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Review Dialog */}
      <Dialog
        open={!!reviewingApp}
        onOpenChange={() => setReviewingApp(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
          </DialogHeader>
          {reviewingApp && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Name</span>
                  <span className="text-sm">{reviewingApp.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Email</span>
                  <span className="text-sm">{reviewingApp.email}</span>
                </div>
                {reviewingApp.phone && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Phone</span>
                    <span className="text-sm">{reviewingApp.phone}</span>
                  </div>
                )}
                {reviewingApp.languages.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Languages</span>
                    <span className="text-sm">
                      {reviewingApp.languages.join(", ")}
                    </span>
                  </div>
                )}
                {reviewingApp.experience && (
                  <div>
                    <span className="text-sm font-medium">Experience</span>
                    <p className="mt-1 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                      {reviewingApp.experience}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Review Notes</label>
                <Input
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="mt-1"
                />
              </div>

              {reviewingApp.status === "pending" && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleReview("rejected")}
                    className="text-red-600"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button onClick={() => handleReview("approved")}>
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
