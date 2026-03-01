"use client";

import { Badge } from "@/components/ui/badge";
import { SessionStatus } from "@langopia/shared/types";

const statusConfig: Record<SessionStatus, { label: string; className: string }> = {
  [SessionStatus.SCHEDULED]: {
    label: "Scheduled",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  [SessionStatus.IN_PROGRESS]: {
    label: "In Progress",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  [SessionStatus.COMPLETED]: {
    label: "Completed",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
  [SessionStatus.CANCELLED]: {
    label: "Cancelled",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
