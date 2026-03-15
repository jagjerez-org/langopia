"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, RefreshCw, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/study", label: "Cursos", icon: BookOpen },
  { href: "/review", label: "Repaso", icon: RefreshCw },
  { href: "/classes", label: "Clases", icon: Calendar },
  { href: "/profile", label: "Perfil", icon: User },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/90 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around px-2 pt-2">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors",
                isActive ? "text-primary font-medium" : "text-muted-foreground",
              )}
            >
              <tab.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
