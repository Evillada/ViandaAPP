"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import {
  Calculator,
  CalendarDays,
  HeartPulse,
  House,
  LogOut,
  ShieldCheck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Area } from "@/core/access/types";
import type { NavIconName, NavItem } from "@/features/identity/navigation";
import { Logo } from "@/shared/ui/brand/logo";
import { cn } from "@/shared/lib/utils";

const ICONS: Record<NavIconName, LucideIcon> = {
  home: House,
  users: Users,
  calendar: CalendarDays,
  calculator: Calculator,
  shield: ShieldCheck,
  heart: HeartPulse,
};

interface AppShellProps {
  areaLabel: string;
  items: NavItem[];
  areas: { area: Area; label: string; active: boolean }[];
  user: { name: string | null; email: string | null };
  switchAreaAction: (formData: FormData) => Promise<void>;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({ areaLabel, items, areas, user, switchAreaAction, signOutAction, children }: AppShellProps) {
  const pathname = usePathname();
  const accountDialogRef = useRef<HTMLDialogElement>(null);
  const initial = user.name?.[0]?.toUpperCase() ?? "V";

  const accountPanel = (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-primary-light flex items-center justify-center text-primary font-semibold">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text truncate">{user.name}</p>
          <p className="text-xs text-muted truncate">{user.email}</p>
        </div>
      </div>
      {areas.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Cambiar de área</p>
          {areas.map((a) => (
            <form key={a.area} action={switchAreaAction}>
              <input type="hidden" name="area" value={a.area} />
              <button
                type="submit"
                disabled={a.active}
                className={cn(
                  "w-full min-h-11 rounded-xl px-4 text-left text-sm font-medium border",
                  a.active ? "border-primary bg-primary-light text-primary" : "border-border text-text hover:bg-primary-light"
                )}
              >
                {a.label}
              </button>
            </form>
          ))}
        </div>
      )}
      <form action={signOutAction}>
        <button
          type="submit"
          className="w-full min-h-11 rounded-xl px-4 flex items-center gap-2 text-sm font-medium text-danger border border-border hover:bg-danger/5"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background md:flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="p-6 border-b border-border">
          <Logo />
          <p className="text-xs text-muted mt-2">{areaLabel}</p>
        </div>
        <nav aria-label="Navegación lateral" className="flex-1 p-4 space-y-1">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm font-medium transition-colors",
                  active ? "bg-primary-light text-primary" : "text-muted hover:bg-primary-light hover:text-primary"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">{accountPanel}</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur px-4 py-3 flex items-center justify-between">
          <Logo />
          <span className="text-xs font-medium text-muted">{areaLabel}</span>
        </header>

        <main className="flex-1 p-4 pb-28 md:p-8 md:pb-8">{children}</main>
      </div>

      <nav
        aria-label="Navegación principal"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="flex">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => accountDialogRef.current?.showModal()}
              aria-haspopup="dialog"
              className="flex w-full min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted"
            >
              <UserRound className="h-5 w-5" aria-hidden="true" />
              Cuenta
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={accountDialogRef}
        aria-label="Cuenta"
        className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-2xl bg-surface p-0 backdrop:bg-black/40"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.currentTarget.close();
        }}
      >
        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-text">Cuenta</p>
            <button
              type="button"
              onClick={() => accountDialogRef.current?.close()}
              aria-label="Cerrar"
              className="h-11 w-11 flex items-center justify-center rounded-full text-muted hover:bg-background"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {accountPanel}
        </div>
      </dialog>
    </div>
  );
}
