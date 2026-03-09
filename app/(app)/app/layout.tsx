import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireAppContext } from "@/lib/auth/context";
import { autoCloseStaleTimeEntriesForRanch } from "@/lib/time/maintenance";

export default async function ProductLayout({ children }: { children: ReactNode }) {
  const context = await requireAppContext();
  await autoCloseStaleTimeEntriesForRanch(context.ranch.id);
  return <AppShell context={context}>{children}</AppShell>;
}
