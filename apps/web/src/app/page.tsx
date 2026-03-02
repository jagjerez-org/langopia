import Link from "next/link";
import {
  Globe,
  Video,
  BookOpen,
  BarChart3,
  ArrowRight,
  Sparkles,
  Languages,
  Shield,
} from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white dark:bg-zinc-950">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Header */}
      <header className="glass-strong sticky top-0 z-50 border-b border-white/20 dark:border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-accent">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Langopia</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="bg-gradient-accent flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative">
        <section className="flex flex-col items-center px-6 pt-20 text-center md:pt-32">
          <div className="animate-fade-in-up mx-auto max-w-4xl">
            {/* Badge */}
            <div className="glass mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              AI-powered language education platform
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-6xl md:text-7xl">
              The modern platform
              <br />
              for{" "}
              <span className="text-gradient">language academies</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-xl">
              Stream live classes, record sessions, get AI-powered transcriptions
              and progress reports — all in one beautiful platform.
            </p>
          </div>

          <div className="animate-fade-in-up-delay-1 mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="bg-gradient-accent glow-sm flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="glass flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-white/80 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              Log in to your account
            </Link>
          </div>

          {/* Stats bar */}
          <div className="animate-fade-in-up-delay-2 glass mt-20 inline-flex divide-x divide-zinc-200/50 rounded-2xl px-2 py-1 dark:divide-zinc-700/50">
            {[
              { label: "Languages", value: "99+" },
              { label: "Academies", value: "500+" },
              { label: "Classes/day", value: "10K+" },
            ].map((stat) => (
              <div key={stat.label} className="px-6 py-3 text-center md:px-10">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {stat.value}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 pb-32 pt-28">
          <div className="animate-fade-in-up-delay-2 mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Everything your academy needs
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-500 dark:text-zinc-400">
              From live streaming to AI-powered insights, we provide the complete
              toolkit for modern language education.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Video,
                title: "Live streaming",
                desc: "HD video classrooms with chat, screen sharing, and a collaborative whiteboard.",
                gradient: "from-violet-500 to-indigo-500",
              },
              {
                icon: BookOpen,
                title: "AI transcription",
                desc: "Automatic post-class transcription with speaker labels and word-level timestamps.",
                gradient: "from-blue-500 to-cyan-500",
              },
              {
                icon: BarChart3,
                title: "Progress reports",
                desc: "AI-generated CEFR assessments, vocabulary tracking, and personalized learning insights.",
                gradient: "from-emerald-500 to-teal-500",
              },
              {
                icon: Languages,
                title: "99+ languages",
                desc: "Global language support with intelligent detection and CEFR level mapping for every student.",
                gradient: "from-amber-500 to-orange-500",
              },
              {
                icon: Shield,
                title: "Academy management",
                desc: "Multi-tenant platform with role-based access, classroom management, and enrollment tracking.",
                gradient: "from-rose-500 to-pink-500",
              },
              {
                icon: Sparkles,
                title: "Smart analytics",
                desc: "Track vocabulary growth, grammar improvements, and speaking confidence across all sessions.",
                gradient: "from-purple-500 to-violet-500",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="glass group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${feature.gradient} p-2.5`}
                >
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-mesh-subtle pb-24 pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Ready to transform your academy?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-500 dark:text-zinc-400">
              Join hundreds of language academies already using Langopia to
              deliver better learning outcomes.
            </p>
            <Link
              href="/register"
              className="bg-gradient-accent glow-sm mt-8 inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110"
            >
              Get started for free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="glass-strong border-t border-white/20 px-6 py-8 dark:border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-accent">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold">Langopia</span>
          </div>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            &copy; {new Date().getFullYear()} Langopia. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
