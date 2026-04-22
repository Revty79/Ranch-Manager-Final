import type { WorkOrderRecurrenceCadence } from "@/lib/db/schema";

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseDateKey(value: string): Date | null {
  if (!isDateKey(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function resolveCadenceIntervalDays(
  cadence: WorkOrderRecurrenceCadence,
  customIntervalDays: number | null,
): number {
  if (cadence === "daily") return 1;
  if (cadence === "weekly") return 7;
  if (cadence === "custom") {
    return customIntervalDays && customIntervalDays > 0 ? customIntervalDays : 1;
  }

  return 30;
}

export function advanceRecurrenceDate(
  currentDateKey: string,
  cadence: WorkOrderRecurrenceCadence,
  customIntervalDays: number | null,
): string {
  const currentDate = parseDateKey(currentDateKey);
  if (!currentDate) {
    throw new Error("Invalid recurrence date.");
  }

  if (cadence === "monthly") {
    const next = new Date(currentDate);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return toDateKey(next);
  }

  const interval = resolveCadenceIntervalDays(cadence, customIntervalDays);
  const next = new Date(currentDate);
  next.setUTCDate(next.getUTCDate() + interval);
  return toDateKey(next);
}
