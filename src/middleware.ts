export { auth as middleware } from "@/infrastructure/auth/auth";

export const config = {
  matcher: ["/dashboard/:path*"],
};
