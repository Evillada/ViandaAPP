export { auth as proxy } from "@/infrastructure/auth/auth";

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*", "/admin/:path*", "/pending", "/start"],
};
