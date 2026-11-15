import { NextResponse, type NextRequest } from "next/server";
import { FAMILY_COOKIE, SESSION_COOKIE, verifyFamilyToken, verifySessionToken } from "./server/tokens";

/**
 * Fast first gate: family passcode, then a signed-in person.
 * Pages and actions re-check everything via requireUser(); this only routes people to the right door.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The admin page has its own password and works without a family.
  if (pathname === "/admin") return NextResponse.next();
  const hasFamily = (await verifyFamilyToken(request.cookies.get(FAMILY_COOKIE)?.value)) !== null;

  if (pathname === "/welcome") {
    return hasFamily ? NextResponse.redirect(new URL("/sign-in", request.url)) : NextResponse.next();
  }
  if (!hasFamily) return NextResponse.redirect(new URL("/welcome", request.url));
  if (pathname === "/sign-in") return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
