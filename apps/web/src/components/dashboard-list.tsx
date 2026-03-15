import { ChevronRight, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ── Page Header ─────────────────────────────────────────── */

interface PageHeaderProps {
  title: string;
  subtitle: string;
  extra?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, extra, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        {extra}
      </div>
      {action}
    </div>
  );
}

/* ── Page Skeleton ───────────────────────────────────────── */

interface PageSkeletonProps {
  maxWidth?: string;
  /** Height of the main content area (e.g. "h-[600px]" for calendar) */
  contentHeight?: string;
  rows?: number;
}

export function PageSkeleton({ maxWidth = "max-w-6xl", contentHeight, rows = 3 }: PageSkeletonProps) {
  return (
    <div className={`mx-auto ${maxWidth} space-y-6`}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-200/60 dark:bg-zinc-700/40" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-zinc-200/40 dark:bg-zinc-700/30" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-700/40" />
      </div>
      {contentHeight ? (
        <div className={`glass ${contentHeight} animate-pulse rounded-xl`} />
      ) : (
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="glass h-20 animate-pulse rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Empty State ─────────────────────────────────────────── */

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
      <Icon className="mb-3 h-10 w-10 text-zinc-400" />
      <p className="font-medium text-zinc-500">{title}</p>
      <p className="mt-1 text-sm text-zinc-400">{description}</p>
      {action}
    </div>
  );
}

/* ── List Item ───────────────────────────────────────────── */

interface ListItemProps {
  onClick?: () => void;
  /** Avatar: icon, text initial, or custom ReactNode */
  avatar?: React.ReactNode;
  /** Primary line (title) */
  title: React.ReactNode;
  /** Inline badges next to title */
  badges?: React.ReactNode;
  /** Secondary info line */
  subtitle?: React.ReactNode;
  /** Third line (optional, e.g. progress bar) */
  extra?: React.ReactNode;
  /** Action buttons (right side) */
  actions?: React.ReactNode;
  /** Show chevron right arrow */
  chevron?: boolean;
  /** Additional className on the container */
  className?: string;
  /** Expandable content rendered below the main row */
  children?: React.ReactNode;
}

export function ListItem({
  onClick,
  avatar,
  title,
  badges,
  subtitle,
  extra,
  actions,
  chevron = true,
  className = "",
  children,
}: ListItemProps) {
  return (
    <div
      className={`glass rounded-xl ${children ? "overflow-hidden" : "p-4"} transition-all hover:shadow-md ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      <div
        onClick={onClick}
        className={`flex items-center gap-4 ${children ? "p-4" : ""}`}
      >
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {typeof title === "string" ? (
              <p className="truncate font-medium">{title}</p>
            ) : (
              title
            )}
            {badges}
          </div>
          {subtitle && (
            <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
              {subtitle}
            </div>
          )}
          {extra}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
        {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
      </div>
      {children}
    </div>
  );
}

/* ── Gradient Avatar ─────────────────────────────────────── */

interface GradientAvatarProps {
  children: React.ReactNode;
}

export function GradientAvatar({ children }: GradientAvatarProps) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white">
      {children}
    </div>
  );
}

/* ── Icon Avatar ─────────────────────────────────────────── */

interface IconAvatarProps {
  icon: LucideIcon;
}

export function IconAvatar({ icon: Icon }: IconAvatarProps) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
      <Icon className="h-5 w-5 text-zinc-500" />
    </div>
  );
}

/* ── Primary Action Button ───────────────────────────────── */

interface PrimaryActionProps {
  onClick?: () => void;
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
}

export function PrimaryAction({ onClick, children, type = "button", disabled }: PrimaryActionProps) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="bg-gradient-accent text-white shadow-md rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:shadow-lg hover:brightness-110"
    >
      {children}
    </Button>
  );
}
