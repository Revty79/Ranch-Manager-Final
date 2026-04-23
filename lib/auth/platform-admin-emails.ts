import { cache } from "react";

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
