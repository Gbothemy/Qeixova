export type AdminRole = "super_admin" | "operations" | "finance" | "reviewer" | "support" | "analyst";

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: ["*"],
  operations: ["dashboard.read", "accounts.read", "accounts.manage", "campaigns.read", "campaigns.manage", "proofs.read", "proofs.manage", "risk.read", "risk.manage", "notes.read", "notes.manage", "support.read", "support.manage", "exports.read"],
  finance: ["dashboard.read", "withdrawals.read", "withdrawals.manage", "economy.read", "economy.manage", "analytics.read", "exports.read"],
  reviewer: ["dashboard.read", "campaigns.read", "campaigns.manage", "proofs.read", "proofs.manage", "disputes.read", "disputes.manage", "notes.read", "notes.manage"],
  support: ["dashboard.read", "accounts.read", "notes.read", "notes.manage", "support.read", "support.manage", "privacy.read", "privacy.manage", "alerts.read"],
  analyst: ["dashboard.read", "accounts.read", "campaigns.read", "proofs.read", "withdrawals.read", "analytics.read", "exports.read", "audit.read"],
};

export function normalizeAdminRole(role: unknown): AdminRole {
  return role === "admin" ? "super_admin" : (["super_admin", "operations", "finance", "reviewer", "support", "analyst"].includes(String(role)) ? String(role) : "analyst") as AdminRole;
}

export function roleCan(role: AdminRole, permission: string) {
  const allowed = ADMIN_ROLE_PERMISSIONS[role] ?? [];
  return allowed.includes("*") || allowed.includes(permission);
}

export function adminRoutePermission(pathname: string): string {
  if (pathname.startsWith("/admin/operations")) return "dashboard.read";
  if (pathname.startsWith("/admin/users") || pathname.startsWith("/admin/businesses")) return "accounts.read";
  if (pathname.startsWith("/admin/campaigns") || pathname.startsWith("/admin/tasks")) return "campaigns.read";
  if (pathname.startsWith("/admin/completions")) return "proofs.read";
  if (pathname.startsWith("/admin/withdrawals")) return "withdrawals.read";
  if (pathname.startsWith("/admin/logs")) return "audit.read";
  if (pathname.startsWith("/admin/config")) return "economy.read";
  return "dashboard.read";
}
