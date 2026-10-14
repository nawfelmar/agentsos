"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openOrCreateDm } from "@/lib/actions/messages";

export function ChatPersonButton({
  userId,
  name,
}: {
  userId: string
  name: string
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      title={`Chat with ${name}`}
      onClick={() =>
        start(async () => {
          const res = await openOrCreateDm(userId);
          router.push(`/messages/${res.slug}`);
          router.refresh();
        })
      }
    >
      <MessageSquare className="h-3 w-3" />
      {pending ? "Opening…" : "Chat"}
    </Button>
  );
}
