"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { initPostHog, posthog } from "@/lib/posthog";

export function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
        plan: session.user.plan,
      });
    }
  }, [session?.user]);

  return <>{children}</>;
}
