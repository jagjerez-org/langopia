const sizes = {
  sm: { logo: "text-sm", text: "text-[8px]", by: "text-[8px]", gap: "gap-1" },
  md: { logo: "text-base", text: "text-[10px]", by: "text-[9px]", gap: "gap-1.5" },
  lg: { logo: "text-lg", text: "text-xs", by: "text-[10px]", gap: "gap-1.5" },
} as const;

export function PoweredByBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = sizes[size];
  return (
    <div className={`flex items-center ${s.gap}`}>
      <span className={`${s.by} font-light text-muted-foreground`}>by</span>
      <span
        className={`${s.logo} font-bold`}
        style={{
          background: "linear-gradient(135deg, #e8755a, #d4547a, #b44fa0)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        A
      </span>
      <span
        className={`${s.text} font-semibold tracking-[0.18em]`}
        style={{
          background: "linear-gradient(135deg, #c4587a, #9a6aaf, #7a7fc4)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        AMERICAN LANGUAGE ACADEMY
      </span>
    </div>
  );
}
