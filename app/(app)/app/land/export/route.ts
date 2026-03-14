import { NextResponse, type NextRequest } from "next/server";
import { getCurrentRanchContext, getCurrentUser } from "@/lib/auth/context";
import { hasBillingAccess } from "@/lib/billing/access";
import {
  buildGrazingRestCsv,
  buildMovementCsv,
  buildOccupancyCsv,
  getCurrentOccupancyReport,
  getGrazingRestReport,
  getRecentMovementReport,
} from "@/lib/land/reporting";

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

  if (
    ranchContext.membership.role === "worker" ||
    ranchContext.membership.role === "seasonal_worker"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasBillingAccess(ranchContext.ranch)) {
    return NextResponse.json({ error: "Billing required" }, { status: 402 });
  }

  const type = request.nextUrl.searchParams.get("type");
  const exportType =
    type === "movement" || type === "grazing_rest" ? type : "occupancy";
  const ranchSlug = toFileSafeName(ranchContext.ranch.slug || ranchContext.ranch.name);

  let csv: string;
  let filename: string;

  if (exportType === "movement") {
    const rows = await getRecentMovementReport(ranchContext.ranch.id, 60);
    csv = buildMovementCsv(rows);
    filename = `land-movement-${ranchSlug || "ranch"}.csv`;
  } else if (exportType === "grazing_rest") {
    const rows = await getGrazingRestReport(ranchContext.ranch.id);
    csv = buildGrazingRestCsv(rows);
    filename = `land-grazing-rest-${ranchSlug || "ranch"}.csv`;
  } else {
    const rows = await getCurrentOccupancyReport(ranchContext.ranch.id);
    csv = buildOccupancyCsv(rows);
    filename = `land-occupancy-${ranchSlug || "ranch"}.csv`;
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}
