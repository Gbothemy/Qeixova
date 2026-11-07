"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AdminRole, roleCan } from "@/lib/adminRoles";

const NAV = [
  { group: "Workspace", href: "/admin", label: "Overview", icon: "OV", permission: "dashboard.read" },
  { group: "Workspace", href: "/admin/operations", label: "Operations", icon: "OP", permission: "dashboard.read" },
  { group: "People", href: "/admin/users", label: "Users", icon: "US", permission: "accounts.read" },
  { group: "People", href: "/admin/businesses", label: "Businesses", icon: "BZ", permission: "accounts.read" },
  { group: "People", href: "/admin/email", label: "Email center", icon: "EM", permission: "accounts.manage" },
  { group: "Campaigns", href: "/admin/campaigns", label: "Campaign review", icon: "AP", permission: "campaigns.read" },
  { group: "Campaigns", href: "/admin/tasks", label: "Missions", icon: "MS", permission: "campaigns.read" },
  { group: "Campaigns", href: "/admin/completions", label: "Mission proof", icon: "RV", permission: "proofs.read" },
  { group: "Finance", href: "/admin/withdrawals", label: "Withdrawals", icon: "WD", permission: "withdrawals.read" },
  { group: "Finance", href: "/admin/config", label: "Economy", icon: "EC", permission: "economy.read" },
  { group: "System", href: "/admin/logs", label: "Audit logs", icon: "LG", permission: "audit.read" },
];

const NAV_GROUPS = ["Workspace", "People", "Campaigns", "Finance", "System"] as const;

function SidebarContent({
  pathname,
  onClose,
  onLogout,
  role,
  name,
}: {
  pathname: string;
  onClose: () => void;
  onLogout: () => void;
  role: AdminRole;
  name: string;
}) {
  return (
    <>
      <header className="adminBrand">
        <span className="adminBrandMark" aria-hidden="true">Q</span>
        <div>
          <strong>Qeixova</strong>
          <small>Admin Control</small>
        </div>
        <button className="admin-close-btn" type="button" onClick={onClose} aria-label="Close admin menu">×</button>
      </header>

      <nav className="adminNav" aria-label="Admin navigation">
        {NAV_GROUPS.map((group) => {
          const items = NAV.filter(item => item.group === group && roleCan(role, item.permission));
          if (!items.length) return null;
          return <section className="adminNavGroup" key={group}>
            <p className="adminNavLabel">{group}</p>
            {items.map((item) => {
              const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
              return (
                <Link key={item.href} href={item.href} onClick={onClose} className={active ? "active" : ""}>
                  <span className="adminNavIcon" aria-hidden="true">{item.icon}</span>
                  <strong>{item.label}</strong>
                </Link>
              );
            })}
          </section>;
        })}
      </nav>

      <footer className="adminAccount">
        <span>Signed in as</span>
        <strong>{name}</strong>
        <small>{role.replaceAll("_", " ")}</small>
        <button type="button" onClick={onLogout}>Log out</button>
      </footer>
    </>
  );
}

export default function AdminSidebar({ role, name }: { role: AdminRole; name: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin-login");
    router.refresh();
  }

  return (
    <>
      <div className="admin-topbar">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open admin menu">☰</button>
        <span className="adminBrandMark" aria-hidden="true">Q</span>
        <strong>Qeixova Admin</strong>
      </div>
      {open && <button className="admin-overlay" type="button" onClick={() => setOpen(false)} aria-label="Close admin menu" />}
      <aside className={`admin-sidebar${open ? " open" : ""}`}>
        <SidebarContent pathname={pathname} onClose={() => setOpen(false)} onLogout={handleLogout} role={role} name={name} />
      </aside>
    </>
  );
}
