"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { db } from "@/lib/db/client";
import {
  billingCouponRedemptions,
  billingCoupons,
  ranches,
  type SubscriptionStatus,
  users,
} from "@/lib/db/schema";
import { hashCouponCode, normalizeCouponCode } from "@/lib/billing/coupons";

export interface AdminActionState {
  error?: string;
  success?: string;
}

const createCouponSchema = z.object({
  name: z.string().trim().min(2, "Coupon name is required."),
  code: z.string().trim().min(4, "Coupon code must be at least 4 characters."),
  grantType: z.literal("beta_lifetime_access"),
  maxRedemptions: z
    .union([z.string().trim(), z.null(), z.undefined()])
    .transform((value) => {
      if (!value) return null;
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine((value) => value === null || (Number.isInteger(value) && value > 0), {
      message: "Max redemptions must be a positive whole number.",
    }),
  expiresAt: z
    .union([z.string().trim(), z.null(), z.undefined()])
    .transform((value) => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }),
});

const setCouponActiveSchema = z.object({
  couponId: z.string().uuid(),
  isActive: z.enum(["true", "false"]),
});

const setRanchBetaAccessSchema = z.object({
  ranchId: z.string().uuid(),
  enabled: z.enum(["true", "false"]),
});

const setRanchSubscriptionSchema = z.object({
  ranchId: z.string().uuid(),
  subscriptionStatus: z.enum(["inactive", "trialing", "active", "past_due", "canceled"]),
});

const setUserOnboardingSchema = z.object({
  userId: z.string().uuid(),
  onboardingState: z.enum(["needs_ranch", "complete"]),
});

const deleteRanchSchema = z.object({
  ranchId: z.string().uuid(),
});

const deleteUserSchema = z.object({
  userId: z.string().uuid(),
});

function revalidateAdminRoutes() {
  revalidatePath("/admin");
  revalidatePath("/app/settings");
  revalidatePath("/app/billing-required");
  revalidatePath("/billing-required");
}

export async function createCouponAction(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  void _prevState;
  await requirePlatformAdmin();

  const parsed = createCouponSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    grantType: formData.get("grantType") ?? "beta_lifetime_access",
    maxRedemptions: formData.get("maxRedemptions"),
    expiresAt: formData.get("expiresAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid coupon input." };
  }

  const normalizedCode = normalizeCouponCode(parsed.data.code);
  let codeHash: string;
  try {
    codeHash = hashCouponCode(normalizedCode);
  } catch {
    return {
      error:
        "Coupon hashing is not configured. Set BILLING_COUPON_PEPPER or APP_SECRET, then restart the server.",
    };
  }

  try {
    await db.insert(billingCoupons).values({
      name: parsed.data.name,
      codeHash,
      grantType: parsed.data.grantType,
      maxRedemptions: parsed.data.maxRedemptions,
      expiresAt: parsed.data.expiresAt,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    const dbError = error as { code?: string } | undefined;
    if (dbError?.code === "23505") {
      return { error: "A coupon with this code already exists." };
    }
    throw error;
  }

  revalidateAdminRoutes();
  return { success: `Coupon created: ${normalizedCode}` };
}

export async function setCouponActiveAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const parsed = setCouponActiveSchema.safeParse({
    couponId: formData.get("couponId"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return;

  await db
    .update(billingCoupons)
    .set({
      isActive: parsed.data.isActive === "true",
      updatedAt: new Date(),
    })
    .where(eq(billingCoupons.id, parsed.data.couponId));

  revalidateAdminRoutes();
}

export async function setRanchBetaAccessAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const parsed = setRanchBetaAccessSchema.safeParse({
    ranchId: formData.get("ranchId"),
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) return;

  await db
    .update(ranches)
    .set({
      betaLifetimeAccess: parsed.data.enabled === "true",
      subscriptionUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ranches.id, parsed.data.ranchId));

  revalidateAdminRoutes();
}

export async function setRanchSubscriptionStatusAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const parsed = setRanchSubscriptionSchema.safeParse({
    ranchId: formData.get("ranchId"),
    subscriptionStatus: formData.get("subscriptionStatus"),
  });
  if (!parsed.success) return;

  await db
    .update(ranches)
    .set({
      subscriptionStatus: parsed.data.subscriptionStatus as SubscriptionStatus,
      subscriptionUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ranches.id, parsed.data.ranchId));

  revalidateAdminRoutes();
}

export async function deleteCouponAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const couponId = z.string().uuid().safeParse(formData.get("couponId"));
  if (!couponId.success) return;

  await db
    .delete(billingCoupons)
    .where(eq(billingCoupons.id, couponId.data));

  revalidateAdminRoutes();
}

export async function resetCouponRedemptionsAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const couponId = z.string().uuid().safeParse(formData.get("couponId"));
  if (!couponId.success) return;

  await db
    .delete(billingCouponRedemptions)
    .where(eq(billingCouponRedemptions.couponId, couponId.data));

  revalidateAdminRoutes();
}

export async function setUserOnboardingStateAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const parsed = setUserOnboardingSchema.safeParse({
    userId: formData.get("userId"),
    onboardingState: formData.get("onboardingState"),
  });
  if (!parsed.success) return;

  await db
    .update(users)
    .set({
      onboardingState: parsed.data.onboardingState,
      updatedAt: new Date(),
    })
    .where(eq(users.id, parsed.data.userId));

  revalidateAdminRoutes();
}

export async function deleteRanchAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const parsed = deleteRanchSchema.safeParse({
    ranchId: formData.get("ranchId"),
  });
  if (!parsed.success) return;

  await db.delete(ranches).where(eq(ranches.id, parsed.data.ranchId));

  revalidateAdminRoutes();
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();

  const parsed = deleteUserSchema.safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) return;

  await db.delete(users).where(eq(users.id, parsed.data.userId));

  revalidateAdminRoutes();
}
