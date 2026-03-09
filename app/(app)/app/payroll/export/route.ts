import { NextResponse, type NextRequest } from "next/server";
import { getCurrentRanchContext, getCurrentUser } from "@/lib/auth/context";
import { hasBillingAccess } from "@/lib/billing/access";
import { buildPayrollCsv } from "@/lib/payroll/csv";
import { resolvePayrollDateRange } from "@/lib/payroll/date-range";
import { getPayrollSummaryForRange } from "@/lib/payroll/queries";

function toFileSafeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ranchContext = await getCurrentRanchContext();
  if (!ranchContext) {
    return NextResponse.json({ error: "No ranch access" }, { status: 403 });
  }

  if (ranchContext.membership.role === "worker") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasBillingAccess(ranchContext.ranch)) {
    return NextResponse.json({ error: "Billing required" }, { status: 402 });
  }

  const fromInput = request.nextUrl.searchParams.get("from") ?? undefined;
  const toInput = request.nextUrl.searchParams.get("to") ?? undefined;
  const range = resolvePayrollDateRange(fromInput, toInput);
  const summary = await getPayrollSummaryForRange(
    ranchContext.ranch.id,
    range.fromDate,
    range.toDateExclusive,
  );
  const csv = buildPayrollCsv(summary.rows);
  const ranchSlug = toFileSafeName(ranchContext.ranch.slug || ranchContext.ranch.name);
  const filename = `payroll-${ranchSlug || "ranch"}-${range.from}-to-${range.to}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}
