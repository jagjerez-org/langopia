"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─── Types ──────────────────────────────────────────────

export interface TreeLesson {
  id: string;
  suggestedTitle: string;
  matchedLesson?: {
    id: string;
    title: string;
    status: string;
    exerciseCount: number;
  } | null;
  matchScore?: number;
}

export interface TreeModule {
  id: string;
  title: string;
  lessons: TreeLesson[];
  collapsed?: boolean;
}

interface CourseTreeBuilderProps {
  modules: TreeModule[];
  onChange: (modules: TreeModule[]) => void;
  readOnly?: boolean;
}

// ─── Sortable Lesson Item ───────────────────────────────

function SortableLessonItem({
  lesson,
  moduleId,
  onRemove,
  readOnly,
}: {
  lesson: TreeLesson;
  moduleId: string;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${moduleId}:${lesson.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const matched = lesson.matchedLesson;
  const hasMatch = !!matched;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-zinc-200/60 bg-white px-3 py-2 dark:border-zinc-700/60 dark:bg-zinc-900"
    >
      {!readOnly && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <BookOpen className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">
          {hasMatch ? matched.title : lesson.suggestedTitle}
        </p>
        {hasMatch && lesson.suggestedTitle !== matched.title && (
          <p className="truncate text-xs text-zinc-400">
            Suggested: {lesson.suggestedTitle}
          </p>
        )}
      </div>
      {hasMatch ? (
        <Badge
          variant="secondary"
          className="shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        >
          matched
        </Badge>
      ) : (
        <Badge
          variant="secondary"
          className="shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        >
          unmatched
        </Badge>
      )}
      {hasMatch && matched.exerciseCount > 0 && (
        <span className="text-xs text-zinc-400">
          {matched.exerciseCount} ex
        </span>
      )}
      {!readOnly && (
        <button
          onClick={onRemove}
          className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Drag Overlay Item ──────────────────────────────────

function DragOverlayItem({ lesson }: { lesson: TreeLesson }) {
  const matched = lesson.matchedLesson;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-violet-300 bg-white px-3 py-2 shadow-lg dark:border-violet-600 dark:bg-zinc-900">
      <GripVertical className="h-3.5 w-3.5 text-violet-400" />
      <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
      <p className="truncate text-sm font-medium">
        {matched ? matched.title : lesson.suggestedTitle}
      </p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function CourseTreeBuilder({
  modules,
  onChange,
  readOnly,
}: CourseTreeBuilderProps) {
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [activeLesson, setActiveLesson] = useState<TreeLesson | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function toggleCollapse(moduleId: string) {
    onChange(
      modules.map((m) =>
        m.id === moduleId ? { ...m, collapsed: !m.collapsed } : m,
      ),
    );
  }

  function startEditModule(mod: TreeModule) {
    setEditingModuleId(mod.id);
    setEditTitle(mod.title);
  }

  function saveEditModule() {
    if (!editingModuleId) return;
    onChange(
      modules.map((m) =>
        m.id === editingModuleId ? { ...m, title: editTitle.trim() || m.title } : m,
      ),
    );
    setEditingModuleId(null);
  }

  function addModule() {
    const newModule: TreeModule = {
      id: `mod-${Date.now()}`,
      title: `Module ${modules.length + 1}`,
      lessons: [],
    };
    onChange([...modules, newModule]);
  }

  function removeModule(moduleId: string) {
    onChange(modules.filter((m) => m.id !== moduleId));
  }

  function removeLesson(moduleId: string, lessonId: string) {
    onChange(
      modules.map((m) =>
        m.id === moduleId
          ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
          : m,
      ),
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const idStr = String(event.active.id);
    const [modId, lessonId] = idStr.split(":");
    const mod = modules.find((m) => m.id === modId);
    const lesson = mod?.lessons.find((l) => l.id === lessonId);
    setActiveLesson(lesson ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLesson(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);
    const [activeModId, activeLessonId] = activeStr.split(":");
    const [overModId, overLessonId] = overStr.split(":");

    if (activeModId === overModId) {
      // Reorder within same module
      const modIdx = modules.findIndex((m) => m.id === activeModId);
      if (modIdx < 0) return;
      const mod = modules[modIdx];
      const oldIdx = mod.lessons.findIndex((l) => l.id === activeLessonId);
      const newIdx = mod.lessons.findIndex((l) => l.id === overLessonId);
      if (oldIdx < 0 || newIdx < 0) return;

      const newLessons = [...mod.lessons];
      const [moved] = newLessons.splice(oldIdx, 1);
      newLessons.splice(newIdx, 0, moved);

      const newModules = [...modules];
      newModules[modIdx] = { ...mod, lessons: newLessons };
      onChange(newModules);
    } else {
      // Move between modules
      const srcIdx = modules.findIndex((m) => m.id === activeModId);
      const dstIdx = modules.findIndex((m) => m.id === overModId);
      if (srcIdx < 0 || dstIdx < 0) return;

      const srcMod = modules[srcIdx];
      const dstMod = modules[dstIdx];
      const lessonIdx = srcMod.lessons.findIndex((l) => l.id === activeLessonId);
      if (lessonIdx < 0) return;

      const movedLesson = srcMod.lessons[lessonIdx];
      const newSrcLessons = srcMod.lessons.filter((l) => l.id !== activeLessonId);
      const overIdx = dstMod.lessons.findIndex((l) => l.id === overLessonId);
      const newDstLessons = [...dstMod.lessons];
      newDstLessons.splice(overIdx >= 0 ? overIdx : newDstLessons.length, 0, movedLesson);

      const newModules = [...modules];
      newModules[srcIdx] = { ...srcMod, lessons: newSrcLessons };
      newModules[dstIdx] = { ...dstMod, lessons: newDstLessons };
      onChange(newModules);
    }
  }

  // All sortable IDs across modules
  const allSortableIds = modules.flatMap((m) =>
    m.lessons.map((l) => `${m.id}:${l.id}`),
  );

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={allSortableIds}
          strategy={verticalListSortingStrategy}
        >
          {modules.map((mod, modIdx) => (
            <div
              key={mod.id}
              className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-700/80 dark:bg-zinc-800/50"
            >
              {/* Module header */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  onClick={() => toggleCollapse(mod.id)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  {mod.collapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {editingModuleId === mod.id ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEditModule();
                        if (e.key === "Escape") setEditingModuleId(null);
                      }}
                    />
                    <button
                      onClick={saveEditModule}
                      className="rounded p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingModuleId(null)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-semibold">
                      {mod.title}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}
                    </span>
                    {!readOnly && (
                      <>
                        <button
                          onClick={() => startEditModule(mod)}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeModule(mod.id)}
                          className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Lessons */}
              {!mod.collapsed && (
                <div className="space-y-1.5 px-3 pb-3">
                  {mod.lessons.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-300 py-4 text-center text-xs text-zinc-400 dark:border-zinc-600">
                      <AlertCircle className="mx-auto mb-1 h-4 w-4" />
                      Drag lessons here or add from the lesson panel
                    </div>
                  ) : (
                    mod.lessons.map((lesson) => (
                      <SortableLessonItem
                        key={lesson.id}
                        lesson={lesson}
                        moduleId={mod.id}
                        onRemove={() => removeLesson(mod.id, lesson.id)}
                        readOnly={readOnly}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </SortableContext>

        <DragOverlay>
          {activeLesson && <DragOverlayItem lesson={activeLesson} />}
        </DragOverlay>
      </DndContext>

      {!readOnly && (
        <Button
          variant="outline"
          size="sm"
          onClick={addModule}
          className="w-full"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Module
        </Button>
      )}

      <div className="text-xs text-zinc-400 text-center">
        {modules.length} module{modules.length !== 1 ? "s" : ""} &middot;{" "}
        {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
