"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { initPostHog, posthog } from "@/lib/posthog";

export function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (user?.id) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
        plan: user.plan,
      });
    }
  }, [user]);

  return <>{children}</>;
}
