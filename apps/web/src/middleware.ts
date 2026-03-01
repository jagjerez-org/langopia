import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { UserRole } from "@langopia/shared/types";

const protectedPaths = ["/dashboard", "/classroom", "/reports", "/admin", "/session", "/settings", "/profile"];
const adminPaths = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth.user?.role as UserRole | undefined;

  const isAdminRoute = adminPaths.some((path) => pathname.startsWith(path));
  if (isAdminRoute && role !== UserRole.ADMIN) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/classroom/:path*",
    "/reports/:path*",
    "/admin/:path*",
    "/session/:path*",
    "/settings/:path*",
    "/profile/:path*",
  ],
};
