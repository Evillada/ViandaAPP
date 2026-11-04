import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "@/features/identity/verify-credentials";

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const ip = request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        return verifyCredentials(credentials.email as string, credentials.password as string, ip);
      },
    }),
  ],
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) session.user.id = token.id;
      return session;
    },
  },
};
