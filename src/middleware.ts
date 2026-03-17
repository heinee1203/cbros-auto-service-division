import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { ROUTE_PERMISSIONS } from "@/lib/permissions";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Check route-level permissions
    for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
      if (pathname.startsWith(route)) {
        const { PERMISSIONS } = require("@/lib/permissions");
        const allowed = PERMISSIONS[permission] as readonly string[];
        if (!allowed?.includes(token.role as string)) {
          return NextResponse.redirect(new URL("/", req.url));
        }
      }
    }

    // Role-based home redirect: shop floor roles go to frontliner
    const FRONTLINER_ROLES = ["TECHNICIAN", "QC_INSPECTOR", "ADVISOR"];
    if (pathname === "/" && FRONTLINER_ROLES.includes(token.role as string)) {
      return NextResponse.redirect(new URL("/frontliner", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - api/auth (NextAuth routes)
     * - login, pin-login (auth pages)
     * - _next (Next.js internals)
     * - static files
     */
    "/((?!api/auth|api/health|api/supplements/approve|approve|view|login|pin-login|clock|_next/static|_next/image|favicon.ico|manifest.json|icons/).*)",
  ],
};
