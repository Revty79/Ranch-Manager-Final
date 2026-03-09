import type { ReactNode } from "react";
import type { AppContext } from "@/lib/auth/context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

interface AppShellProps {
  children: ReactNode;
  context: AppContext;
}

export function AppShell({ children, context }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-[1360px] px-4 py-4 sm:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[250px_1fr]">
          <AppSidebar context={context} />
          <div>
            <AppTopbar context={context} />
            <main>{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
