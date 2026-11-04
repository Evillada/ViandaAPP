"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/shared/ui/components";
import { createInviteAccountAction } from "../actions";

export function InviteSignUp({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await createInviteAccountAction(token, formData);
    if (result.error || !result.email) {
      setError(result.error ?? "No se pudo crear la cuenta");
      setLoading(false);
      return;
    }
    const login = await signIn("credentials", { email: result.email, password: formData.get("password"), redirect: false });
    setLoading(false);
    if (login?.error) {
      setError("Cuenta creada. Inicia sesión para continuar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-text">Crea tu cuenta</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nombre completo" id="name" name="name" defaultValue={defaultName} autoComplete="name" className="min-h-11" required />
        <Input label="Email" id="email" name="email" type="email" inputMode="email" autoComplete="email" className="min-h-11" required />
        <Input label="Contraseña" id="password" name="password" type="password" autoComplete="new-password" minLength={6} className="min-h-11" required />
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" className="w-full min-h-11" disabled={loading}>
          {loading ? "Creando cuenta..." : "Crear cuenta y continuar"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
          className="inline-flex min-h-11 items-center text-primary font-medium hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
