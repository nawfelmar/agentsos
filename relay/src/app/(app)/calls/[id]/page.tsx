import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { DirectCallRoom } from "@/components/calls/direct-call-room";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCurrentUser, getDirectCall, getNotifications } from "@/lib/queries";

export default async function DirectCallPage({ params }: { params: { id: string } }) {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, call, notifications] = await Promise.all([
    getCurrentUser(),
    getDirectCall(params.id),
    getNotifications(),
  ]);
  if (!user) redirect("/setup");
  if (!call) notFound();
  if (call.callerId !== user.id && call.calleeId !== user.id) notFound();

  const peer = call.callerId === user.id ? call.callee : call.caller;
  const meUser = call.callerId === user.id ? call.caller : call.callee;

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div className="flex items-center gap-2">
          <Link href="/people" className="text-xs text-faint hover:text-ink">
            People
          </Link>
          <span className="text-faint">/</span>
          <p className="truncate text-sm font-medium text-ink">Call with {peer.name}</p>
          {call.status === "active" && <Badge tone="success">Live</Badge>}
        </div>
      }
      contextTitle="1:1 call"
      context={
        <div className="space-y-3 text-xs text-muted">
          <p>
            Direct call between you and {peer.name}. Toggle privacy anytime. End the call before
            dialing someone else.
          </p>
          <Badge tone={call.privacyMode ? "success" : "accent"}>
            {call.privacyMode ? "Private" : "Standard"}
          </Badge>
        </div>
      }
    >
      <DirectCallRoom
        callId={call.id}
        status={call.status}
        privacyMode={call.privacyMode}
        me={{ id: meUser.id, name: meUser.name, color: meUser.avatarColor }}
        peer={{
          id: peer.id,
          name: peer.name,
          color: peer.avatarColor,
          title: peer.title,
        }}
      />
    </AppShell>
  );
}
