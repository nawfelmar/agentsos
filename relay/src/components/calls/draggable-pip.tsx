"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Pos = { x: number; y: number };

/**
 * Draggable picture-in-picture shell. Position is relative to the offsetParent
 * (the call stage). Clamped so the tile stays inside the stage.
 */
export function DraggablePip({
  children,
  className,
  width = 200,
  height = 128,
}: {
  children: React.ReactNode
  className?: string
  width?: number
  height?: number
}) {
  const stageRef = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const drag = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null);

  const clamp = useCallback(
    (x: number, y: number, parent: HTMLElement): Pos => {
      const maxX = Math.max(8, parent.clientWidth - width - 8);
      const maxY = Math.max(8, parent.clientHeight - height - 8);
      return {
        x: Math.min(maxX, Math.max(8, x)),
        y: Math.min(maxY, Math.max(8, y)),
      };
    },
    [width, height]
  );

  useEffect(() => {
    const el = document.getElementById("call-stage");
    stageRef.current = el;
    if (!el) return;
    setPos({
      x: Math.max(8, el.clientWidth - width - 20),
      y: Math.max(8, el.clientHeight - height - 88),
    });
  }, [width, height]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current || !stageRef.current) return;
      const next = clamp(
        drag.current.origX + (e.clientX - drag.current.startX),
        drag.current.origY + (e.clientY - drag.current.startY),
        stageRef.current
      );
      setPos(next);
    };
    const onUp = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [clamp]);

  if (!pos) return null;

  return (
    <div
      role="group"
      aria-label="Your video — drag to move"
      onPointerDown={(e) => {
        // Don't start drag from interactive controls inside
        if ((e.target as HTMLElement).closest("button")) return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = {
          startX: e.clientX,
          startY: e.clientY,
          origX: pos.x,
          origY: pos.y,
        };
      }}
      style={{
        width,
        height,
        left: pos.x,
        top: pos.y,
      }}
      className={cn(
        "absolute z-20 cursor-grab touch-none active:cursor-grabbing",
        "rounded-relay shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-white/15",
        className
      )}
    >
      {children}
    </div>
  );
}
