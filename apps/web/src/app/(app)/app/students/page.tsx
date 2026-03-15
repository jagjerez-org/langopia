"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, ChevronRight, Search } from "lucide-react";
import type { MyStudentListItem } from "@langopia/api-client";

export default function AppStudentsPage() {
  const api = useJwtClient();
  const [students, setStudents] = useState<MyStudentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api.me
      .students({ search: search || undefined })
      .then((res) => {
        setStudents(res.data);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, search]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">My Students</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : !students.length ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <Users className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-muted-foreground">No students found</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{total} students</p>
          <div className="space-y-2">
            {students.map((s) => (
              <Link
                key={s.id}
                href={`/app/students/${s.id}`}
                className="glass group flex items-center justify-between rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{s.name}</p>
                    {s.cefrEstimate && (
                      <Badge variant="secondary" className="text-[10px]">
                        {s.cefrEstimate}
                      </Badge>
                    )}
                    {!s.isActive && (
                      <Badge variant="outline" className="text-[10px] text-zinc-400">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {s.email} &middot; {s.academyName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.totalClasses} classes
                    {s.lastClassAt && (
                      <>
                        {" "}&middot; Last:{" "}
                        {new Date(s.lastClassAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </>
                    )}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
