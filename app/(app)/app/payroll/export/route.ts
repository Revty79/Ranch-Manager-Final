import { NextResponse, type NextRequest } from "next/server";
import { hasSectionAccess } from "@/lib/auth/capabilities";
import { getCurrentRanchContext, getCurrentUser } from "@/lib/auth/context";
import { hasBillingAccess } from "@/lib/billing/access";
import { buildPayrollBreakdownCsv, buildPayrollCsv } from "@/lib/payroll/csv";
import { resolvePayrollDateRange } from "@/lib/payroll/date-range";
import {
  getPayrollBreakdownForRange,
  getPayrollSummaryForRange,
} from "@/lib/payroll/queries";
import { autoCloseStaleTimeEntriesForRanch } from "@/lib/time/maintenance";

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

  if (!hasSectionAccess(ranchContext.membership.sectionAccess, "payroll", "manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasBillingAccess(ranchContext.ranch)) {
    return NextResponse.json({ error: "Billing required" }, { status: 402 });
  }

  const fromInput = request.nextUrl.searchParams.get("from") ?? undefined;
  const toInput = request.nextUrl.searchParams.get("to") ?? undefined;
  const type = request.nextUrl.searchParams.get("type");
  const exportType = type === "breakdown" ? "breakdown" : "summary";
  const range = resolvePayrollDateRange(fromInput, toInput);
  const ranchSlug = toFileSafeName(ranchContext.ranch.slug || ranchContext.ranch.name);
  await autoCloseStaleTimeEntriesForRanch(ranchContext.ranch.id);

  let csv: string;
  let filename: string;

  if (exportType === "breakdown") {
    const breakdown = await getPayrollBreakdownForRange(
      ranchContext.ranch.id,
      range.fromDate,
      range.toDateExclusive,
    );
    csv = buildPayrollBreakdownCsv(breakdown, ranchContext.ranch.timeZone);
    filename = `payroll-breakdown-${ranchSlug || "ranch"}-${range.from}-to-${range.to}.csv`;
  } else {
    const summary = await getPayrollSummaryForRange(
      ranchContext.ranch.id,
      range.fromDate,
      range.toDateExclusive,
    );
    csv = buildPayrollCsv(summary.rows);
    filename = `payroll-${ranchSlug || "ranch"}-${range.from}-to-${range.to}.csv`;
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}
