import { NextResponse, type NextRequest } from "next/server";
import { hasSectionAccess } from "@/lib/auth/capabilities";
import { getCurrentRanchContext, getCurrentUser } from "@/lib/auth/context";
import { hasBillingAccess } from "@/lib/billing/access";
import {
  buildHerdDueCsv,
  buildHerdInventoryCsv,
  getHerdDueReport,
  getHerdInventoryReport,
} from "@/lib/herd/reporting";

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

  if (!hasSectionAccess(ranchContext.membership.sectionAccess, "herd", "manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasBillingAccess(ranchContext.ranch)) {
    return NextResponse.json({ error: "Billing required" }, { status: 402 });
  }

  const type = request.nextUrl.searchParams.get("type");
  const exportType = type === "due" ? "due" : "inventory";
  const ranchSlug = toFileSafeName(ranchContext.ranch.slug || ranchContext.ranch.name);

  let csv: string;
  let filename: string;

  if (exportType === "due") {
    const dueRows = await getHerdDueReport(ranchContext.ranch.id);
    csv = buildHerdDueCsv(dueRows);
    filename = `herd-due-${ranchSlug || "ranch"}.csv`;
  } else {
    const inventoryRows = await getHerdInventoryReport(ranchContext.ranch.id);
    csv = buildHerdInventoryCsv(inventoryRows);
    filename = `herd-inventory-${ranchSlug || "ranch"}.csv`;
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}
