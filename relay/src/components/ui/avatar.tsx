import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  color,
  size = "md",
  status,
}: {
  name: string
  color?: string
  size?: "sm" | "md" | "lg"
  status?: string
}) {
  const dims = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-medium text-white/95",
          dims
        )}
        style={{ background: color ?? "#4a5568" }}
        title={name}
      >
        {initials(name)}
      </span>
      {status && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface",
            status === "online" && "bg-success",
            status === "busy" && "bg-danger",
            status === "away" && "bg-warn",
            status === "offline" && "bg-faint"
          )}
        />
      )}
    </span>
  );
}
