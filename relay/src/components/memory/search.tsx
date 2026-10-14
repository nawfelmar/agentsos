"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MemorySearch({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const router = useRouter();

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/memory?q=${encodeURIComponent(q.trim())}` : "/memory");
      }}
    >
      <div className="flex flex-1 items-center gap-2 rounded-relay border border-line bg-canvas px-3">
        <Search className="h-4 w-4 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search decisions, commitments, conversations…"
          className="h-9 w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
        />
      </div>
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}
