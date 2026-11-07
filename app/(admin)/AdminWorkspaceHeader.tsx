"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const pages: Record<string, { group: string; label: string }> = {
  "/admin": { group: "Workspace", label: "Overview" },
  "/admin/operations": { group: "Workspace", label: "Operations" },
  "/admin/users": { group: "People", label: "Users" },
  "/admin/businesses": { group: "People", label: "Businesses" },
  "/admin/email": { group: "People", label: "Email center" },
  "/admin/campaigns": { group: "Campaigns", label: "Campaign review" },
  "/admin/tasks": { group: "Campaigns", label: "Missions" },
  "/admin/completions": { group: "Campaigns", label: "Mission proof" },
  "/admin/withdrawals": { group: "Finance", label: "Withdrawals" },
  "/admin/config": { group: "Finance", label: "Economy" },
  "/admin/logs": { group: "System", label: "Audit logs" },
};

export default function AdminWorkspaceHeader({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const page = pages[pathname] ?? { group: "Workspace", label: "Administration" };
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";

  return (
    <header className="adminWorkspaceHeader">
      <div className="adminBreadcrumb" aria-label="Current page">
        <span>Admin workspace</span><span className="adminBreadcrumbDivider">/</span><span>{page.group}</span>
        <span className="adminBreadcrumbDivider">/</span><strong>{page.label}</strong>
      </div>
      <div className="adminWorkspaceTools">
        <ThemeToggle compact />
        <span className="adminWorkspaceDivider" aria-hidden="true" />
        <span className="adminWorkspaceAvatar" aria-hidden="true">{initials}</span>
        <span className="adminWorkspaceIdentity"><strong>{name}</strong><small>{role.replaceAll("_", " ")}</small></span>
      </div>
    </header>
  );
}
