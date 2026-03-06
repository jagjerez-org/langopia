"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPublicClient } from "@/hooks/use-api-client";
import type { AcademyLandingResponse, AcademyPlanResponse } from "@langopia/api-client";

type Status = "loading" | "ready" | "not-found" | "error";

export default function AcademyLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [landing, setLanding] = useState<AcademyLandingResponse | null>(null);
  const [plans, setPlans] = useState<AcademyPlanResponse[]>([]);

  useEffect(() => {
    if (!slug) return;

    const client = createPublicClient();
    let cancelled = false;

    async function load() {
      try {
        const landingData = await client.academyLanding.getPublic(slug);
        if (cancelled) return;
        setLanding(landingData);

        if (landingData.showPlans) {
          const plansData = await client.academyPlans.listPublic(slug);
          if (cancelled) return;
          setPlans(plansData.filter((p) => p.isActive));
        }

        setStatus("ready");
      } catch (err: unknown) {
        if (cancelled) return;
        const is404 =
          err instanceof Error && (err.message.includes("404") || err.message.includes("Not Found"));
        setStatus(is404 ? "not-found" : "error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (status === "loading") {
    return <LoadingState />;
  }

  if (status === "not-found") {
    return <NotFoundState />;
  }

  if (status === "error" || !landing) {
    return <ErrorState />;
  }

  const primary = landing.primaryColor || "#6366f1";
  const bg = landing.backgroundColor || "#ffffff";

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg }}>
      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          {landing.logoUrl ? (
            <img src={landing.logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
          ) : (
            <div
              className="text-xl font-bold tracking-tight"
              style={{ color: primary }}
            >
              {slug}
            </div>
          )}
          {landing.showTeacherApplication && (
            <a
              href={`/academy/${slug}/apply`}
              className="rounded-full px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              Become a Teacher
            </a>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            background: `radial-gradient(circle at 30% 40%, ${primary}, transparent 60%), radial-gradient(circle at 70% 60%, ${primary}, transparent 60%)`,
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <div className={`grid gap-12 items-center ${landing.heroImageUrl ? "lg:grid-cols-2" : ""}`}>
            <div className={landing.heroImageUrl ? "" : "text-center max-w-3xl mx-auto"}>
              <h1
                className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1]"
                style={{ color: primary }}
              >
                {landing.heroTitle || "Welcome"}
              </h1>
              {landing.heroDescription && (
                <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-xl">
                  {landing.heroDescription}
                </p>
              )}
              {landing.showPlans && plans.length > 0 && (
                <a
                  href="#plans"
                  className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
                  style={{ backgroundColor: primary }}
                >
                  View Plans
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </a>
              )}
            </div>
            {landing.heroImageUrl && (
              <div className="relative">
                <div
                  className="absolute -inset-4 rounded-2xl opacity-20 blur-2xl"
                  style={{ backgroundColor: primary }}
                />
                <img
                  src={landing.heroImageUrl}
                  alt="Hero"
                  className="relative w-full rounded-2xl shadow-2xl object-cover aspect-[4/3]"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Plans Section */}
      {landing.showPlans && plans.length > 0 && (
        <section id="plans" className="py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center mb-14">
              <h2
                className="text-3xl font-bold tracking-tight sm:text-4xl"
                style={{ color: primary }}
              >
                Choose Your Plan
              </h2>
              <p className="mt-3 text-gray-500 text-lg">
                Find the plan that fits your learning goals.
              </p>
            </div>
            <div
              className={`grid gap-8 ${
                plans.length === 1
                  ? "max-w-md mx-auto"
                  : plans.length === 2
                    ? "max-w-3xl mx-auto md:grid-cols-2"
                    : "md:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {plans.map((plan, i) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  slug={slug}
                  primaryColor={primary}
                  featured={plans.length >= 3 && i === 1}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Teacher Application CTA */}
      {landing.showTeacherApplication && (
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-6">
            <div
              className="rounded-2xl p-10 lg:p-14 text-center text-white"
              style={{
                background: `linear-gradient(135deg, ${primary}, ${adjustColor(primary, -30)})`,
              }}
            >
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Join Our Teaching Team
              </h2>
              <p className="mt-4 text-white/80 text-lg max-w-2xl mx-auto">
                Share your expertise and help students reach their language goals. Apply to become a teacher today.
              </p>
              <a
                href={`/academy/${slug}/apply`}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
                style={{ color: primary }}
              >
                Apply Now
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-gray-400">
          Powered by Langopia
        </div>
      </footer>
    </div>
  );
}

/* ─── Plan Card ──────────────────────────────────────────── */

function PlanCard({
  plan,
  slug,
  primaryColor,
  featured,
}: {
  plan: AcademyPlanResponse;
  slug: string;
  primaryColor: string;
  featured: boolean;
}) {
  const features = buildFeatureList(plan);
  const periodicityLabel =
    plan.periodicity === "monthly" ? "/mo" : plan.periodicity === "annual" ? "/yr" : `/${plan.periodicity}`;

  return (
    <div
      className={`relative flex flex-col rounded-2xl bg-white p-8 shadow-sm transition-all hover:shadow-lg ${
        featured ? "ring-2 scale-[1.03]" : "ring-1 ring-gray-200"
      }`}
      style={featured ? { boxShadow: `0 0 0 2px ${primaryColor}` } : undefined}
    >
      {featured && (
        <div
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Most Popular
        </div>
      )}
      <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight" style={{ color: primaryColor }}>
          {plan.currency === "EUR" ? "\u20AC" : plan.currency === "USD" ? "$" : plan.currency}
          {plan.price}
        </span>
        <span className="text-sm text-gray-500">{periodicityLabel}</span>
      </div>

      {features.length > 0 && (
        <ul className="mt-8 flex flex-col gap-3 flex-1">
          {features.map((f, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-600">
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0"
                style={{ color: primaryColor }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
      )}

      <a
        href={`/academy/${slug}/subscribe?plan=${plan.id}`}
        className={`mt-8 block rounded-full py-3 text-center text-sm font-semibold transition-all hover:scale-[1.02] ${
          featured ? "text-white shadow-lg" : "ring-1 ring-inset"
        }`}
        style={
          featured
            ? { backgroundColor: primaryColor }
            : { color: primaryColor, border: `1px solid ${primaryColor}` }
        }
      >
        Subscribe
      </a>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────── */

function buildFeatureList(plan: AcademyPlanResponse): string[] {
  const features: string[] = [];
  const l = plan.limits;
  if (!l) return features;

  if (l.accessIndividualClasses) {
    features.push(
      l.maxIndividualClasses
        ? `${l.maxIndividualClasses} individual classes${l.limitPeriod ? ` / ${l.limitPeriod}` : ""}`
        : "Unlimited individual classes"
    );
  }
  if (l.accessGroupClasses) {
    features.push(
      l.maxGroupClasses
        ? `${l.maxGroupClasses} group classes${l.limitPeriod ? ` / ${l.limitPeriod}` : ""}`
        : "Unlimited group classes"
    );
  }
  if (l.maxBookings) {
    features.push(`Up to ${l.maxBookings} active bookings`);
  }
  if (l.maxCancellations) {
    features.push(`${l.maxCancellations} cancellations allowed`);
  }
  if (l.accessLearningPath) {
    features.push("Personalized learning paths");
  }
  if (l.accessAiChat) {
    features.push("AI conversation practice");
  }

  return features;
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ─── State Screens ──────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-500" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-extrabold text-gray-200">404</h1>
        <p className="mt-4 text-lg text-gray-600">Academy not found</p>
        <p className="mt-2 text-sm text-gray-400">
          The academy you are looking for does not exist or is not published.
        </p>
      </div>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-700">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-400">
          We could not load this page. Please try again later.
        </p>
      </div>
    </div>
  );
}
