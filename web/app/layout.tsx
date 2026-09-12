"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { api, clearSession, getOrg, getToken } from "./lib/api";
import "./globals.css";

const NAV = [
  {
    section: "Operate",
    items: [
      { href: "/", label: "Overview" },
      { href: "/registry", label: "Registry" },
      { href: "/runs", label: "Runs" },
      { href: "/approvals", label: "Approvals", countKey: "approvals" as const },
    ],
  },
  {
    section: "Govern",
    items: [
      { href: "/policies", label: "Policies" },
      { href: "/evaluations", label: "Evaluations" },
      { href: "/audit", label: "Audit" },
      { href: "/costs", label: "Costs" },
    ],
  },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [org, setOrg] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    if (pathname === "/login") {
      setReady(true);
      return;
    }
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setOrg(getOrg());
    Promise.all([api("/me").catch(() => null), api("/approvals?status_filter=pending").catch(() => [])]).then(
      ([profile, approvals]) => {
        setMe(profile);
        if (profile?.organization) setOrg(profile.organization);
        setPendingApprovals(Array.isArray(approvals) ? approvals.length : 0);
        setReady(true);
      },
    );
  }, [pathname, router]);

  const counts = useMemo(() => ({ approvals: pendingApprovals }), [pendingApprovals]);

  if (pathname === "/login") {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  if (!ready) {
    return (
      <html lang="en">
        <body>
          <div className="content">Loading control plane…</div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <div className="brand-block">
              <p className="brand">AgentOS</p>
              <p className="brand-sub">Security desk for AI agents</p>
            </div>
            {NAV.map((group) => (
              <div key={group.section}>
                <div className="nav-section">{group.section}</div>
                {group.items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const count = item.countKey ? counts[item.countKey] : 0;
                  return (
                    <Link key={item.href} href={item.href} className={`nav-link${active ? " active" : ""}`}>
                      <span>{item.label}</span>
                      {count ? <span className="nav-count">{count}</span> : null}
                    </Link>
                  );
                })}
              </div>
            ))}
            <div className="sidebar-footer">
              <div className="org-chip">
                <strong>{org || me?.organization || "Organization"}</strong>
                <span>{me?.email || "signed in"}</span>
              </div>
              <button
                className="btn ghost"
                style={{ width: "100%" }}
                onClick={() => {
                  clearSession();
                  router.push("/login");
                }}
              >
                Sign out
              </button>
            </div>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <div className="topbar-title">Control room · private execution · badge-gated tools · CCTV timeline</div>
              <div className="topbar-actions">
                <Link className="btn secondary sm" href="/approvals">
                  Approvals{pendingApprovals ? ` (${pendingApprovals})` : ""}
                </Link>
                <Link className="btn sm" href="/registry">
                  Registry
                </Link>
              </div>
            </header>
            <main className="content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
