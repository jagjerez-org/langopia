"use client";

import { useEffect, useState, useCallback } from "react";
import { Layers, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient } from "@/hooks/use-api-client";
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
import type { AcademyLevelResponse } from "@langopia/api-client";

export default function LevelsPage() {
  const { selectedAcademy, loading } = useAcademy();
  const api = useApiClient();

  const [levels, setLevels] = useState<AcademyLevelResponse[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<AcademyLevelResponse | null>(null);
  const [code, setCode] = useState<string>("");
  const [levelName, setLevelName] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AcademyLevelResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLevels = useCallback(async () => {
    if (!selectedAcademy) return;
    setLoadingLevels(true);
    try {
      const data = await api.academyLevels.list(selectedAcademy);
      setLevels([...data].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch {
      toast.error("Failed to load levels");
    } finally {
      setLoadingLevels(false);
    }
  }, [selectedAcademy, api]);

  useEffect(() => {
    fetchLevels();
  }, [fetchLevels]);

  function openCreate() {
    setEditingLevel(null);
    setCode("");
    setLevelName("");
    setSortOrder(String((levels.length + 1) * 10));
    setDialogOpen(true);
  }

  function openEdit(level: AcademyLevelResponse) {
    setEditingLevel(level);
    setCode(level.code);
    setLevelName(level.label);
    setSortOrder(String(level.sortOrder));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!selectedAcademy || !levelName.trim()) return;
    setSaving(true);
    try {
      if (editingLevel) {
        await api.academyLevels.update(selectedAcademy, editingLevel.id, {
          label: levelName.trim(),
          sortOrder: sortOrder ? Number(sortOrder) : undefined,
        });
        toast.success("Level updated");
      } else {
        if (!code.trim()) return;
        await api.academyLevels.create(selectedAcademy, {
          code: code.trim(),
          label: levelName.trim(),
          sortOrder: sortOrder ? Number(sortOrder) : undefined,
        });
        toast.success("Level created");
      }
      setDialogOpen(false);
      fetchLevels();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save level";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedAcademy || !deleteTarget) return;
    setDeleting(true);
    try {
      await api.academyLevels.delete(selectedAcademy, deleteTarget.id);
      toast.success(`Level "${deleteTarget.code}" deleted`);
      setDeleteTarget(null);
      fetchLevels();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete level";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="glass h-64 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <Layers className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">
            Select an academy from the sidebar to manage levels
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Levels</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage proficiency levels for your academy (e.g. A1, B2+, Beginner)
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Level
        </Button>
      </div>

      <div className="glass overflow-hidden rounded-xl">
        {loadingLevels ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : levels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="mb-3 h-10 w-10 text-zinc-400" />
            <p className="font-medium text-zinc-500">No levels defined</p>
            <p className="mt-1 text-sm text-zinc-400">
              Add levels like A1, A2, B1, B2, C1, C2 or use your own system
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200/40 dark:border-zinc-700/40">
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Order
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {levels.map((level) => (
                <tr
                  key={level.id}
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-3 text-zinc-300 dark:text-zinc-600">
                    <GripVertical className="h-4 w-4" />
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                      {level.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{level.label}</td>
                  <td className="px-4 py-3 text-zinc-500">{level.sortOrder}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(level)}
                        title="Edit level"
                      >
                        <Pencil className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(level)}
                        title="Delete level"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLevel ? "Edit Level" : "Add Level"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="level-code">Code</Label>
              <Input
                id="level-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. B1+"
                disabled={!!editingLevel}
              />
              {editingLevel && (
                <p className="text-xs text-zinc-400">Code cannot be changed after creation</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="level-name">Name</Label>
              <Input
                id="level-name"
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
                placeholder="e.g. Upper Intermediate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level-order">Sort Order</Label>
              <Input
                id="level-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="e.g. 10"
              />
              <p className="text-xs text-zinc-400">
                Lower numbers appear first
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !(levelName ?? "").trim() || (!editingLevel && !(code ?? "").trim())}
            >
              {saving ? "Saving..." : editingLevel ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Level</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete level{" "}
            <span className="font-semibold">{deleteTarget?.code}</span> ({deleteTarget?.label})?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
