import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { DemoBanner } from "@/components/ui/demo-banner";
import { parseJson } from "@/lib/utils";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCurrentUser, getNotifications, getPolicies } from "@/lib/queries";
import { DEMO, integrationLabel } from "@/lib/demo";

export default async function SettingsPage() {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, notifications, policies] = await Promise.all([
    getCurrentUser(),
    getNotifications(),
    getPolicies(),
  ]);
  if (!user) redirect("/setup");

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Settings</p>
          <p className="text-sm font-medium text-ink">Autonomy & integrations</p>
        </div>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6 p-5 md:p-6">
        <DemoBanner />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Integration status</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatusCard label="Language model" value={integrationLabel("llm")} live={DEMO.hasLlm} />
            <StatusCard label="Meetings A/V" value={integrationLabel("av")} live={DEMO.hasAv} />
            <StatusCard label="Calendar" value={integrationLabel("calendar")} live={DEMO.hasCalendar} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Autonomy policies</h2>
          {policies.map((p) => {
            const value = parseJson<Record<string, unknown>>(p.valueJson, {});
            return (
              <article key={p.id} className="rounded-relay border border-line bg-surface/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink">{p.label}</p>
                  <Badge tone="muted">{p.key}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{p.description}</p>
                <pre className="mt-3 overflow-x-auto rounded-md bg-canvas p-2 font-mono text-[11px] text-faint">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </article>
            );
          })}
        </section>

        <section className="rounded-relay border border-line bg-surface/70 p-4 text-xs text-muted">
          <p className="font-medium text-ink">Workspace</p>
          <p className="mt-1">
            {user.organization.name} · you are signed in as {user.name} ({user.email}) for this prototype.
          </p>
          <p className="mt-2 text-faint">
            Product name and theme tokens live in env + CSS variables for easy rebranding.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function StatusCard({ label, value, live }: { label: string; value: string; live: boolean }) {
  return (
    <div className="rounded-relay border border-line bg-surface/70 p-3">
      <p className="text-[11px] text-faint">{label}</p>
      <p className="mt-1 text-sm text-ink">{value}</p>
      <Badge tone={live ? "success" : "warn"} className="mt-2">
        {live ? "credentials present" : "demo adapter"}
      </Badge>
    </div>
  );
}
