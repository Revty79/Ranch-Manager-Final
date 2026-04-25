import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/patterns/page-header";
import { CreateCouponForm } from "@/components/admin/create-coupon-form";
import {
  deleteCouponAction,
  deleteRanchAction,
  deleteUserAction,
  enterRanchAsAdminAction,
  resetCouponRedemptionsAction,
  setCouponActiveAction,
  setRanchBetaAccessAction,
  setRanchSubscriptionStatusAction,
  setUserOnboardingStateAction,
} from "@/lib/admin/actions";
import { getAdminCoupons, getAdminRanches, getAdminUsers } from "@/lib/admin/queries";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";

function formatDate(value: Date | null): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

const subscriptionStatuses = ["inactive", "trialing", "active", "past_due", "canceled"] as const;

export default async function AdminPage() {
  const adminUser = await requirePlatformAdmin();
  const [users, ranches, coupons] = await Promise.all([
    getAdminUsers(),
    getAdminRanches(),
    getAdminCoupons(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Admin"
        title="Platform Control Center"
        description="Manage users, ranch billing access, and internal coupon codes."
        actions={
          <Link
            href="/app"
            className="rounded-xl border bg-surface px-3 py-2 text-sm font-semibold text-foreground-muted hover:bg-accent-soft hover:text-foreground"
          >
            Back to app
          </Link>
        }
      />

      <Card>
        <CardContent className="space-y-2 py-6 text-sm">
          <CardTitle>Admin Session</CardTitle>
          <CardDescription>
            Access is restricted to emails in <code>PLATFORM_ADMIN_EMAILS</code>.
          </CardDescription>
          <p>
            <span className="text-foreground-muted">Signed in as:</span> @{adminUser.username} (
            {adminUser.email})
          </p>
          <p>
            <span className="text-foreground-muted">Users:</span> {users.length}
            {" | "}
            <span className="text-foreground-muted">Ranches:</span> {ranches.length}
            {" | "}
            <span className="text-foreground-muted">Coupons:</span> {coupons.length}
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 py-6">
            <CardTitle>Create Coupon Code</CardTitle>
            <CardDescription>
              Codes are stored as hashes only. Keep original code strings in your secure admin notes.
            </CardDescription>
            <CreateCouponForm />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <CardTitle>Coupon Inventory</CardTitle>
            <CardDescription>Activate/deactivate or clear redemptions for testing.</CardDescription>
            <div className="space-y-3">
              {coupons.length ? (
                coupons.map((coupon) => (
                  <div key={coupon.id} className="rounded-xl border bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{coupon.name}</p>
                      <Badge variant={coupon.isActive ? "success" : "warning"}>
                        {coupon.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-foreground-muted">
                      Grant: {coupon.grantType} | Redemptions: {coupon.redemptionCount}
                      {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : " / unlimited"} |
                      Expires: {formatDate(coupon.expiresAt)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={setCouponActiveAction}>
                        <input type="hidden" name="couponId" value={coupon.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={coupon.isActive ? "false" : "true"}
                        />
                        <button
                          type="submit"
                          className="rounded-xl border bg-surface-strong px-3 py-2 text-xs font-semibold hover:bg-accent-soft"
                        >
                          {coupon.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      <form action={resetCouponRedemptionsAction}>
                        <input type="hidden" name="couponId" value={coupon.id} />
                        <button
                          type="submit"
                          className="rounded-xl border bg-surface-strong px-3 py-2 text-xs font-semibold hover:bg-accent-soft"
                        >
                          Reset redemptions
                        </button>
                      </form>
                      <form action={deleteCouponAction}>
                        <input type="hidden" name="couponId" value={coupon.id} />
                        <button
                          type="submit"
                          className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger hover:opacity-90"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-foreground-muted">No coupons created yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="space-y-3 py-6">
          <CardTitle>Ranch Billing Controls</CardTitle>
          <CardDescription>
            Override lifetime access/subscription status and enter a ranch workspace for support.
          </CardDescription>
          <div className="space-y-3">
            {ranches.map((ranch) => (
              <div key={ranch.id} className="rounded-xl border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {ranch.name} <span className="text-foreground-muted">({ranch.slug})</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant={ranch.betaLifetimeAccess ? "success" : "neutral"}>
                      {ranch.betaLifetimeAccess ? "Lifetime Access" : "No Lifetime Access"}
                    </Badge>
                    <Badge
                      variant={
                        ranch.subscriptionStatus === "active" || ranch.subscriptionStatus === "trialing"
                          ? "success"
                          : "warning"
                      }
                    >
                      {ranch.subscriptionStatus}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-foreground-muted">
                  Owners: {ranch.ownerCount} | Active members: {ranch.activeMemberCount} | Stripe
                  customer: {ranch.stripeCustomerId ?? "none"} | Stripe subscription:{" "}
                  {ranch.stripeSubscriptionId ?? "none"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={enterRanchAsAdminAction}>
                    <input type="hidden" name="ranchId" value={ranch.id} />
                    <button
                      type="submit"
                      className="rounded-xl border bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-hover"
                    >
                      Enter ranch workspace
                    </button>
                  </form>
                  <form action={setRanchBetaAccessAction}>
                    <input type="hidden" name="ranchId" value={ranch.id} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={ranch.betaLifetimeAccess ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="rounded-xl border bg-surface-strong px-3 py-2 text-xs font-semibold hover:bg-accent-soft"
                    >
                      {ranch.betaLifetimeAccess
                        ? "Disable lifetime access"
                        : "Enable lifetime access"}
                    </button>
                  </form>
                  <form action={setRanchSubscriptionStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="ranchId" value={ranch.id} />
                    <select
                      name="subscriptionStatus"
                      defaultValue={ranch.subscriptionStatus}
                      className="h-9 rounded-xl border bg-surface-strong px-3 text-xs"
                    >
                      {subscriptionStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-xl border bg-surface-strong px-3 py-2 text-xs font-semibold hover:bg-accent-soft"
                    >
                      Save status
                    </button>
                  </form>
                  <form action={deleteRanchAction}>
                    <input type="hidden" name="ranchId" value={ranch.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger hover:opacity-90"
                    >
                      Delete ranch permanently
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-6">
          <CardTitle>User Directory</CardTitle>
          <CardDescription>Read-only global user visibility.</CardDescription>
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="rounded-xl border bg-surface px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {user.fullName}{" "}
                    <span className="text-foreground-muted">
                      (@{user.username} | {user.email})
                    </span>
                  </p>
                  <Badge variant={user.onboardingState === "complete" ? "success" : "warning"}>
                    {user.onboardingState}
                  </Badge>
                </div>
                <p className="text-xs text-foreground-muted">
                  Memberships: {user.membershipCount} | Last ranch:{" "}
                  {user.lastActiveRanchId ?? "none"} | Created: {formatDate(user.createdAt)}
                </p>
                <form action={setUserOnboardingStateAction} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <select
                    name="onboardingState"
                    defaultValue={user.onboardingState}
                    className="h-8 rounded-xl border bg-surface-strong px-3 text-xs"
                  >
                    <option value="needs_ranch">needs_ranch</option>
                    <option value="complete">complete</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-xl border bg-surface-strong px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft"
                  >
                    Save user state
                  </button>
                </form>
                <form action={deleteUserAction} className="mt-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:opacity-90"
                  >
                    Delete user permanently
                  </button>
                </form>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
