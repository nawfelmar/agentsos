"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function RightPanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-l border-line bg-[var(--right)] transition-[width,opacity] duration-200 xl:flex",
        open ? "w-[300px] opacity-100" : "w-0 overflow-hidden border-l-0 opacity-0"
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-line px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="relay-focus rounded-md p-1 text-faint hover:bg-surface-2 hover:text-ink"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}
