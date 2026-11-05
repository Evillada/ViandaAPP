export type PackageDisplayStatus = "ACTIVE" | "EXPIRED" | "COMPLETED" | "CANCELLED";

export function packageDisplayStatus(
  status: "ACTIVE" | "COMPLETED" | "CANCELLED",
  endsAt: Date | null,
  now: Date
): PackageDisplayStatus {
  if (status === "ACTIVE" && endsAt && endsAt.getTime() < now.getTime()) return "EXPIRED";
  return status;
}

export const PACKAGE_STATUS_LABELS: Record<PackageDisplayStatus, string> = {
  ACTIVE: "Vigente",
  EXPIRED: "Vencido",
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
};
