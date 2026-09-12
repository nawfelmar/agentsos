"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import "./globals.css";

const LINKS = [
  { href: "/", label: "Registry" },
  { href: "/runs", label: "Runs" },
  { href: "/approvals", label: "Approvals" },
  { href: "/policies", label: "Policies" },
  { href: "/evaluations", label: "Evaluations" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("agentos_token");
    setAuthed(!!token);
    if (!token && pathname !== "/login") router.replace("/login");
  }, [pathname, router]);

  if (pathname === "/login") {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  if (authed === null) {
    return (
      <html lang="en">
        <body />
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <nav className="side">
            <p className="brand">AgentOS</p>
            <p className="tag">control plane</p>
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
                {l.label}
              </Link>
            ))}
            <button
              className="btn secondary"
              style={{ marginTop: "2rem", width: "100%" }}
              onClick={() => {
                localStorage.removeItem("agentos_token");
                router.push("/login");
              }}
            >
              Sign out
            </button>
          </nav>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
