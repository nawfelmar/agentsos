"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDummyMeeting } from "@/lib/actions/meetings";

export function CreateDummyMeetingButton({
  variant = "primary",
  className,
}: {
  variant?: "primary" | "secondary"
  className?: string
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant={variant}
      className={className}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await createDummyMeeting();
          router.push(`/meetings/${res.id}`);
          router.refresh();
        })
      }
    >
      <Users className="h-3.5 w-3.5" />
      {pending ? "Creating…" : "Create dummy meeting"}
    </Button>
  );
}
