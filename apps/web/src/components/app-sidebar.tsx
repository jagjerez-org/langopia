"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { useSidebar } from "@/components/sidebar-context";
import {
  Home,
  CalendarDays,
  Users,
  FileText,
  Bell,
  User,
  Globe,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PoweredByBadge } from "@/components/powered-by-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MyAcademyMembership } from "@langopia/api-client";

const navItems = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/classes", label: "Classes", icon: CalendarDays },
  { href: "/app/students", label: "Students", icon: Users },
  { href: "/app/reports", label: "Reports", icon: FileText },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/profile", label: "Profile", icon: User },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const api = useJwtClient();
  const [academies, setAcademies] = useState<MyAcademyMembership[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.me.academies().then(setAcademies).catch(() => {});
    api.me
      .notifications({ limit: 1 })
      .then((res) => setUnreadCount(res.unreadCount))
      .catch(() => {});
  }, [api]);

  function isActive(href: string) {
    return href === "/app"
      ? pathname === "/app"
      : pathname === href || pathname.startsWith(href + "/");
  }

  function renderNavItems() {
    return navItems.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.href);
      const showBadge =
        item.href === "/app/notifications" && unreadCount > 0;

      const link = (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
            collapsed && "justify-center px-2",
            active
              ? "bg-gradient-accent text-white shadow-md"
              : "text-zinc-500 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-white",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="overflow-hidden whitespace-nowrap">
              {item.label}
            </span>
          )}
          {showBadge && (
            <span
              className={cn(
                "flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white",
                collapsed
                  ? "absolute -right-0.5 -top-0.5"
                  : "ml-auto",
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
      );

      if (collapsed) {
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label}
              {showBadge && ` (${unreadCount})`}
            </TooltipContent>
          </Tooltip>
        );
      }

      return link;
    });
  }

  const currentAcademyName =
    academies.length === 1
      ? academies[0].academy.name
      : academies.length > 1
        ? `${academies.length} academies`
        : null;

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "glass-strong flex h-full flex-col border-r border-zinc-200/40 transition-all duration-300 dark:border-zinc-700/40",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {/* Logo */}
        <div className="flex flex-col border-b border-zinc-200/40 px-6 dark:border-zinc-700/40">
          <div
            className={cn(
              "flex h-16 items-center gap-2.5",
              collapsed && "justify-center px-0",
            )}
          >
            <Link href="/app" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-accent">
                <Globe className="h-4 w-4 text-white" />
              </div>
              {!collapsed && (
                <span className="overflow-hidden whitespace-nowrap text-lg font-bold tracking-tight">
                  Langopia
                </span>
              )}
            </Link>
          </div>
          {!collapsed && (
            <div className="pb-2">
              <PoweredByBadge size="sm" />
            </div>
          )}
        </div>

        {/* Academy info (if multiple) */}
        {academies.length > 1 && (
          <div className="border-b border-zinc-200/40 p-2 dark:border-zinc-700/40">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex w-full items-center justify-center rounded-xl py-2 transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
                          {academies.length}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {academies.length} academies
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
                      {academies[0].academy.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        My Academies
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {academies.length} academies
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
                  </button>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[232px] rounded-xl border-zinc-200/60 p-1.5 shadow-lg dark:border-zinc-700/60"
              >
                {academies.map((m) => (
                  <DropdownMenuItem
                    key={m.memberId}
                    className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
                      {m.academy.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {m.academy.name}
                      </p>
                    </div>
                    <Check className="h-4 w-4 shrink-0 text-violet-500" />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Single academy name */}
        {academies.length === 1 && !collapsed && (
          <div className="border-b border-zinc-200/40 px-5 py-3 dark:border-zinc-700/40">
            <p className="truncate text-sm font-semibold">
              {academies[0].academy.name}
            </p>
            <p className="text-xs text-zinc-500">Teacher</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {renderNavItems()}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
