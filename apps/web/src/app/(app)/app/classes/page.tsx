"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronRight, List, Calendar } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import type { MyClassListItem } from "@langopia/api-client";

const statusTabs = [
  { label: "Upcoming", value: "scheduled" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
] as const;

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
};

const CALENDAR_COLORS: Record<string, string> = {
  scheduled: "#3b82f6",
  confirmed: "#22c55e",
  in_progress: "#8b5cf6",
  completed: "#6b7280",
  cancelled: "#ef4444",
};

type ViewMode = "calendar" | "list";

export default function AppClassesPage() {
  const api = useJwtClient();
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("app-classes-view") as ViewMode) || "calendar";
    }
    return "calendar";
  });
  const [activeTab, setActiveTab] = useState("scheduled");

  // List view state
  const [listData, setListData] = useState<MyClassListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Calendar view state
  const [calendarClasses, setCalendarClasses] = useState<MyClassListItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Persist view preference
  useEffect(() => {
    localStorage.setItem("app-classes-view", viewMode);
  }, [viewMode]);

  // List view loading
  const loadList = useCallback(() => {
    setListLoading(true);
    api.me
      .classes({ status: activeTab })
      .then((res) => setListData(res.data))
      .catch(() => {})
      .finally(() => setListLoading(false));
  }, [api, activeTab]);

  useEffect(() => {
    if (viewMode === "list") loadList();
  }, [viewMode, loadList]);

  // Calendar datesSet handler
  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      setCalendarLoading(true);
      api.me
        .classes({
          from: arg.startStr,
          to: arg.endStr,
          limit: 100,
        })
        .then((res) => setCalendarClasses(res.data))
        .catch(() => {})
        .finally(() => setCalendarLoading(false));
    },
    [api],
  );

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      router.push(`/app/classes/${info.event.id}`);
    },
    [router],
  );

  const calendarEvents = calendarClasses.map((c) => ({
    id: c.id,
    title: c.title,
    start: c.scheduledAt,
    end: new Date(
      new Date(c.scheduledAt).getTime() + c.durationMinutes * 60_000,
    ).toISOString(),
    backgroundColor: CALENDAR_COLORS[c.status] ?? "#6b7280",
    borderColor: CALENDAR_COLORS[c.status] ?? "#6b7280",
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Classes</h1>
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("calendar")}
            className={`h-8 px-2.5 ${viewMode === "calendar" ? "bg-white shadow-sm dark:bg-zinc-700" : ""}`}
          >
            <Calendar className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className={`h-8 px-2.5 ${viewMode === "list" ? "bg-white shadow-sm dark:bg-zinc-700" : ""}`}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <div className="glass rounded-2xl p-4">
          {calendarLoading && (
            <div className="absolute right-6 top-6 z-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            </div>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={calendarEvents}
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            height="auto"
            nowIndicator
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
          />
        </div>
      ) : (
        <>
          {/* Status tabs */}
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/60">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Class list */}
          {listLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            </div>
          ) : !listData.length ? (
            <div className="glass flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
              <CalendarDays className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm text-muted-foreground">No classes found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {listData.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/app/classes/${cls.id}`}
                  className="glass group flex items-center justify-between rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{cls.title}</p>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${statusColors[cls.status] ?? ""}`}
                      >
                        {cls.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {new Date(cls.scheduledAt).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      &middot; {cls.durationMinutes}min &middot; {cls.academyName}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
