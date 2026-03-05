"use client";

import { useEffect, useState, useCallback } from "react";
import { GraduationCap, Plus, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiKeyClient } from "@/hooks/use-api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Teacher {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export default function TeachersPage() {
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } = useAcademy();
  const api = useApiKeyClient();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.teachers.list();
      setTeachers(data as unknown as Teacher[]);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (selectedAcademyData?.apiKey) fetchTeachers();
  }, [selectedAcademyData?.apiKey, fetchTeachers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      await api.teachers.invite({ email: inviteEmail.trim() });
      toast.success("Teacher invited!");
      setInviteEmail("");
      fetchTeachers();
    } catch {
      toast.error("Failed to invite teacher");
    } finally {
      setInviting(false);
    }
  }

  if (academyLoading || loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="glass h-64 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <GraduationCap className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to manage teachers</p>
        </div>
      </div>
    );
  }

  if (selectedAcademyData?.academyType === "freelance") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Teachers</h1>
          <p className="text-sm text-zinc-500">Manage your academy&apos;s teaching staff</p>
        </div>
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <GraduationCap className="mb-3 h-10 w-10 text-violet-400" />
          <p className="font-medium text-zinc-600 dark:text-zinc-300">Freelance Mode</p>
          <p className="mt-1 max-w-sm text-sm text-zinc-400">
            As a freelance teacher, you&apos;re automatically assigned to all classes.
            Switch to academy mode to invite additional teachers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teachers</h1>
        <p className="text-sm text-zinc-500">Manage your academy&apos;s teaching staff</p>
      </div>

      {/* Invite Form */}
      <div className="glass rounded-xl p-4">
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
          <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
            {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Invite
          </Button>
        </form>
        <p className="mt-2 text-xs text-zinc-400">
          The teacher must have a Langopia account. They&apos;ll be added to your academy.
        </p>
      </div>

      {/* Teacher List */}
      {teachers.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center rounded-xl py-12 text-center">
          <GraduationCap className="mb-3 h-8 w-8 text-zinc-400" />
          <p className="text-sm text-zinc-500">No teachers yet</p>
          <p className="mt-1 text-xs text-zinc-400">Invite teachers using the form above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="glass flex items-center gap-4 rounded-xl p-4">
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
                  <Badge key={role} variant="secondary" className="capitalize">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
