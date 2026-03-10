"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAppContext } from "@/lib/auth/context";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
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
