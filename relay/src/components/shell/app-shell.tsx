"use client";

import { useState } from "react";
import { PanelRight } from "lucide-react";
import { Sidebar } from "./sidebar";
import { RightPanel } from "./right-panel";
import { Button } from "@/components/ui/button";

export function AppShell({
  user,
  unread,
  contextTitle,
  context,
  children,
  header,
}: {
  user: {
    name: string
    title: string
    avatarColor: string
    status: string
    organization: { name: string }
  }
  unread: number
  contextTitle?: string
  context?: React.ReactNode
  children: React.ReactNode
  header?: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(Boolean(context));

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        user={user}
        unread={unread}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur">
          <div className="min-w-0 flex-1">{header}</div>
          {context && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPanelOpen((v) => !v)}
              aria-label="Toggle context panel"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          )}
        </header>
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
          {context && (
            <RightPanel
              open={panelOpen}
              onClose={() => setPanelOpen(false)}
              title={contextTitle ?? "Context"}
            >
              {context}
            </RightPanel>
          )}
        </div>
      </div>
    </div>
  );
}
