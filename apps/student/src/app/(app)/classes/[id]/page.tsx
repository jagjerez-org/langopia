"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Calendar, Clock, User, FileText } from "lucide-react";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="mx-auto max-w-lg px-3 py-6">
      <Link href="/classes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="rounded-xl bg-card p-6 shadow-sm">
        <h1 className="text-lg font-bold">Class Details</h1>
        <p className="mt-1 text-sm text-muted-foreground">Class ID: {id}</p>

        <div className="mt-6 space-y-4">
          <Link
            href={`/classes/${id}/report`}
            className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm hover:bg-muted"
          >
            <FileText className="h-4 w-4 text-primary" />
            View AI Report
          </Link>
        </div>
      </div>
    </div>
  );
}
