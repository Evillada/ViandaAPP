import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const PROTECTED_PREFIXES = ["/dashboard", "/portal", "/admin", "/pending", "/start"];

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isProtected = PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
      if (isProtected && !auth?.user) {
        const loginUrl = new URL("/login", request.nextUrl);
        loginUrl.searchParams.set("callbackUrl", path);
        return NextResponse.redirect(loginUrl);
      }
      return true;
    },
  },
});
