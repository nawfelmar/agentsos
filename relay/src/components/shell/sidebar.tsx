"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Home,
  MessageSquare,
  Settings,
  Video,
  Brain,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

const NAV = [
  { href: "/", label: "Command Center", icon: Home },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/channels", label: "Channels", icon: Hash },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/coordination", label: "AI Coordination", icon: Bot },
  { href: "/memory", label: "Decisions & Memory", icon: Brain },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  collapsed,
  onToggle,
  user,
  unread,
}: {
  collapsed: boolean
  onToggle: () => void
  user: { name: string; title: string; avatarColor: string; status: string; organization: { name: string } }
  unread: number
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-line bg-[var(--sidebar)] transition-[width] duration-200",
        collapsed ? "w-[64px]" : "w-[232px]"
      )}
    >
      <div className={cn("flex items-center gap-2 border-b border-line px-3 py-3", collapsed && "justify-center")}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <span className="font-display text-sm font-semibold tracking-tight">R</span>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 animate-fade-up">
            <p className="truncate font-display text-[15px] font-semibold tracking-tight text-ink">Relay</p>
            <p className="truncate text-[11px] text-faint">{user.organization.name}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="relay-focus rounded-md p-1 text-faint hover:bg-surface-2 hover:text-ink"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const showBadge = item.href === "/activity" && unread > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relay-focus group relative flex items-center gap-2.5 rounded-relay px-2.5 py-2 text-[13px] transition-colors",
                active
                  ? "bg-surface-2 text-ink"
                  : "text-muted hover:bg-surface-2/70 hover:text-ink",
                collapsed && "justify-center px-0"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
              )}
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-faint group-hover:text-muted")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {showBadge && !collapsed && (
                <span className="ml-auto rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  {unread}
                </span>
              )}
              {showBadge && collapsed && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t border-line p-3", collapsed && "flex justify-center")}>
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <Avatar name={user.name} color={user.avatarColor} status={user.status} size="sm" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-ink">{user.name}</p>
              <p className="truncate text-[11px] text-faint">{user.title}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
