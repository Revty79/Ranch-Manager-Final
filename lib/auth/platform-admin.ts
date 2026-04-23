import { redirect } from "next/navigation";
import type { AuthUser } from "./context";
import { requireUser } from "./context";
import { isPlatformAdminEmail } from "./platform-admin-emails";

export { isPlatformAdminEmail };

export async function requirePlatformAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (!isPlatformAdminEmail(user.email)) {
    redirect("/app/access-denied");
  }

  return user;
}
