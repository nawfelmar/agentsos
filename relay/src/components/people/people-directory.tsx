"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PersonCard } from "@/components/people/person-card";

export type DirectoryPerson = {
  id: string
  name: string
  title: string
  email: string
  role: string
  avatarColor: string
  status: string
  isCurrentUser: boolean
  teams: string[]
};

const ROLE_SECTIONS: { key: string; label: string; match: (role: string) => boolean }[] = [
  { key: "executive", label: "Executives", match: (r) => r === "executive" },
  { key: "tech_lead", label: "Tech leads", match: (r) => r === "tech_lead" },
  { key: "engineer", label: "Engineers", match: (r) => r === "engineer" },
  { key: "product", label: "Product & design", match: (r) => r === "product" },
  {
    key: "other",
    label: "Other",
    match: (r) => !["executive", "tech_lead", "engineer", "product"].includes(r),
  },
];

export function PeopleDirectory({
  people,
  callerBusy,
  activeCallHref,
}: {
  people: DirectoryPerson[]
  callerBusy: boolean
  activeCallHref?: string | null
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return people;
    return people.filter((p) => {
      const hay = [p.name, p.title, p.email, p.role, ...p.teams]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [people, q]);

  const sections = ROLE_SECTIONS.map((s) => ({
    ...s,
    list: filtered.filter((p) => s.match(p.role)),
  })).filter((s) => s.list.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-relay border border-line bg-surface/80 px-3 shadow-panel">
        <Search className="h-4 w-4 shrink-0 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people by name, role, or team…"
          className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          aria-label="Search people"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="shrink-0 text-[11px] text-faint hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {q && (
        <p className="text-xs text-muted">
          {filtered.length === 0
            ? `No people match “${q.trim()}”`
            : `${filtered.length} match${filtered.length === 1 ? "" : "es"} for “${q.trim()}”`}
        </p>
      )}

      {sections.length === 0 ? (
        <div className="rounded-relay border border-dashed border-line px-4 py-10 text-center text-sm text-faint">
          Try another name, role, or team
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.key} className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">
              {section.label}{" "}
              <span className="font-normal text-faint">· {section.list.length}</span>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.list.map((u) => (
                <PersonCard
                  key={u.id}
                  person={u}
                  teams={u.teams}
                  callerBusy={callerBusy}
                  activeCallHref={activeCallHref}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
