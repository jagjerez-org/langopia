"use client";

import { useEffect, useState, useCallback } from "react";
import { UsersRound, Plus, Mail, Link2, Trash2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient } from "@/hooks/use-api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TeamMember {
  id: string;
  userId: string;
  academyId: string;
  role: string;
  permissions: string[];
  user?: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

interface InviteLink {
  id: string;
  token: string;
  targetRole: string;
  academyId: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

const ROLES = ["admin", "content_manager", "financing", "coordinator"] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  content_manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  financing: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  coordinator: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function roleBadgeClass(role: string) {
  return ROLE_COLORS[role] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

function formatRole(role: string) {
  return role.replace(/_/g, " ");
}

export default function TeamPage() {
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } = useAcademy();
  const api = useApiClient();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite member dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("coordinator");
  const [inviting, setInviting] = useState(false);

  // Edit member dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [updating, setUpdating] = useState(false);

  // Remove confirmation
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // Create invite link dialog
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkRole, setLinkRole] = useState<string>("coordinator");
  const [linkMaxUses, setLinkMaxUses] = useState("");
  const [linkExpiryDays, setLinkExpiryDays] = useState("");
  const [creatingLink, setCreatingLink] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!selectedAcademy) return;
    try {
      const data = await api.team.list(selectedAcademy);
      setMembers(data as unknown as TeamMember[]);
    } catch {
      /* ignore */
    }
  }, [api, selectedAcademy]);

  const fetchInviteLinks = useCallback(async () => {
    if (!selectedAcademy) return;
    try {
      const data = await api.team.listInviteLinks(selectedAcademy);
      setInviteLinks(data as unknown as InviteLink[]);
    } catch {
      /* ignore */
    }
  }, [api, selectedAcademy]);

  useEffect(() => {
    if (!selectedAcademy) return;
    setLoading(true);
    Promise.all([fetchMembers(), fetchInviteLinks()]).finally(() => setLoading(false));
  }, [selectedAcademy, fetchMembers, fetchInviteLinks]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedAcademy) return;

    setInviting(true);
    try {
      await api.team.invite(selectedAcademy, { email: inviteEmail.trim(), role: inviteRole });
      toast.success("Team member invited!");
      setInviteEmail("");
      setInviteRole("teacher");
      setInviteOpen(false);
      fetchMembers();
    } catch {
      toast.error("Failed to invite team member");
    } finally {
      setInviting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editMember || !selectedAcademy) return;

    setUpdating(true);
    try {
      await api.team.update(selectedAcademy, editMember.id, { role: editRole });
      toast.success("Member updated!");
      setEditOpen(false);
      setEditMember(null);
      fetchMembers();
    } catch {
      toast.error("Failed to update member");
    } finally {
      setUpdating(false);
    }
  }

  async function handleRemove() {
    if (!removeId || !selectedAcademy) return;

    setRemoving(true);
    try {
      await api.team.remove(selectedAcademy, removeId);
      toast.success("Member removed");
      setRemoveId(null);
      fetchMembers();
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemoving(false);
    }
  }

  async function handleCreateLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAcademy) return;

    setCreatingLink(true);
    try {
      await api.team.createInviteLink(selectedAcademy, {
        targetRole: linkRole,
        maxUses: linkMaxUses ? parseInt(linkMaxUses, 10) : undefined,
        expiresInDays: linkExpiryDays ? parseInt(linkExpiryDays, 10) : undefined,
      });
      toast.success("Invite link created!");
      setLinkRole("teacher");
      setLinkMaxUses("");
      setLinkExpiryDays("");
      setLinkOpen(false);
      fetchInviteLinks();
    } catch {
      toast.error("Failed to create invite link");
    } finally {
      setCreatingLink(false);
    }
  }

  async function handleDeleteLink(id: string) {
    if (!selectedAcademy) return;
    try {
      await api.team.deleteInviteLink(selectedAcademy, id);
      toast.success("Invite link deleted");
      fetchInviteLinks();
    } catch {
      toast.error("Failed to delete invite link");
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
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
          <UsersRound className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to manage your team</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage staff members, roles, and invitations
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="bg-gradient-accent text-white">
          <Plus className="mr-2 h-4 w-4" /> Invite Member
        </Button>
      </div>

      {/* Team Members */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Members</h2>
        {members.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center rounded-xl py-12 text-center">
            <UsersRound className="mb-3 h-8 w-8 text-zinc-400" />
            <p className="text-sm text-zinc-500">No team members yet</p>
            <p className="mt-1 text-xs text-zinc-400">Invite members using the button above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="glass flex items-center gap-4 rounded-xl p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white">
                  {(member.user?.name ?? member.user?.email ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{member.user?.name ?? "Unknown"}</p>
                  <p className="flex items-center gap-1 truncate text-sm text-zinc-500">
                    <Mail className="h-3 w-3" /> {member.user?.email ?? "No email"}
                  </p>
                </div>
                <Badge className={`capitalize border-0 ${roleBadgeClass(member.role)}`}>
                  {formatRole(member.role)}
                </Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditMember(member);
                      setEditRole(member.role);
                      setEditOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => setRemoveId(member.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Links */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Invite Links</h2>
          <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" /> Create Invite Link
          </Button>
        </div>
        {inviteLinks.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center rounded-xl py-12 text-center">
            <Link2 className="mb-3 h-8 w-8 text-zinc-400" />
            <p className="text-sm text-zinc-500">No invite links</p>
            <p className="mt-1 text-xs text-zinc-400">Create a link to let people join your team</p>
          </div>
        ) : (
          <div className="space-y-2">
            {inviteLinks.map((link) => (
              <div key={link.id} className="glass flex items-center gap-4 rounded-xl p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <Link2 className="h-5 w-5 text-zinc-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className={`capitalize border-0 ${roleBadgeClass(link.targetRole)}`}>
                      {formatRole(link.targetRole)}
                    </Badge>
                    <span className="text-xs text-zinc-400">
                      {link.usedCount}{link.maxUses !== null ? `/${link.maxUses}` : ""} uses
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    {link.expiresAt
                      ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}`
                      : "No expiry"}
                    {" "}
                    &middot; Created {new Date(link.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyLink(link.token)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleDeleteLink(link.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="member@email.com"
                disabled={inviting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {formatRole(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting || !inviteEmail.trim()} className="bg-gradient-accent text-white">
                {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send Invite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{editMember?.user?.name ?? "Unknown"}</p>
              <p className="text-xs text-zinc-400">{editMember?.user?.email}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {formatRole(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updating} className="bg-gradient-accent text-white">
                {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-500">
            Are you sure you want to remove this member from your team? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoveId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Invite Link Dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invite Link</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateLink} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={linkRole} onValueChange={setLinkRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {formatRole(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Uses</label>
              <Input
                type="number"
                min="1"
                value={linkMaxUses}
                onChange={(e) => setLinkMaxUses(e.target.value)}
                placeholder="Unlimited"
                disabled={creatingLink}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expires In (days)</label>
              <Input
                type="number"
                min="1"
                value={linkExpiryDays}
                onChange={(e) => setLinkExpiryDays(e.target.value)}
                placeholder="Never"
                disabled={creatingLink}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingLink} className="bg-gradient-accent text-white">
                {creatingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Create Link
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
