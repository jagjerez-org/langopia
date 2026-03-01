"use client";

import { Badge } from "@/components/ui/badge";
import { ClassroomType } from "@langopia/shared/types";

const typeConfig: Record<ClassroomType, { label: string; className: string }> = {
  [ClassroomType.ONE_TO_ONE]: {
    label: "1:1",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  [ClassroomType.GROUP]: {
    label: "Group",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
};

export function ClassroomTypeBadge({ type }: { type: ClassroomType }) {
  const config = typeConfig[type];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
