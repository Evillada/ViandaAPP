import { headers } from "next/headers";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: forwarded || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}

/**
 * Public origin for links that carry secrets (invitation tokens). Uses the configured URL so a forged
 * Host / X-Forwarded-Host header cannot make the app hand out a link to another domain.
 */
export async function getRequestOrigin(): Promise<string> {
  const configured = process.env.APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL (o AUTH_URL/NEXTAUTH_URL) debe estar configurada en producción");
  }
  const h = await headers();
  return `http://${h.get("host") ?? "localhost:3000"}`;
}
