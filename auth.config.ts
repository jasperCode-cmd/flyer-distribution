import type { NextAuthConfig } from "next-auth";

// Edge-safe config used by middleware. No Prisma/bcrypt imports here —
// the Edge runtime can't run either, so credential verification lives
// only in auth.ts (Node runtime), not here.
export const authConfig = {
  pages: {
    signIn: "/admin/crm/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname === "/admin/crm/login";
      const isOnCrm = request.nextUrl.pathname.startsWith("/admin/crm");

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/admin/crm", request.nextUrl));
        }
        return true;
      }

      if (isOnCrm) {
        return isLoggedIn;
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
