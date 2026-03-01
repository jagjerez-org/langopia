"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserRole, AcademyPlan } from "@langopia/shared/types";
import { CreditCard, ExternalLink, CheckCircle2 } from "lucide-react";

interface AcademyData {
  id: string;
  name: string;
  plan: AcademyPlan;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  timezone: string;
}

const PLAN_INFO: Record<
  AcademyPlan,
  { name: string; description: string; features: string[] }
> = {
  [AcademyPlan.FREE]: {
    name: "Free",
    description: "Get started with basic features",
    features: ["1 classroom", "5 sessions/month", "Basic transcription"],
  },
  [AcademyPlan.STARTER]: {
    name: "Starter",
    description: "For small academies",
    features: [
      "5 classrooms",
      "50 sessions/month",
      "AI class reports",
      "Progress tracking",
    ],
  },
  [AcademyPlan.PROFESSIONAL]: {
    name: "Professional",
    description: "For growing academies",
    features: [
      "Unlimited classrooms",
      "Unlimited sessions",
      "AI class reports",
      "Progress tracking",
      "Priority support",
    ],
  },
  [AcademyPlan.ENTERPRISE]: {
    name: "Enterprise",
    description: "For large organizations",
    features: [
      "Everything in Professional",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee",
    ],
  },
};

const planOrder = [
  AcademyPlan.FREE,
  AcademyPlan.STARTER,
  AcademyPlan.PROFESSIONAL,
  AcademyPlan.ENTERPRISE,
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [academy, setAcademy] = useState<AcademyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const billingStatus = searchParams.get("billing");
  const role = session?.user?.role as UserRole | undefined;
  const isAdmin = role === UserRole.ADMIN;

  useEffect(() => {
    if (!session?.user?.academyId) {
      setLoading(false);
      return;
    }
    fetch(`/api/academies/${session.user.academyId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAcademy(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.user?.academyId]);

  async function handleManageBilling() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpgrade(priceId: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your academy settings and billing.
        </p>
      </div>

      {billingStatus === "success" && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="flex items-center gap-2 py-3">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-800 dark:text-green-200">
              Subscription updated successfully!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Academy Info */}
      {academy && (
        <Card>
          <CardHeader>
            <CardTitle>Academy</CardTitle>
            <CardDescription>{academy.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Timezone:</span> {academy.timezone}
            </p>
            <p>
              <span className="font-medium">Current Plan:</span>{" "}
              <Badge variant="secondary" className="ml-1">
                {PLAN_INFO[academy.plan]?.name ?? academy.plan}
              </Badge>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Billing Section - Admin only */}
      {isAdmin && academy && (
        <>
          <Separator />

          <div>
            <h2 className="text-xl font-bold">Billing</h2>
            <p className="text-sm text-muted-foreground">
              Manage your subscription and payment methods.
            </p>
          </div>

          {/* Manage existing subscription */}
          {academy.stripeSubscriptionId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription
                </CardTitle>
                <CardDescription>
                  You are on the{" "}
                  <span className="font-medium">
                    {PLAN_INFO[academy.plan]?.name}
                  </span>{" "}
                  plan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleManageBilling}
                  disabled={actionLoading}
                  variant="outline"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {actionLoading ? "Loading..." : "Manage Subscription"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Plan selection */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {planOrder.map((plan) => {
              const info = PLAN_INFO[plan];
              const isCurrent = academy.plan === plan;
              return (
                <Card
                  key={plan}
                  className={isCurrent ? "border-primary" : ""}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {info.name}
                      {isCurrent && (
                        <Badge variant="default">Current</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{info.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-1 text-sm">
                      {info.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!isCurrent && plan !== AcademyPlan.FREE && (
                      <Button
                        className="w-full"
                        variant={
                          plan === AcademyPlan.PROFESSIONAL
                            ? "default"
                            : "outline"
                        }
                        disabled={actionLoading}
                        onClick={() => handleUpgrade(plan)}
                      >
                        {actionLoading ? "Loading..." : "Upgrade"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
