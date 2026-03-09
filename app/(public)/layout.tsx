import type { ReactNode } from "react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">{children}</main>
      <PublicFooter />
    </div>
  );
}
