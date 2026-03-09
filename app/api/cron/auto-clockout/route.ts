import { NextResponse } from "next/server";
import { forceClockOutAllActiveTimeForAllRanches } from "@/lib/time/maintenance";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  return bearerToken === cronSecret || cronHeader === cronSecret;
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Missing CRON_SECRET" }, { status: 500 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const processedRanches = await forceClockOutAllActiveTimeForAllRanches(new Date());
  return NextResponse.json({
    ok: true,
    processedRanches,
    timestamp: new Date().toISOString(),
  });
}
