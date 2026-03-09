import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireAppContext } from "@/lib/auth/context";

export default async function ProductLayout({ children }: { children: ReactNode }) {
  const context = await requireAppContext();
  return <AppShell context={context}>{children}</AppShell>;
}
