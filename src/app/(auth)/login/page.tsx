import { Suspense } from "react";
import { LoginForm } from "@/features/identity/components/login-form";
import { Logo } from "@/shared/ui/brand/logo";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center gradient-wellness px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 sm:p-8 shadow-xl border border-border">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo />
          <p className="text-muted mt-3">Inicia sesión en tu cuenta</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
