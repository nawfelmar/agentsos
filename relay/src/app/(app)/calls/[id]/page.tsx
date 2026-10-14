import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { DirectCallRoom } from "@/components/calls/direct-call-room";
import { CallSideBoard, type CallHighlight } from "@/components/calls/call-side-board";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCurrentUser, getDirectCall, getNotifications } from "@/lib/queries";

function demoHighlights(peer: {
  name: string
  avatarColor: string
}, me: { name: string; avatarColor: string }): CallHighlight[] {
  return [
    {
      id: "hl_peer_1",
      speaker: peer.name,
      color: peer.avatarColor,
      text: "Thanks for hopping on — let’s keep this tight and decide owners before we drop.",
      atLabel: "00:12",
    },
    {
      id: "hl_me_1",
      speaker: me.name,
      color: me.avatarColor,
      text: "Agreed. I’ll capture the decision here so we don’t need a follow-up thread.",
      atLabel: "00:28",
    },
    {
      id: "hl_peer_2",
      speaker: peer.name,
      color: peer.avatarColor,
      text: "If privacy is on, keep this between us until we publish a written update.",
      atLabel: "00:41",
    },
  ];
}

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
  const highlights = demoHighlights(peer, meUser);

  return (
    <AppShell
      callMode
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div className="flex items-center gap-2">
          <Link href="/people" className="text-xs text-faint hover:text-ink">
            People
          </Link>
          <span className="text-faint">/</span>
          <p className="truncate text-sm font-medium text-ink">Call · {peer.name}</p>
          {call.status === "active" && <Badge tone="success">Live</Badge>}
          {call.privacyMode && <Badge tone="success">Private</Badge>}
        </div>
      }
      contextTitle="Statement board"
      context={
        <CallSideBoard
          peerName={peer.name}
          peerTitle={peer.title}
          peerColor={peer.avatarColor}
          privacyMode={call.privacyMode}
          highlights={highlights}
        />
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
