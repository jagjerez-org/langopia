"use client";

import { useEffect, useState, useCallback } from "react";
import { Layers, Plus, Pencil, Trash2 } from "lucide-react";
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
import { PageHeader, PageSkeleton, EmptyState, ListItem, GradientAvatar, PrimaryAction } from "@/components/dashboard-list";
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
    return <PageSkeleton />;
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState icon={Layers} title="No academy selected" description="Select an academy from the sidebar to manage levels" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Levels"
        subtitle="Manage proficiency levels for your academy (e.g. A1, B2+, Beginner)"
        action={
          <PrimaryAction onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Level
          </PrimaryAction>
        }
      />

      {loadingLevels ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass h-20 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : levels.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No levels defined"
          description="Add levels like A1, A2, B1, B2, C1, C2 or use your own system"
          action={
            <div className="mt-4">
              <PrimaryAction onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add Level
              </PrimaryAction>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {levels.map((level) => (
            <ListItem
              key={level.id}
              chevron={false}
              avatar={<GradientAvatar>{level.code}</GradientAvatar>}
              title={level.label}
              badges={
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  Order: {level.sortOrder}
                </span>
              }
              actions={
                <>
                  <button
                    onClick={() => openEdit(level)}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                    title="Edit level"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(level)}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    title="Delete level"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

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
