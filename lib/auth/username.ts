const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._-]{1,38}[a-z0-9])?$/;
const INTERNAL_MEMBER_EMAIL_DOMAIN = "members.ranchmanager.local";

export const USERNAME_VALIDATION_MESSAGE =
  "Use 3-40 characters: letters, numbers, dots, dashes, or underscores.";

export function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .replace(/\.+/g, ".")
    .replace(/^[-._]+|[-._]+$/g, "");
}

export function isValidUsername(value: string): boolean {
  return USERNAME_REGEX.test(value);
}

export function createInternalMemberEmail(username: string, suffix = 0): string {
  return suffix > 0
    ? `${username}-${suffix}@${INTERNAL_MEMBER_EMAIL_DOMAIN}`
    : `${username}@${INTERNAL_MEMBER_EMAIL_DOMAIN}`;
}

export function isInternalMemberEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${INTERNAL_MEMBER_EMAIL_DOMAIN}`);
}
