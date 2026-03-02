"use client";

import { signOut, useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, ChevronDown, CreditCard, Settings } from "lucide-react";
import Link from "next/link";

export function Header() {
  const { data: session } = useSession();

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="glass-strong flex h-16 items-center justify-between border-b border-zinc-200/40 px-6 dark:border-zinc-700/40">
      <div />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-all hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
          >
            <Avatar className="h-8 w-8 ring-2 ring-violet-500/20">
              <AvatarImage
                src={session?.user?.image || undefined}
                alt={session?.user?.name || "User"}
              />
              <AvatarFallback className="bg-gradient-accent text-xs font-semibold text-white">
                {initials || "U"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium md:inline">
              {session?.user?.name}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl border-zinc-200/60 p-1.5 shadow-lg dark:border-zinc-700/60">
          <DropdownMenuLabel className="rounded-lg px-3 py-2">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground">
                {session?.user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mx-1.5 bg-zinc-200/60 dark:bg-zinc-700/60" />
          <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-3 py-2">
            <Link href="/dashboard/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-3 py-2">
            <Link href="/dashboard/billing">
              <CreditCard className="mr-2 h-4 w-4" />
              Billing
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="mx-1.5 bg-zinc-200/60 dark:bg-zinc-700/60" />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="cursor-pointer rounded-lg px-3 py-2 text-red-600 focus:text-red-600 dark:text-red-400"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
