export const DEFAULT_TIME_ZONE = "UTC";

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    return DEFAULT_TIME_ZONE;
  }

  return isValidTimeZone(normalized) ? normalized : DEFAULT_TIME_ZONE;
}
