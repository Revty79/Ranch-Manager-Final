"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { ranchMemberships, ranches, users } from "@/lib/db/schema";
import { getPostAuthRedirectPath, requireUser } from "./context";
import { hashPassword, verifyPassword } from "./password";
import { autoClockOutActiveTimeForUser } from "@/lib/time/maintenance";
import {
  clearSessionCookie,
  createSession,
  getValidSessionByToken,
  getSessionTokenFromCookie,
  revokeSessionByToken,
  setSessionCookie,
} from "./session";

export interface AuthActionState {
  error?: string;
}

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

const onboardingSchema = z.object({
  ranchName: z
    .string()
    .trim()
    .min(3, "Ranch name must be at least 3 characters.")
    .max(80, "Ranch name is too long."),
});

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password must be 128 characters or fewer."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function createUniqueRanchSlug(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);

  const slugBase = base || "ranch";

  for (let i = 0; i < 200; i += 1) {
    const candidate = i === 0 ? slugBase : `${slugBase}-${i + 1}`;
    const [existing] = await db
      .select({ id: ranches.id })
      .from(ranches)
      .where(eq(ranches.slug, candidate))
      .limit(1);

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Unable to allocate ranch slug.");
}

export async function signupAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid signup details." };
  }

  const email = normalizeEmail(parsed.data.email);
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [createdUser] = await db
    .insert(users)
    .values({
      fullName: parsed.data.fullName,
      email,
      passwordHash,
      onboardingState: "needs_ranch",
    })
    .returning({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      mustResetPassword: users.mustResetPassword,
      onboardingState: users.onboardingState,
      lastActiveRanchId: users.lastActiveRanchId,
      timeZone: users.timeZone,
    });

  const { token, expiresAt } = await createSession(createdUser.id);
  await setSessionCookie(token, expiresAt);

  const redirectPath = await getPostAuthRedirectPath(createdUser);
  redirect(redirectPath);
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid login details." };
  }

  const email = normalizeEmail(parsed.data.email);
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      passwordHash: users.passwordHash,
      mustResetPassword: users.mustResetPassword,
      onboardingState: users.onboardingState,
      lastActiveRanchId: users.lastActiveRanchId,
      timeZone: users.timeZone,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return { error: "Email or password is incorrect." };
  }

  const isValidPassword = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!isValidPassword) {
    return { error: "Email or password is incorrect." };
  }

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  const redirectPath = await getPostAuthRedirectPath({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    mustResetPassword: user.mustResetPassword,
    onboardingState: user.onboardingState,
    lastActiveRanchId: user.lastActiveRanchId,
    timeZone: user.timeZone,
  });

  redirect(redirectPath);
}

export async function completeOnboardingAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = onboardingSchema.safeParse({
    ranchName: formData.get("ranchName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid ranch details." };
  }

  const user = await requireUser();

  const [existingMembership] = await db
    .select({ id: ranchMemberships.id })
    .from(ranchMemberships)
    .where(and(eq(ranchMemberships.userId, user.id), eq(ranchMemberships.isActive, true)))
    .limit(1);

  if (existingMembership) {
    const redirectPath = await getPostAuthRedirectPath(user);
    redirect(redirectPath);
  }

  const ranchSlug = await createUniqueRanchSlug(parsed.data.ranchName);
  let newRanchId: string | null = null;

  await db.transaction(async (tx) => {
    const [newRanch] = await tx
      .insert(ranches)
      .values({
        name: parsed.data.ranchName,
        slug: ranchSlug,
        onboardingCompleted: true,
        subscriptionStatus: "inactive",
      })
      .returning({
        id: ranches.id,
      });
    newRanchId = newRanch.id;

    await tx.insert(ranchMemberships).values({
      ranchId: newRanch.id,
      userId: user.id,
      role: "owner",
      isActive: true,
    });

    await tx
      .update(users)
      .set({
        onboardingState: "complete",
        lastActiveRanchId: newRanch.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  });

  const redirectPath = await getPostAuthRedirectPath({
    ...user,
    onboardingState: "complete",
    lastActiveRanchId: newRanchId,
  });

  redirect(redirectPath);
}

export async function resetPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password update." };
  }

  const user = await requireUser();
  if (!user.mustResetPassword) {
    redirect(await getPostAuthRedirectPath(user));
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustResetPassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  redirect(
    await getPostAuthRedirectPath({
      ...user,
      mustResetPassword: false,
    }),
  );
}

export async function logoutAction() {
  const token = await getSessionTokenFromCookie();
  if (token) {
    try {
      const session = await getValidSessionByToken(token);
      if (session) {
        await autoClockOutActiveTimeForUser(session.userId);
      }
    } catch {
      // Best-effort closeout should not block sign-out.
    }

    try {
      await revokeSessionByToken(token);
    } catch {
      // Session revocation failure should not trap users in signed-in state.
    }
  }

  try {
    await clearSessionCookie();
  } catch {
    // Continue redirect even if cookie clearing fails in this request context.
  }

  redirect("/login");
}
