import Link from "next/link";
import { auth, signOut } from "@/infrastructure/auth/auth";
import { redirect } from "next/navigation";
import { cn } from "@/shared/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: "🏠" },
  { href: "/dashboard/patients", label: "Pacientes", icon: "👥" },
  { href: "/dashboard/appointments", label: "Citas", icon: "📅" },
  { href: "/dashboard/tools", label: "Herramientas", icon: "🧮" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-surface">
        <div className="p-6 border-b border-border">
          <Link href="/dashboard" className="block">
            <h1 className="text-xl font-bold text-text">
              Via<span className="text-primary">nda</span>
            </h1>
            <p className="text-xs text-muted mt-1">Nutrición clínica</p>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:bg-primary-light hover:text-primary transition-colors"
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center text-primary font-semibold text-sm">
              {session.user.name?.[0]?.toUpperCase() ?? "P"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-muted truncate">{session.user.email}</p>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full text-left text-sm text-muted hover:text-danger px-2 py-1 transition-colors"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b border-border bg-surface px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-text">
            Via<span className="text-primary">nda</span>
          </h1>
          <nav className="flex gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-lg"
                title={item.label}
              >
                {item.icon}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
