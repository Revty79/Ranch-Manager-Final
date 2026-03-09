type AccessStateInput = {
  subscriptionStatus: string;
  betaLifetimeAccess: boolean;
};

export function hasBillingAccess(state: AccessStateInput): boolean {
  if (state.betaLifetimeAccess) {
    return true;
  }

  return state.subscriptionStatus === "active" || state.subscriptionStatus === "trialing";
}
