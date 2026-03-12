const MAX_TRIAL_DAYS = 365;

interface TrialConfigInput {
  envValue?: string;
}

interface TrialEligibilityInput {
  subscriptionStatus: string;
  stripeSubscriptionId: string | null;
  betaLifetimeAccess: boolean;
}

export interface TrialConfigResult {
  trialDays: number | null;
  error?: string;
}

export function resolveTrialConfig(
  input: TrialConfigInput = {},
): TrialConfigResult {
  const value = input.envValue ?? process.env.STRIPE_TRIAL_DAYS ?? "";
  const trimmed = value.trim();

  if (!trimmed) {
    return { trialDays: null };
  }

  const trialDays = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(trialDays)) {
    return {
      trialDays: null,
      error: "STRIPE_TRIAL_DAYS must be a whole number.",
    };
  }

  if (trialDays < 1 || trialDays > MAX_TRIAL_DAYS) {
    return {
      trialDays: null,
      error: `STRIPE_TRIAL_DAYS must be between 1 and ${MAX_TRIAL_DAYS}.`,
    };
  }

  return { trialDays };
}

export function isTrialEligible(state: TrialEligibilityInput): boolean {
  if (state.betaLifetimeAccess) {
    return false;
  }

  if (state.subscriptionStatus !== "inactive") {
    return false;
  }

  return state.stripeSubscriptionId === null;
}
