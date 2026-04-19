import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";

const SESSION_MAX_AGE_DAYS = 30;
export const sessionCookieName =
  process.env.SESSION_COOKIE_NAME ?? "rmf_session_token";

function isTrueEnv(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function shouldUseSecureSessionCookies(): boolean {
  const allowInsecureCookies = isTrueEnv(process.env.ALLOW_INSECURE_COOKIES);
  return process.env.NODE_ENV === "production" && !allowInsecureCookies;
}

export function hashSessionToken(token: string): string {
  const secret = process.env.APP_SECRET ?? "dev-only-secret-change-me";
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_MAX_AGE_DAYS);

  await db.insert(sessions).values({
    tokenHash,
    userId,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookies(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export async function getSessionTokenFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(sessionCookieName)?.value;
}

export async function revokeSessionByToken(token: string) {
  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(token)));
}

export async function revokeExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export async function getValidSessionByToken(token: string) {
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  return session ?? null;
}
