"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppContext, requireRole } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import { ranches, users } from "@/lib/db/schema";
import { isValidTimeZone } from "@/lib/timezone";

export interface SettingsActionState {
  error?: string;
  success?: string;
}

const updateTimeZoneSchema = z.object({
  timeZone: z
    .string()
    .trim()
    .min(1, "Timezone is required.")
    .max(100, "Timezone is too long.")
    .refine((value) => isValidTimeZone(value), "Select a valid timezone."),
});

const setAdminAccessSchema = z.object({
  enabled: z.enum(["true", "false"]),
});

export async function updateUserTimeZoneAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const context = await requireAppContext();
  const parsed = updateTimeZoneSchema.safeParse({
    timeZone: formData.get("timeZone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid timezone." };
  }

  await db
    .update(users)
    .set({
      timeZone: parsed.data.timeZone,
      updatedAt: new Date(),
    })
    .where(eq(users.id, context.user.id));

  revalidatePath("/app/settings");
  return { success: "Timezone updated." };
}

export async function setRanchAdminAccessAction(formData: FormData): Promise<void> {
  const context = await requireRole(["owner"], { requirePaid: false });
  const parsed = setAdminAccessSchema.safeParse({
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) return;

  await db
    .update(ranches)
    .set({
      allowPlatformAdminAccess: parsed.data.enabled === "true",
      updatedAt: new Date(),
    })
    .where(eq(ranches.id, context.ranch.id));

  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  revalidatePath("/admin");
}
