"use client";

import { useAuth } from "@/components/auth-provider";
import { CreditCard, Check, ExternalLink } from "lucide-react";
import { useApiClient } from "@/hooks/use-api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    name: "Free",
    price: "€0",
    period: "forever",
    features: [
      "1 academy",
      "10 classes/month",
      "10 hours of classes/month",
      "Unlimited reports",
      "2 students per room",
      "5 GB storage",
      "50K AI tokens/month",
      "10K TTS chars/month",
    ],
    plan: "free",
  },
  {
    name: "Starter",
    price: "€29",
    period: "/month",
    features: [
      "3 academies",
      "50 classes/month",
      "25 hours of classes/month",
      "Unlimited reports",
      "8 students per room",
      "10 GB storage",
      "500K AI tokens/month",
      "100K TTS chars/month",
    ],
    plan: "starter",
    popular: true,
  },
  {
    name: "Professional",
    price: "€99",
    period: "/month",
    features: [
      "10 academies",
      "200 classes/month",
      "100 hours of classes/month",
      "Unlimited reports",
      "25 students per room",
      "50 GB storage",
      "2M AI tokens/month",
      "500K TTS chars/month",
      "Integrations",
    ],
    plan: "professional",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: [
      "Unlimited academies",
      "Unlimited classes",
      "Unlimited class hours",
      "Unlimited reports",
      "50 students per room",
      "500 GB storage",
      "Unlimited AI tokens",
      "Unlimited TTS chars",
      "Integrations",
      "Academy Landing",
    ],
    plan: "enterprise",
  },
];

export default function BillingPage() {
  const { user } = useAuth();
  const api = useApiClient();
  const currentPlan = user?.plan ?? "free";

  async function handleUpgrade(plan: string) {
    if (plan === "enterprise" || plan === "free") return;
    try {
      const { url } = await api.stripe.checkout({ plan });
      if (url) window.location.href = url;
    } catch {
      // ignore
    }
  }

  async function handlePortal() {
    try {
      const { url } = await api.stripe.portal();
      if (url) window.location.href = url;
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Current plan:{" "}
            <span className="font-semibold capitalize text-violet-600 dark:text-violet-400">
              {currentPlan}
            </span>
          </p>
        </div>
        {currentPlan !== "free" && (
          <Button variant="outline" onClick={handlePortal}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Manage Subscription
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.plan === currentPlan;
          return (
            <div
              key={plan.plan}
              className={`glass-subtle relative rounded-xl border p-5 transition-all ${
                plan.popular
                  ? "border-violet-500 ring-2 ring-violet-500/20"
                  : "border-zinc-200/40 dark:border-zinc-700/40"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-violet-600 text-white">
                  Popular
                </Badge>
              )}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-sm text-zinc-500">{plan.period}</span>
              </div>
              <ul className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"
                  >
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className={`mt-5 w-full ${
                  isCurrent
                    ? ""
                    : "bg-gradient-accent text-white"
                }`}
                variant={isCurrent ? "secondary" : "default"}
                disabled={isCurrent}
                onClick={() => handleUpgrade(plan.plan)}
              >
                {isCurrent
                  ? "Current Plan"
                  : plan.plan === "enterprise"
                    ? "Contact Us"
                    : "Upgrade"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-5 dark:border-zinc-700/40">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-zinc-400" />
          <div>
            <h3 className="font-semibold">Payment Method</h3>
            <p className="text-sm text-zinc-500">
              Billing is managed through Stripe.{" "}
              {currentPlan !== "free"
                ? "Click 'Manage Subscription' to update your payment method."
                : "Click upgrade to set up your payment method."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
