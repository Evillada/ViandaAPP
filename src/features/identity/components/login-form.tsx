"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, PasswordInput } from "@/shared/ui/components";
import { useHydrated } from "@/shared/lib/use-hydrated";
import { safeCallbackUrl } from "../safe-callback-url";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));
  const deleted = searchParams.get("deleted") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hydrated = useHydrated();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Email o contraseña incorrectos");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <>
      {deleted && (
        <p role="status" className="mb-5 rounded-lg border border-primary/30 bg-primary-light px-4 py-3 text-sm text-text">
          Tu cuenta fue eliminada. Tu nutricionista conserva tu historia clínica.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="min-h-11"
          required
        />
        <PasswordInput
          label="Contraseña"
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="min-h-11"
          required
        />
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" className="w-full min-h-11" size="lg" disabled={loading || !hydrated}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted mt-6">
        ¿Eres nutricionista y no tienes cuenta?{" "}
        <Link href="/register" className="inline-flex min-h-11 items-center text-primary hover:underline font-medium">
          Regístrate
        </Link>
      </p>
    </>
  );
}
