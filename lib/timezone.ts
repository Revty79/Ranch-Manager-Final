export const DEFAULT_TIME_ZONE = "UTC";
export const FALLBACK_TIME_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
];

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

export function getSupportedTimeZones(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      const values = Intl.supportedValuesOf("timeZone");
      if (values.length > 0) {
        return values;
      }
    } catch {
      // Fall through to fallback list.
    }
  }

  return FALLBACK_TIME_ZONES;
}
