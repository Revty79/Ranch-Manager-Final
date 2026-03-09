import { cache } from "react";
import { redirect } from "next/navigation";
import type { AuthUser } from "./context";
import { requireUser } from "./context";

const getPlatformAdminEmails = cache(() => {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
});

export function isPlatformAdminEmail(email: string): boolean {
  return getPlatformAdminEmails().has(email.trim().toLowerCase());
}

export async function requirePlatformAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (!isPlatformAdminEmail(user.email)) {
    redirect("/app/access-denied");
  }

  return user;
}
