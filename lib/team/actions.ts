"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { ranchMemberships, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/context";
import { hashPassword } from "@/lib/auth/password";

export interface TeamActionState {
  error?: string;
  success?: string;
}

const roleSchema = z.enum(["owner", "manager", "worker", "seasonal_worker"]);
const payTypeSchema = z.enum(["hourly", "salary", "piece_work"]);
const payAdvanceSchema = z.preprocess(
  (value) => (value === null || value === undefined || value === "" ? 0 : value),
  z.coerce.number().min(0, "Pay advance must be zero or more."),
);

const createMemberSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  email: z.string().trim().email("A valid email is required."),
  tempPassword: z.string().trim().optional(),
  role: roleSchema.default("worker"),
  payType: payTypeSchema.default("hourly"),
  payRate: z.coerce.number().min(0, "Pay rate must be zero or more."),
  payAdvance: payAdvanceSchema,
});

const editMemberSchema = z.object({
  membershipId: z.string().uuid(),
  fullName: z.string().trim().min(2, "Full name is required."),
  role: roleSchema,
  payType: payTypeSchema,
  payRate: z.coerce.number().min(0, "Pay rate must be zero or more."),
  payAdvance: payAdvanceSchema,
});

const toggleMemberSchema = z.object({
  membershipId: z.string().uuid(),
  setActive: z.enum(["true", "false"]),
});

const deleteMemberSchema = z.object({
  membershipId: z.string().uuid(),
});

function toCents(value: number): number {
  return Math.round(value * 100);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function createTeamMemberAction(
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = createMemberSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    tempPassword: formData.get("tempPassword"),
    role: formData.get("role"),
    payType: formData.get("payType"),
    payRate: formData.get("payRate"),
    payAdvance: formData.get("payAdvance"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid member details." };
  }

  const role = parsed.data.role;
  if (context.membership.role === "manager" && role === "owner") {
    return { error: "Managers cannot assign owner role." };
  }

  const email = normalizeEmail(parsed.data.email);
  const tempPassword = parsed.data.tempPassword?.trim() ?? "";
  const payRateCents = toCents(parsed.data.payRate);
  const payAdvanceCents = toCents(parsed.data.payAdvance);

  const [existingUser] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      onboardingState: users.onboardingState,
      lastActiveRanchId: users.lastActiveRanchId,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existingUser && tempPassword.length < 8) {
    return {
      error:
        "Temporary password is required (8+ chars) when creating a new user login.",
    };
  }

  const [existingMembership] = existingUser
    ? await db
        .select({ id: ranchMemberships.id })
        .from(ranchMemberships)
        .where(
          and(
            eq(ranchMemberships.ranchId, context.ranch.id),
            eq(ranchMemberships.userId, existingUser.id),
          ),
        )
        .limit(1)
    : [];

  if (existingMembership) {
    return { error: "This user is already a member of the current ranch." };
  }

  await db.transaction(async (tx) => {
    const userId =
      existingUser?.id ??
      (
        await tx
          .insert(users)
          .values({
            fullName: parsed.data.fullName,
            email,
            passwordHash: await hashPassword(tempPassword),
            onboardingState: "complete",
            lastActiveRanchId: context.ranch.id,
          })
          .returning({ id: users.id })
      )[0].id;

    await tx.insert(ranchMemberships).values({
      ranchId: context.ranch.id,
      userId,
      role,
      payType: parsed.data.payType,
      payRateCents,
      payAdvanceCents,
      isActive: true,
      deactivatedAt: null,
    });

    if (existingUser && existingUser.onboardingState !== "complete") {
      await tx
        .update(users)
        .set({
          onboardingState: "complete",
          lastActiveRanchId: existingUser.lastActiveRanchId ?? context.ranch.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    }
  });

  revalidatePath("/app/team");
  return { success: "Team member added." };
}

export async function updateTeamMemberAction(
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = editMemberSchema.safeParse({
    membershipId: formData.get("membershipId"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    payType: formData.get("payType"),
    payRate: formData.get("payRate"),
    payAdvance: formData.get("payAdvance"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid member update." };
  }

  const [target] = await db
    .select({
      membershipId: ranchMemberships.id,
      targetRole: ranchMemberships.role,
      userId: ranchMemberships.userId,
    })
    .from(ranchMemberships)
    .where(
      and(
        eq(ranchMemberships.ranchId, context.ranch.id),
        eq(ranchMemberships.id, parsed.data.membershipId),
      ),
    )
    .limit(1);

  if (!target) {
    return { error: "Team member not found for this ranch." };
  }

  if (context.membership.role === "manager" && target.targetRole === "owner") {
    return { error: "Managers cannot edit owner memberships." };
  }

  if (context.membership.role === "manager" && parsed.data.role === "owner") {
    return { error: "Managers cannot assign owner role." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        fullName: parsed.data.fullName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, target.userId));

    await tx
      .update(ranchMemberships)
      .set({
        role: parsed.data.role,
        payType: parsed.data.payType,
        payRateCents: toCents(parsed.data.payRate),
        payAdvanceCents: toCents(parsed.data.payAdvance),
        updatedAt: new Date(),
      })
      .where(eq(ranchMemberships.id, parsed.data.membershipId));
  });

  revalidatePath("/app/team");
  revalidatePath(`/app/team/${parsed.data.membershipId}`);
  return { success: "Member updated." };
}

export async function toggleTeamMemberStatusAction(
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = toggleMemberSchema.safeParse({
    membershipId: formData.get("membershipId"),
    setActive: formData.get("setActive"),
  });

  if (!parsed.success) {
    return { error: "Invalid status update request." };
  }

  const [target] = await db
    .select({
      membershipId: ranchMemberships.id,
      targetRole: ranchMemberships.role,
      userId: ranchMemberships.userId,
    })
    .from(ranchMemberships)
    .where(
      and(
        eq(ranchMemberships.ranchId, context.ranch.id),
        eq(ranchMemberships.id, parsed.data.membershipId),
      ),
    )
    .limit(1);

  if (!target) {
    return { error: "Team member not found for this ranch." };
  }

  if (context.membership.role === "manager" && target.targetRole === "owner") {
    return { error: "Managers cannot change owner status." };
  }

  if (target.userId === context.user.id && parsed.data.setActive === "false") {
    return { error: "You cannot deactivate your own membership." };
  }

  const setActive = parsed.data.setActive === "true";

  await db
    .update(ranchMemberships)
    .set({
      isActive: setActive,
      deactivatedAt: setActive ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ranchMemberships.id, parsed.data.membershipId));

  revalidatePath("/app/team");
  revalidatePath(`/app/team/${parsed.data.membershipId}`);
  return { success: setActive ? "Member activated." : "Member deactivated." };
}

export async function deleteTeamMemberAction(
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const context = await requireRole(["owner", "manager"]);
  const parsed = deleteMemberSchema.safeParse({
    membershipId: formData.get("membershipId"),
  });

  if (!parsed.success) {
    return { error: "Invalid delete request." };
  }

  const [target] = await db
    .select({
      membershipId: ranchMemberships.id,
      targetRole: ranchMemberships.role,
      userId: ranchMemberships.userId,
    })
    .from(ranchMemberships)
    .where(
      and(
        eq(ranchMemberships.ranchId, context.ranch.id),
        eq(ranchMemberships.id, parsed.data.membershipId),
      ),
    )
    .limit(1);

  if (!target) {
    return { error: "Team member not found for this ranch." };
  }

  if (context.membership.role === "manager" && target.targetRole === "owner") {
    return { error: "Managers cannot delete owner memberships." };
  }

  if (target.userId === context.user.id) {
    return { error: "You cannot delete your own membership." };
  }

  if (target.targetRole === "owner") {
    const [{ ownerCount }] = await db
      .select({ ownerCount: sql<number>`count(*)::int` })
      .from(ranchMemberships)
      .where(
        and(
          eq(ranchMemberships.ranchId, context.ranch.id),
          eq(ranchMemberships.role, "owner"),
        ),
      );

    if (ownerCount <= 1) {
      return { error: "Cannot delete the last owner membership." };
    }
  }

  await db
    .delete(ranchMemberships)
    .where(eq(ranchMemberships.id, parsed.data.membershipId));

  revalidatePath("/app/team");
  redirect("/app/team");
}
