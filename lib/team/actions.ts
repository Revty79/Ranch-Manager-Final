"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { ranchMemberships, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/context";
import { hashPassword } from "@/lib/auth/password";

export interface TeamActionState {
  error?: string;
  success?: string;
}

const roleSchema = z.enum(["owner", "manager", "worker"]);
const payTypeSchema = z.enum(["hourly", "salary"]);

const createMemberSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  email: z.string().trim().email("A valid email is required."),
  tempPassword: z.string().trim().optional(),
  role: roleSchema.default("worker"),
  payType: payTypeSchema.default("hourly"),
  payRate: z.coerce.number().min(0, "Pay rate must be zero or more."),
});

const editMemberSchema = z.object({
  membershipId: z.string().uuid(),
  fullName: z.string().trim().min(2, "Full name is required."),
  role: roleSchema,
  payType: payTypeSchema,
  payRate: z.coerce.number().min(0, "Pay rate must be zero or more."),
});

const toggleMemberSchema = z.object({
  membershipId: z.string().uuid(),
  setActive: z.enum(["true", "false"]),
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

  const [existingUser] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
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
            onboardingState: "needs_ranch",
          })
          .returning({ id: users.id })
      )[0].id;

    await tx.insert(ranchMemberships).values({
      ranchId: context.ranch.id,
      userId,
      role,
      payType: parsed.data.payType,
      payRateCents,
      isActive: true,
      deactivatedAt: null,
    });
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
