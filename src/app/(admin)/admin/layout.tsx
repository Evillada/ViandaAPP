import { redirect } from "next/navigation";
import { ADMIN_NAV, AREA_LABELS, areaLinks } from "@/features/identity/navigation";
import { signOutAction, switchAreaAction } from "@/features/identity/session-actions";
import { getActorFor } from "@/infrastructure/access/access-context";
import { auth } from "@/infrastructure/auth/auth";
import { AppShell } from "@/shared/ui/navigation/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const actor = await getActorFor("ADMIN");
  if (!actor) redirect("/start");

  return (
    <AppShell
      areaLabel={AREA_LABELS.ADMIN}
      items={ADMIN_NAV}
      areas={areaLinks(actor, "ADMIN")}
      user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
      switchAreaAction={switchAreaAction}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
