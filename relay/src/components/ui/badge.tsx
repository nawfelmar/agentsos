import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  default: "bg-surface-3 text-muted border-line",
  accent: "bg-accent-dim text-accent border-accent/25",
  warn: "bg-warn/10 text-warn border-warn/25",
  danger: "bg-danger/10 text-danger border-danger/25",
  success: "bg-success/10 text-success border-success/25",
  muted: "bg-transparent text-faint border-line",
};

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode
  tone?: keyof typeof tones
  className?: string
}) {
  return (
    <span className={cn("chip border", tones[tone] ?? tones.default, className)}>{children}</span>
  );
}

export function severityTone(severity: string) {
  if (severity === "critical") return "danger" as const;
  if (severity === "high") return "warn" as const;
  if (severity === "medium") return "accent" as const;
  return "muted" as const;
}
