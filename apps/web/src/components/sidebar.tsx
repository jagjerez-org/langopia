"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  School,
  BookOpen,
  BarChart3,
  Settings,
  GraduationCap,
} from "lucide-react";
import { UserRole } from "@langopia/shared/types";

interface SidebarProps {
  role: UserRole;
}

const navItems = {
  [UserRole.ADMIN]: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/academies", label: "Academies", icon: School },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  [UserRole.TEACHER]: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/classroom", label: "Classrooms", icon: BookOpen },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  [UserRole.STUDENT]: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/classroom", label: "My Classes", icon: GraduationCap },
    { href: "/reports", label: "My Progress", icon: BarChart3 },
  ],
};

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const items = navItems[role] || navItems[UserRole.STUDENT];

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="text-xl font-bold">
          Langopia
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
