"use client";

import { useAuth } from "@/components/auth-provider";
import { CreditCard, Check, Zap } from "lucide-react";
import { useApiClient } from "@/hooks/use-api-client";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "1 academy",
      "10 rooms/month",
      "5 hours of classes/month",
      "5 AI reports/month",
      "2 students per room",
      "1 GB storage",
    ],
    plan: "free",
  },
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    features: [
      "3 academies",
      "50 rooms/month",
      "25 hours of classes/month",
      "50 AI reports/month",
      "8 students per room",
      "10 GB storage",
    ],
    plan: "starter",
    popular: true,
  },
  {
    name: "Professional",
    price: "$99",
    period: "/month",
    features: [
      "10 academies",
      "200 rooms/month",
      "100 hours of classes/month",
      "200 AI reports/month",
      "25 students per room",
      "50 GB storage",
    ],
    plan: "professional",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: [
      "Unlimited academies",
      "Unlimited rooms",
      "Unlimited class hours",
      "Unlimited reports",
      "50 students per room",
      "500 GB storage",
    ],
    plan: "enterprise",
  },
];

export default function BillingPage() {
  const { user } = useAuth();
  const api = useApiClient();
  const currentPlan = user?.plan ?? "free";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-zinc-500">
          Current plan:{" "}
          <span className="font-semibold capitalize text-violet-600 dark:text-violet-400">
            {currentPlan}
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.plan === currentPlan;
          return (
            <div
              key={plan.plan}
              className={`glass relative rounded-xl p-5 ${
                plan.popular
                  ? "ring-2 ring-violet-500"
                  : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-xs font-medium text-white">
                  Popular
                </div>
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
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className={`mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isCurrent
                    ? "cursor-default bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                    : "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-purple-500"
                }`}
                disabled={isCurrent}
                onClick={async () => {
                  if (isCurrent || plan.plan === "enterprise" || plan.plan === "free") return;
                  try {
                    const { url } = await api.stripe.checkout({ plan: plan.plan });
                    if (url) window.location.href = url;
                  } catch {
                    // ignore
                  }
                }}
              >
                {isCurrent ? "Current Plan" : plan.plan === "enterprise" ? "Contact Us" : "Upgrade"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-zinc-400" />
          <div>
            <h3 className="font-semibold">Payment Method</h3>
            <p className="text-sm text-zinc-500">
              Billing is managed through Stripe. Click upgrade to set up or
              change your payment method.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
