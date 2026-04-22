function parseBooleanEnv(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

export interface PublicDemoConfig {
  enabled: boolean;
  ranchSlug: string;
  memberEmail: string;
}

const DEFAULT_DEMO_RANCH_SLUG = "demo-ranch";
const DEFAULT_DEMO_MEMBER_EMAIL = "manager@demoranch.local";

export function getPublicDemoConfig(): PublicDemoConfig {
  const explicitFlag = parseBooleanEnv(process.env.PUBLIC_DEMO_ENABLED);
  const enabled = explicitFlag ?? process.env.NODE_ENV !== "production";
  const ranchSlug = (process.env.PUBLIC_DEMO_RANCH_SLUG ?? DEFAULT_DEMO_RANCH_SLUG)
    .trim()
    .toLowerCase();
  const memberEmail = (
    process.env.PUBLIC_DEMO_MEMBER_EMAIL ?? DEFAULT_DEMO_MEMBER_EMAIL
  )
    .trim()
    .toLowerCase();

  return {
    enabled,
    ranchSlug,
    memberEmail,
  };
}
