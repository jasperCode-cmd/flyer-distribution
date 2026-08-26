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
      const pathname = request.nextUrl.pathname;
      const isOnLogin = pathname === "/admin/crm/login";
      const isOnChangePassword = pathname === "/admin/crm/change-password";
      const isOnCrm = pathname.startsWith("/admin/crm");

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/admin/crm", request.nextUrl));
        }
        return true;
      }

      if (isOnCrm) {
        if (!isLoggedIn) return false;

        // Enforced here (server-side, edge middleware) rather than only
        // client-side, so it can't be bypassed by skipping a redirect.
        if (auth.user.mustChangePassword && !isOnChangePassword) {
          return Response.redirect(new URL("/admin/crm/change-password", request.nextUrl));
        }

        return true;
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }
      if (trigger === "update" && session && typeof session.mustChangePassword === "boolean") {
        token.mustChangePassword = session.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
