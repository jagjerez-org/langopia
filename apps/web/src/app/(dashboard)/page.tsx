import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UserRole } from "@langopia/shared/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardMetrics } from "@/components/dashboard-metrics";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back, {session.user.name}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your {role === UserRole.ADMIN ? "academy" : "activity"}.
        </p>
      </div>

      <DashboardMetrics role={role} />
    </div>
  );
}
