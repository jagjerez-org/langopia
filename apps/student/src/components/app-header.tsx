"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Bell, Home, BookOpen, RefreshCw, Calendar, Compass, User, ChevronDown } from "lucide-react";
import { useAcademy } from "@/lib/academy-context";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useRef } from "react";
import { getApiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LANGUAGES, getLanguageFlag } from "@/lib/languages";
import type { StreakData, StudentProfile } from "@langopia/api-client";

const desktopTabs = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/review", label: "Repaso", icon: RefreshCw },
  { href: "/classes", label: "Clases", icon: Calendar },
  { href: "/explore", label: "Explora", icon: Compass },
];

export function AppHeader() {
  const pathname = usePathname();
  const { academy } = useAcademy();
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const client = getApiClient();
    client.studentApp.streak().then(setStreak).catch(() => {});
    client.studentApp.profile().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentLang = profile?.learningLanguage?.toLowerCase() || "spanish";
  const flag = getLanguageFlag(currentLang);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
      {/* Mobile header */}
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        <div className="w-20">
          {academy?.logoUrl ? (
            <img src={academy.logoUrl} alt={academy.name} className="h-6 w-auto" />
          ) : (
            <span className="font-display text-sm font-bold text-primary">
              {academy?.name || "Langopia"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Flame className="h-5 w-5 text-orange-500 streak-glow" />
          <span className="font-display text-sm font-bold text-orange-600">
            {streak?.currentStreak || 0}
          </span>
        </div>

        <div className="w-20 text-right">
          <button className="rounded-full p-1 text-muted-foreground hover:text-foreground">
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Desktop top nav */}
      <div className="hidden md:flex items-center justify-between px-6 py-2">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          {academy?.logoUrl ? (
            <img src={academy.logoUrl} alt={academy.name} className="h-7 w-auto" />
          ) : (
            <span className="font-display text-lg font-bold text-primary">
              {academy?.name || "Langopia"}
            </span>
          )}
        </div>

        {/* Center: Nav tabs */}
        <nav className="flex items-center gap-1">
          {desktopTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Streak + Language + Avatar */}
        <div className="flex items-center gap-4">
          {/* Streak */}
          <div className="flex items-center gap-1">
            <Flame className="h-5 w-5 text-orange-500 streak-glow" />
            <span className="font-display text-sm font-bold text-orange-600">
              {streak?.currentStreak || 0}
            </span>
          </div>

          {/* Language selector */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-sm hover:bg-secondary transition-colors"
            >
              <span className="text-lg">{flag}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 rounded-xl bg-card p-2 shadow-lg border border-border animate-scale-in min-w-[160px]">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={async () => {
                      setLangOpen(false);
                      if (lang.code === currentLang) return;
                      try {
                        await getApiClient().studentApp.switchLanguage({ learningLanguage: lang.code });
                        setProfile((prev) => prev ? { ...prev, learningLanguage: lang.code } : prev);
                      } catch { /* ignore */ }
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      lang.code === currentLang
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Avatar */}
          <Link
            href="/profile"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary hover:bg-primary/20 transition-colors"
          >
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </Link>
        </div>
      </div>
    </header>
  );
}
