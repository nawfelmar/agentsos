import { redirect } from "next/navigation";
import { getCurrentUser, getNotifications } from "@/lib/queries";
import { ensureSeeded } from "@/lib/ensure-seeded";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!user) redirect("/setup");
  // Pass-through — individual pages wrap AppShell with context
  void getNotifications;
  return <>{children}</>;
}
