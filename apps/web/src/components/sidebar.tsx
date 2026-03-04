"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import {
  LayoutDashboard,
  Key,
  Calendar,
  FileText,
  Users,
  BookOpen,
  BarChart3,
  Globe,
  ChevronDown,
  Check,
  Plus,
  Loader2,
  Route,
  Dumbbell,
  GraduationCap,
  FolderOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const globalNavItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/usage", label: "Usage", icon: BarChart3 },
];

const academyNavItems = [
  { href: "/dashboard/classes", label: "Classes", icon: Calendar },
  { href: "/dashboard/learning-paths", label: "Learning Paths", icon: Route },
  { href: "/dashboard/lessons", label: "Lessons", icon: BookOpen },
  { href: "/dashboard/exercises", label: "Exercise Bank", icon: Dumbbell },
  { href: "/dashboard/media", label: "Media Library", icon: FolderOpen },
  { href: "/dashboard/students", label: "Students", icon: Users },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
];

const ACADEMY_COLORS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-green-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
  "from-teal-500 to-cyan-600",
];

function getAcademyColor(index: number) {
  return ACADEMY_COLORS[index % ACADEMY_COLORS.length];
}

export function Sidebar() {
  const pathname = usePathname();
  const {
    academies,
    selectedAcademy,
    selectedAcademyData,
    setSelectedAcademy,
    loading,
    refetchAcademies,
  } = useAcademy();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/academies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (res.ok) {
        const created = await res.json();
        setNewName("");
        setCreateOpen(false);
        await refetchAcademies();
        setSelectedAcademy(created.id);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create academy");
      }
    } finally {
      setCreating(false);
    }
  }

  function renderNavItems(items: typeof globalNavItems) {
    return items.map((item) => {
      const Icon = item.icon;
      const isActive =
        item.href === "/dashboard"
          ? pathname === "/dashboard"
          : pathname === item.href || pathname.startsWith(item.href + "/");
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
            isActive
              ? "bg-gradient-accent text-white shadow-md"
              : "text-zinc-500 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-white"
          )}
        >
          <Icon className="h-4 w-4" />
          {item.label}
        </Link>
      );
    });
  }

  const selectedIndex = academies.findIndex((a) => a.id === selectedAcademy);

  return (
    <aside className="glass-strong flex h-full w-64 flex-col border-r border-zinc-200/40 dark:border-zinc-700/40">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-200/40 px-6 dark:border-zinc-700/40">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-accent">
            <Globe className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Langopia</span>
        </Link>
      </div>

      {/* Academy Selector */}
      <div className="border-b border-zinc-200/40 p-3 dark:border-zinc-700/40">
        {loading ? (
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-2.5 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
        ) : academies.length === 0 ? (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-zinc-200 px-3 py-3 text-sm font-medium text-zinc-500 transition-colors hover:border-violet-300 hover:text-violet-600 dark:border-zinc-700 dark:hover:border-violet-600 dark:hover:text-violet-400"
          >
            <Plus className="h-4 w-4" />
            Create your first academy
          </button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white",
                    getAcademyColor(selectedIndex >= 0 ? selectedIndex : 0)
                  )}
                >
                  {selectedAcademyData?.name?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {selectedAcademyData?.name ?? "Select academy"}
                  </p>
                  <p className="truncate text-xs capitalize text-zinc-500">
                    {selectedAcademyData?.roles?.join(", ") ?? ""}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[232px] rounded-xl border-zinc-200/60 p-1.5 shadow-lg dark:border-zinc-700/60"
            >
              {academies.map((academy, i) => (
                <DropdownMenuItem
                  key={academy.id}
                  onClick={() => setSelectedAcademy(academy.id)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5"
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-xs font-bold text-white",
                      getAcademyColor(i)
                    )}
                  >
                    {academy.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {academy.name}
                    </p>
                    <Badge
                      variant="secondary"
                      className="mt-0.5 px-1.5 py-0 text-[10px] capitalize"
                    >
                      {academy.roles?.join(", ") ?? academy.role}
                    </Badge>
                  </div>
                  {academy.id === selectedAcademy && (
                    <Check className="h-4 w-4 shrink-0 text-violet-500" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="mx-1.5 bg-zinc-200/60 dark:bg-zinc-700/60" />
              <DropdownMenuItem
                onClick={() => setCreateOpen(true)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-violet-600 dark:text-violet-400"
              >
                <Plus className="h-4 w-4" />
                Create Academy
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {renderNavItems(globalNavItems)}

        {selectedAcademy && (
          <>
            <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              Academy
            </div>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  >
                    <div className="h-4 w-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-3 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </div>
                ))
              : (
                <>
                  {renderNavItems(academyNavItems)}
                  {selectedAcademyData?.academyType === "academy" &&
                    renderNavItems([{ href: "/dashboard/teachers", label: "Teachers", icon: GraduationCap }])}
                </>
              )}
          </>
        )}
      </nav>

      {/* Bottom badge */}
      <div className="border-t border-zinc-200/40 p-4 dark:border-zinc-700/40">
        <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 px-3 py-2.5 text-center text-xs font-medium text-violet-600 dark:text-violet-400">
          Langopia v2.0
        </div>
      </div>

      {/* Create Academy Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Academy</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Academy name"
              autoFocus
              disabled={creating}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newName.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
