"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Button } from "@/components/ui/button";
import {
  Bell,
  CalendarDays,
  CalendarX,
  FileText,
  CheckCheck,
  Circle,
} from "lucide-react";
import type { MyNotificationsList, MyNotification } from "@langopia/api-client";

const typeConfig: Record<
  string,
  { icon: typeof Bell; color: string; href?: (data: Record<string, string> | null) => string }
> = {
  class_scheduled: {
    icon: CalendarDays,
    color: "from-blue-500 to-cyan-600",
    href: (data) => (data?.classId ? `/app/classes/${data.classId}` : ""),
  },
  class_cancelled: {
    icon: CalendarX,
    color: "from-zinc-500 to-zinc-600",
    href: (data) => (data?.classId ? `/app/classes/${data.classId}` : ""),
  },
  report_ready: {
    icon: FileText,
    color: "from-emerald-500 to-green-600",
    href: (data) => (data?.reportId ? `/app/reports/${data.reportId}` : ""),
  },
};

export default function AppNotificationsPage() {
  const api = useJwtClient();
  const [data, setData] = useState<MyNotificationsList | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.me
      .notifications()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    await api.me.markNotificationRead(id).catch(() => {});
    setData((prev) =>
      prev
        ? {
            ...prev,
            unreadCount: Math.max(0, prev.unreadCount - 1),
            data: prev.data.map((n) =>
              n.id === id ? { ...n, read: true } : n,
            ),
          }
        : prev,
    );
  };

  const markAllRead = async () => {
    await api.me.markAllNotificationsRead().catch(() => {});
    setData((prev) =>
      prev
        ? {
            ...prev,
            unreadCount: 0,
            data: prev.data.map((n) => ({ ...n, read: true })),
          }
        : prev,
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        {data && data.unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllRead}
            className="gap-1.5 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : !data?.data.length ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <Bell className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-muted-foreground">
            No notifications yet
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.data.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={markRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: MyNotification;
  onMarkRead: (id: string) => void;
}) {
  const config = typeConfig[notification.type] ?? {
    icon: Bell,
    color: "from-violet-500 to-purple-600",
  };
  const Icon = config.icon;
  const href = config.href?.(notification.data);

  const timeAgo = formatTimeAgo(notification.createdAt);

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
  };

  const content = (
    <div
      className={`glass group flex items-start gap-3 rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        !notification.read
          ? "ring-1 ring-violet-200 dark:ring-violet-500/30"
          : ""
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${config.color} text-white shadow-sm`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{notification.title}</p>
          {!notification.read && (
            <Circle className="h-2 w-2 shrink-0 fill-violet-500 text-violet-500" />
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {notification.body}
        </p>
        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          {timeAgo}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={handleClick}>
        {content}
      </Link>
    );
  }

  return <div onClick={handleClick}>{content}</div>;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
