"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  payrollSettings,
  ranchMemberships,
  ranches,
  users,
  workOrderTemplateAssignments,
  workOrderTemplates,
  type RanchRole,
} from "@/lib/db/schema";
import { getPostAuthRedirectPath, requireUser } from "./context";
import { hashPassword, verifyPassword } from "./password";
import {
  isValidUsername,
  normalizeUsername,
  USERNAME_VALIDATION_MESSAGE,
} from "./username";
import { autoClockOutActiveTimeForUser } from "@/lib/time/maintenance";
import { getPublicDemoConfig } from "@/lib/demo/public";
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

const usernameSchema = z
  .string()
  .trim()
  .min(3, USERNAME_VALIDATION_MESSAGE)
  .max(40, USERNAME_VALIDATION_MESSAGE)
  .transform(normalizeUsername)
  .refine((value) => isValidUsername(value), USERNAME_VALIDATION_MESSAGE);

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  username: usernameSchema,
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Enter your password."),
});

const onboardingSchema = z.object({
  ranchName: z
    .string()
    .trim()
    .min(3, "Ranch name must be at least 3 characters.")
    .max(80, "Ranch name is too long."),
  payrollCadence: z.enum(["weekly", "biweekly", "monthly"]).default("biweekly"),
  includeStarterTemplates: z.boolean().default(true),
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

const demoRestrictedRoles = new Set<RanchRole>(["owner"]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseCheckbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function utcDateKeyNow(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolvePayrollDefaults(cadence: "weekly" | "biweekly" | "monthly"): {
  periodLengthDays: number;
  paydayOffsetDays: number;
} {
  if (cadence === "weekly") {
    return {
      periodLengthDays: 7,
      paydayOffsetDays: 3,
    };
  }

  if (cadence === "monthly") {
    return {
      periodLengthDays: 30,
      paydayOffsetDays: 7,
    };
  }

  return {
    periodLengthDays: 14,
    paydayOffsetDays: 5,
  };
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
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid signup details." };
  }

  const username = parsed.data.username;
  const email = normalizeEmail(parsed.data.email);
  const [existingByUsername] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingByUsername) {
    return { error: "That username is already in use." };
  }

  const [existingByEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingByEmail) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [createdUser] = await db
    .insert(users)
    .values({
      fullName: parsed.data.fullName,
      username,
      email,
      passwordHash,
      onboardingState: "needs_ranch",
    })
    .returning({
      id: users.id,
      username: users.username,
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
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid login details." };
  }

  const username = parsed.data.username;
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      fullName: users.fullName,
      passwordHash: users.passwordHash,
      mustResetPassword: users.mustResetPassword,
      onboardingState: users.onboardingState,
      lastActiveRanchId: users.lastActiveRanchId,
      timeZone: users.timeZone,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    return { error: "Username or password is incorrect." };
  }

  const isValidPassword = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!isValidPassword) {
    return { error: "Username or password is incorrect." };
  }

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  const redirectPath = await getPostAuthRedirectPath({
    id: user.id,
    username: user.username,
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
    payrollCadence: formData.get("payrollCadence"),
    includeStarterTemplates: parseCheckbox(formData, "includeStarterTemplates"),
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
  const payrollDefaults = resolvePayrollDefaults(parsed.data.payrollCadence);
  const anchorStartDate = utcDateKeyNow();

  await db.transaction(async (tx) => {
    const [newRanch] = await tx
      .insert(ranches)
      .values({
        name: parsed.data.ranchName,
        slug: ranchSlug,
        timeZone: user.timeZone,
        onboardingCompleted: true,
        subscriptionStatus: "inactive",
      })
      .returning({
        id: ranches.id,
      });
    newRanchId = newRanch.id;

    const [ownerMembership] = await tx
      .insert(ranchMemberships)
      .values({
        ranchId: newRanch.id,
        userId: user.id,
        role: "owner",
        isActive: true,
      })
      .returning({ id: ranchMemberships.id });

    await tx.insert(payrollSettings).values({
      ranchId: newRanch.id,
      anchorStartDate,
      periodLengthDays: payrollDefaults.periodLengthDays,
      paydayOffsetDays: payrollDefaults.paydayOffsetDays,
    });

    if (parsed.data.includeStarterTemplates) {
      const starterTemplates = [
        {
          templateName: "morning-livestock-check",
          title: "Morning livestock check",
          description:
            "Walk assigned groups, confirm water/feed status, and note any immediate health issues.",
          priority: "high" as const,
          recurrenceCadence: "daily" as const,
        },
        {
          templateName: "water-points-inspection",
          title: "Water points inspection",
          description:
            "Inspect troughs/tanks/valves, clear obstructions, and confirm clean flow.",
          priority: "high" as const,
          recurrenceCadence: "daily" as const,
        },
        {
          templateName: "fence-line-check",
          title: "Fence line check",
          description:
            "Inspect perimeter and hot wire sections, flag weak posts, and schedule repairs.",
          priority: "normal" as const,
          recurrenceCadence: "weekly" as const,
        },
      ];

      const createdTemplates = await tx
        .insert(workOrderTemplates)
        .values(
          starterTemplates.map((template) => ({
            ranchId: newRanch.id,
            templateName: template.templateName,
            title: template.title,
            description: template.description,
            priority: template.priority,
            compensationType: "standard" as const,
            flatPayCents: 0,
            incentivePayCents: 0,
            incentiveTimerType: "none" as const,
            incentiveDurationHours: null,
            isActive: true,
            recurringEnabled: true,
            recurrenceCadence: template.recurrenceCadence,
            recurrenceIntervalDays: null,
            nextGenerationOn: anchorStartDate,
            createdByMembershipId: ownerMembership.id,
          })),
        )
        .returning({ id: workOrderTemplates.id });

      await tx.insert(workOrderTemplateAssignments).values(
        createdTemplates.map((template) => ({
          ranchId: newRanch.id,
          templateId: template.id,
          membershipId: ownerMembership.id,
        })),
      );
    }

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

export async function startPublicDemoSessionAction(
  _prevState: AuthActionState,
  _formData: FormData,
): Promise<AuthActionState> {
  void _prevState;
  void _formData;

  const config = getPublicDemoConfig();
  if (!config.enabled) {
    return {
      error:
        "Demo ranch access is currently unavailable. Please create an account to continue.",
    };
  }

  const [demoMembership] = await db
    .select({
      userId: users.id,
      role: ranchMemberships.role,
      ranchId: ranches.id,
    })
    .from(users)
    .innerJoin(ranchMemberships, eq(ranchMemberships.userId, users.id))
    .innerJoin(ranches, eq(ranchMemberships.ranchId, ranches.id))
    .where(
      and(
        eq(users.email, config.memberEmail),
        eq(ranches.slug, config.ranchSlug),
        eq(ranchMemberships.isActive, true),
      ),
    )
    .limit(1);

  if (!demoMembership) {
    return {
      error:
        "Demo ranch is not ready yet. Ask the operator to run the demo seed, then try again.",
    };
  }

  if (demoRestrictedRoles.has(demoMembership.role)) {
    return {
      error:
        "Demo account configuration is invalid. Use a non-owner role for public demo entry.",
    };
  }

  await db
    .update(users)
    .set({
      onboardingState: "complete",
      lastActiveRanchId: demoMembership.ranchId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, demoMembership.userId));

  const { token, expiresAt } = await createSession(demoMembership.userId);
  await setSessionCookie(token, expiresAt);

  redirect("/app");
}
