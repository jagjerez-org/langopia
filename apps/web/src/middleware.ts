import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth protection is handled client-side by AuthProvider in the dashboard layout.
// JWT tokens are stored in localStorage and are not accessible in edge middleware.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
