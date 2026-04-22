import { NextResponse, type NextRequest } from "next/server";
import {
  sessionCookieName,
  getValidSessionByToken,
  revokeSessionByToken,
  shouldUseSecureSessionCookies,
} from "@/lib/auth/session";
import { autoClockOutActiveTimeForUser } from "@/lib/time/maintenance";

async function handleLogout(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  if (token) {
    try {
      const session = await getValidSessionByToken(token);
      if (session) {
        await autoClockOutActiveTimeForUser(session.userId);
      }
    } catch {
      // Best-effort closeout should not block logout.
    }

    try {
      await revokeSessionByToken(token);
    } catch {
      // Continue clearing cookie + redirect even if revocation fails.
    }
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/login",
    },
  });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookies(),
    path: "/",
    expires: new Date(0),
  });
  return response;
}

export async function GET(request: NextRequest) {
  return handleLogout(request);
}

export async function POST(request: NextRequest) {
  return handleLogout(request);
}
