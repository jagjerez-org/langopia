import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const adminPaths = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth.user?.role as string | undefined;
  const isAdminRoute = adminPaths.some((path) => pathname.startsWith(path));
  if (isAdminRoute && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

import { NextResponse } from "next/server";

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
