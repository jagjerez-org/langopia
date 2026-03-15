"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Check } from "lucide-react";
import type { MyAcademyMembership } from "@langopia/api-client";

export default function AppProfilePage() {
  const { user, updateUser } = useAuth();
  const api = useJwtClient();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [academies, setAcademies] = useState<MyAcademyMembership[]>([]);

  useEffect(() => {
    api.me.academies().then(setAcademies).catch(() => {});
  }, [api]);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const saveName = useCallback(async () => {
    if (!name.trim() || name.trim() === user?.name) return;
    setSaving(true);
    try {
      await api.userProfile.update({ name: name.trim() });
      updateUser({ name: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [api, name, user?.name, updateUser]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>

      {/* Name edit */}
      <div className="glass rounded-2xl p-5">
        <div className="space-y-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={saveName}
                disabled={saving || !name.trim() || name.trim() === user?.name}
                size="sm"
              >
                {saved ? (
                  <>
                    <Check className="mr-1 h-3 w-3" /> Saved
                  </>
                ) : saving ? (
                  "Saving..."
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div>
            <Label>Plan</Label>
            <p className="mt-1">
              <Badge variant="secondary">{user?.plan}</Badge>
            </p>
          </div>
        </div>
      </div>

      {/* Academy memberships */}
      <div className="glass rounded-2xl p-5">
        <h2 className="mb-3 font-semibold">Academy Memberships</h2>
        {academies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No academy memberships
          </p>
        ) : (
          <div className="space-y-2">
            {academies.map((m) => (
              <div
                key={m.memberId}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/40"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/20">
                    <Building2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.academy.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.academy.academyType}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {m.roles.map((role) => (
                    <Badge key={role} variant="outline" className="text-[10px]">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
