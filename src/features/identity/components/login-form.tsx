"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@/shared/ui/components";

function safeCallbackUrl(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/start";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        <Input
          label="Contraseña"
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="min-h-11"
          required
        />
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" className="w-full min-h-11" size="lg" disabled={loading}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted mt-6">
        ¿Eres nutricionista y no tienes cuenta?{" "}
        <Link href="/register" className="text-primary hover:underline font-medium">
          Regístrate
        </Link>
      </p>
    </>
  );
}
