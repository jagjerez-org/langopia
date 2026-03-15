"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Plus,
  Loader2,
  Mail,
  FileText,
  Check,
  X,
  Clock,
  Trash2,
  UserX,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@langopia/api-client";
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
import { PageHeader, PageSkeleton, EmptyState, ListItem, GradientAvatar } from "@/components/dashboard-list";

interface Teacher {
  id: string;
  name: string;
  email: string;
  languages: string[];
  isActive: boolean;
  userId: string | null;
  createdAt: string;
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

const STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function TeachersPage() {
  const router = useRouter();
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
      const res = await apiKey.teachers.list();
      const list = Array.isArray(res) ? res : (res as { data: Teacher[] }).data ?? [];
      setTeachers(list as Teacher[]);
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
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to invite teacher";
      toast.error(message);
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

  async function handleDeactivate(teacher: Teacher) {
    try {
      await apiKey.teachers.deactivate(teacher.id);
      toast.success(`${teacher.name} deactivated`);
      fetchTeachers();
    } catch {
      toast.error("Failed to deactivate teacher");
    }
  }

  async function handleReactivate(teacher: Teacher) {
    try {
      await apiKey.teachers.reactivate(teacher.id);
      toast.success(`${teacher.name} reactivated`);
      fetchTeachers();
    } catch {
      toast.error("Failed to reactivate teacher");
    }
  }

  async function handleRemove(teacher: Teacher) {
    try {
      await apiKey.teachers.remove(teacher.id);
      toast.success(`${teacher.name} removed`);
      fetchTeachers();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to remove teacher. They may have classes assigned — try deactivating instead.";
      toast.error(message);
    }
  }

  if (academyLoading) {
    return <PageSkeleton />;
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState icon={GraduationCap} title="No academy selected" description="Select an academy from the sidebar to manage teachers" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Teachers"
        subtitle="Manage teachers and review applications"
      />

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
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass h-20 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : teachers.length === 0 ? (
            <EmptyState icon={GraduationCap} title="No teachers yet" description="Invite a teacher to get started" />
          ) : (
            <div className="space-y-3">
              {teachers.map((teacher) => (
                <ListItem
                  key={teacher.id}
                  onClick={() => router.push(`/dashboard/teachers/${teacher.id}`)}
                  avatar={<GradientAvatar>{teacher.name.charAt(0).toUpperCase()}</GradientAvatar>}
                  title={teacher.name}
                  badges={
                    <div className="flex gap-1">
                      <Badge
                        variant="secondary"
                        className={teacher.isActive ? "" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}
                      >
                        {teacher.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  }
                  subtitle={
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {teacher.email}
                    </span>
                  }
                  actions={
                    <>
                      {teacher.isActive ? (
                        <Button variant="ghost" size="sm" onClick={() => handleDeactivate(teacher)} title="Deactivate teacher">
                          <UserX className="h-4 w-4 text-zinc-400 hover:text-amber-500" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => handleReactivate(teacher)} title="Reactivate teacher">
                          <UserCheck className="h-4 w-4 text-zinc-400 hover:text-emerald-500" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(teacher)} title="Remove teacher (only if no classes)">
                        <Trash2 className="h-4 w-4 text-zinc-400 hover:text-red-500" />
                      </Button>
                    </>
                  }
                />
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
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass h-20 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : applications.length === 0 ? (
            <EmptyState icon={FileText} title="No applications" description="Applications will appear here when teachers apply" />
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <ListItem
                  key={app.id}
                  onClick={() => { setReviewingApp(app); setReviewNotes(""); }}
                  chevron={false}
                  avatar={<GradientAvatar>{app.fullName.charAt(0).toUpperCase()}</GradientAvatar>}
                  title={app.fullName}
                  badges={
                    <>
                      {app.languages.length > 0 && (
                        <div className="flex gap-1">
                          {app.languages.map((lang) => (
                            <Badge key={lang} variant="outline" className="text-xs">{lang}</Badge>
                          ))}
                        </div>
                      )}
                      <Badge className={STATUS_COLORS[app.status] ?? STATUS_COLORS.pending}>
                        {app.status}
                      </Badge>
                    </>
                  }
                  subtitle={
                    <>
                      <span>{app.email}</span>
                      <span>&middot;</span>
                      <span>Applied {new Date(app.createdAt).toLocaleDateString()}</span>
                      {app.phone && <><span>&middot;</span><span>Phone: {app.phone}</span></>}
                      {app.cvUrl && <><span>&middot;</span><span>CV attached</span></>}
                    </>
                  }
                />
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
