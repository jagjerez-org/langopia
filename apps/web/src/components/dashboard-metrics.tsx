"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserRole } from "@langopia/shared/types";

function DashboardCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

export function DashboardMetrics({ role }: { role: UserRole }) {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const val = (key: string) => {
    if (!stats) return "--";
    const v = stats[key];
    if (v === null || v === undefined) return "--";
    return String(v);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {role === UserRole.ADMIN && (
        <>
          <DashboardCard
            title="Total Users"
            value={val("totalUsers")}
            description="Active users in your academy"
          />
          <DashboardCard
            title="Active Classrooms"
            value={val("activeClassrooms")}
            description="Currently running classrooms"
          />
          <DashboardCard
            title="Sessions Today"
            value={val("sessionsToday")}
            description="Scheduled for today"
          />
          <DashboardCard
            title="Reports Generated"
            value={val("reportsThisMonth")}
            description="This month"
          />
        </>
      )}

      {role === UserRole.TEACHER && (
        <>
          <DashboardCard
            title="My Classrooms"
            value={val("myClassrooms")}
            description="Active classrooms"
          />
          <DashboardCard
            title="Upcoming Sessions"
            value={val("upcomingSessions")}
            description="This week"
          />
          <DashboardCard
            title="Students"
            value={val("totalStudents")}
            description="Total enrolled students"
          />
          <DashboardCard
            title="Reports"
            value={val("pendingReports")}
            description="Pending review"
          />
        </>
      )}

      {role === UserRole.STUDENT && (
        <>
          <DashboardCard
            title="My Classes"
            value={val("myClasses")}
            description="Enrolled classrooms"
          />
          <DashboardCard
            title="Next Session"
            value={val("nextSession")}
            description="Upcoming class"
          />
          <DashboardCard
            title="Progress"
            value={val("cefrLevel")}
            description="Current CEFR level"
          />
          <DashboardCard
            title="Reports"
            value={val("reportsCount")}
            description="Progress reports"
          />
        </>
      )}
    </div>
  );
}
