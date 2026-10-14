import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { ConversationRail } from "@/components/messages/conversation-rail";
import { ensureSeeded } from "@/lib/ensure-seeded";
import {
  getConversations,
  getCurrentUser,
  getNotifications,
} from "@/lib/queries";

export default async function MessagesIndexPage() {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, conversations, notifications] = await Promise.all([
    getCurrentUser(),
    getConversations(),
    getNotifications(),
  ]);
  if (!user) redirect("/setup");

  // Land on the most recently active conversation (messaging-app default).
  const latest = conversations.find((c) => c.messages[0]) ?? conversations[0];
  if (latest) redirect(`/messages/${latest.slug}`);

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
            Messages
          </p>
          <p className="text-sm font-medium text-ink">Inbox</p>
        </div>
      }
    >
      <div className="flex h-[calc(100vh-3rem)]">
        <ConversationRail
          conversations={conversations}
          currentUserId={user.id}
        />
        <div className="hidden min-w-0 flex-1 flex-col items-center justify-center px-6 text-center md:flex">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2 text-faint">
            <MessagesSquare className="h-5 w-5" />
          </div>
          <p className="font-display text-lg tracking-tight text-ink">Select a conversation</p>
          <p className="mt-1.5 max-w-xs text-sm text-muted">
            People and channels are listed on the left, newest activity first.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
