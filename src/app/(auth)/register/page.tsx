"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useHydrated } from "@/shared/lib/use-hydrated";
import { Button, Input, PasswordInput } from "@/shared/ui/components";
import Link from "next/link";
import { Logo } from "@/shared/ui/brand/logo";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hydrated = useHydrated();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, licenseNumber }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Error al crear la cuenta");
      setLoading(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (signInResult?.error) {
      router.push("/login");
      return;
    }

    router.push("/start");
    router.refresh();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center gradient-wellness px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 sm:p-8 shadow-xl border border-border">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo />
          <p className="text-muted mt-3">Crea tu cuenta de nutricionista</p>
          <p className="text-xs text-muted mt-1">Verificamos tu tarjeta profesional antes de activar el acceso.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Nombre completo"
            id="name"
            type="text"
            autoComplete="name"
            className="min-h-11"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Juan Pérez"
            required
          />
          <Input
            label="Email"
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="min-h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
          />
          <PasswordInput
            label="Contraseña"
            id="password"
            autoComplete="new-password"
            className="min-h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
            minLength={6}
          />
          <Input
            label="Número de tarjeta profesional"
            id="licenseNumber"
            type="text"
            autoComplete="off"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="Ej: TP-123456"
            className="min-h-11"
            required
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full min-h-11" size="lg" disabled={loading || !hydrated}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="inline-flex min-h-11 items-center px-1 text-primary hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
