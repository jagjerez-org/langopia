import {
  Globe,
  Video,
  BookOpen,
  BarChart3,
  ArrowRight,
  Sparkles,
  Languages,
  Shield,
  Building2,
  CalendarCheck,
  BrainCircuit,
  Check,
  ChevronDown,
  Smartphone,
} from "lucide-react";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:2500";

/* ── Plan data ── */

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    description: "Get started with the basics",
    cta: "Start free",
    href: `${appUrl}/register`,
    featured: false,
    features: [
      "1 academy",
      "10 classes/month",
      "5 class hours/month",
      "5 AI reports/month",
      "Up to 2 students/class",
      "1 GB storage",
    ],
  },
  {
    name: "Starter",
    price: "$19",
    period: "/mo",
    description: "For freelance teachers",
    cta: "Start free trial",
    href: `${appUrl}/register`,
    featured: false,
    features: [
      "3 academies",
      "50 classes/month",
      "25 class hours/month",
      "50 AI reports/month",
      "Up to 8 students/class",
      "10 GB storage",
    ],
  },
  {
    name: "Professional",
    price: "$49",
    period: "/mo",
    description: "For growing academies",
    cta: "Start free trial",
    href: `${appUrl}/register`,
    featured: true,
    features: [
      "10 academies",
      "200 classes/month",
      "100 class hours/month",
      "200 AI reports/month",
      "Up to 25 students/class",
      "50 GB storage",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    cta: "Contact us",
    href: `mailto:hello@langopia.com`,
    featured: false,
    features: [
      "Unlimited academies",
      "Unlimited classes",
      "Unlimited class hours",
      "Unlimited AI reports",
      "Up to 50 students/class",
      "500 GB storage",
    ],
  },
];

const faqs = [
  {
    q: "Which languages does Langopia support?",
    a: "Langopia supports 99+ languages. Our AI transcription and analysis pipeline automatically detects the language being spoken and provides CEFR-level assessments accordingly.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes! Every account starts on the Free plan with no credit card required. You can upgrade to Starter or Professional at any time to unlock more classes, reports, and storage.",
  },
  {
    q: "Do my students need accounts?",
    a: "No. Students join classes via a shared link and identify themselves with name and email — no registration required. Their progress is tracked automatically.",
  },
  {
    q: "Is there a mobile app?",
    a: "Yes! Our Expo-based mobile app is available for iOS and Android. Students and teachers can view classes, practice exercises offline, receive push notifications, and review reports on the go.",
  },
  {
    q: "How does AI reporting work?",
    a: "After each class, Langopia automatically transcribes the session and uses GPT-4o to generate per-student reports including vocabulary analysis, grammar corrections, speaking metrics, and personalized homework suggestions.",
  },
  {
    q: "Can I use Langopia for group classes?",
    a: "Absolutely. Group classes support multiple students with individual metrics. Each student's speaking time, vocabulary, and grammar are tracked separately even in group settings.",
  },
  {
    q: "What happens to my recordings?",
    a: "Recordings are stored securely in S3-compatible storage and are only accessible to your academy. You can delete recordings at any time from the media library.",
  },
  {
    q: "Can I integrate Langopia with my existing systems?",
    a: "Yes. Every paid plan includes full REST API access with API key authentication. You can create classes, manage students, and pull reports programmatically.",
  },
];

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
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#how-it-works" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              How it works
            </a>
            <a href="#features" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              Features
            </a>
            <a href="#pricing" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              href={`${appUrl}/login`}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              Log in
            </a>
            <a
              href={`${appUrl}/register`}
              className="bg-gradient-accent flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
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
            <a
              href={`${appUrl}/register`}
              className="bg-gradient-accent glow-sm flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={`${appUrl}/login`}
              className="glass flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-white/80 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              Log in to your account
            </a>
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

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-5xl px-6 pb-24 pt-28">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-500 dark:text-zinc-400">
              Get started in minutes — no technical setup required.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: 1,
                icon: Building2,
                title: "Create your academy",
                desc: "Sign up, name your academy, and invite your teachers. Individual tutors can go solo with our freelance mode.",
                gradient: "from-violet-500 to-indigo-500",
              },
              {
                step: 2,
                icon: CalendarCheck,
                title: "Schedule classes",
                desc: "Create classes via the dashboard or API. Students and teachers get personalized join links — no accounts needed for students.",
                gradient: "from-blue-500 to-cyan-500",
              },
              {
                step: 3,
                icon: BrainCircuit,
                title: "Get AI insights",
                desc: "After each class, our AI transcribes the session and generates per-student reports with vocabulary, grammar, and homework suggestions.",
                gradient: "from-emerald-500 to-teal-500",
              },
            ].map((item) => (
              <div key={item.step} className="glass group rounded-2xl p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md"
                  style={{
                    backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))`,
                  }}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient}`}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="mb-3 text-sm font-bold text-violet-500">
                  Step {item.step}
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 pb-32 pt-4">
          <div className="mb-16 text-center">
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
                icon: Smartphone,
                title: "Mobile app",
                desc: "Native iOS & Android app for students and teachers. Practice exercises offline, get push notifications.",
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

        {/* Pricing */}
        <section id="pricing" className="bg-mesh-subtle pb-28 pt-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-zinc-500 dark:text-zinc-400">
                Start free, upgrade as you grow. No hidden fees, cancel anytime.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                    plan.featured
                      ? "glass-strong ring-2 ring-violet-500/50 dark:ring-violet-400/40"
                      : "glass"
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-accent px-3 py-0.5 text-xs font-semibold text-white shadow-md">
                      Most popular
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {plan.name}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {plan.description}
                    </p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                          {plan.period}
                        </span>
                      )}
                    </div>
                  </div>
                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={plan.href}
                    className={`block rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-all ${
                      plan.featured
                        ? "bg-gradient-accent glow-sm text-white shadow-md hover:shadow-lg hover:brightness-110"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {plan.cta}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-6 pb-28 pt-20">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Frequently asked questions
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-500 dark:text-zinc-400">
              Everything you need to know about Langopia.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="glass group rounded-xl transition-all [&[open]]:shadow-md"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 text-sm font-semibold text-zinc-900 dark:text-white [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-zinc-200/40 px-6 pb-5 pt-3 text-sm leading-relaxed text-zinc-500 dark:border-zinc-700/40 dark:text-zinc-400">
                  {faq.a}
                </div>
              </details>
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
            <a
              href={`${appUrl}/register`}
              className="bg-gradient-accent glow-sm mt-8 inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110"
            >
              Get started for free
              <ArrowRight className="h-4 w-4" />
            </a>
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
