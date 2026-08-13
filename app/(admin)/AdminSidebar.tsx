"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin", label: "Dashboard", description: "Operations overview", icon: "OV" },
  { href: "/admin/users", label: "Users", description: "Contributor accounts", icon: "US" },
  { href: "/admin/businesses", label: "Businesses", description: "Registered business accounts", icon: "BZ" },
  { href: "/admin/campaigns", label: "Campaign Review", description: "Approve or reject business campaigns", icon: "AP" },
  { href: "/admin/tasks", label: "Missions", description: "Campaign inventory", icon: "MS" },
  { href: "/admin/completions", label: "Mission Proof", description: "Approve completed user missions", icon: "RV" },
  { href: "/admin/withdrawals", label: "Withdrawals", description: "Payout operations", icon: "WD" },
  { href: "/admin/logs", label: "Audit Logs", description: "System activity", icon: "LG" },
  { href: "/admin/config", label: "Economy", description: "Reward controls", icon: "EC" },
];

function SidebarContent({
  pathname,
  onClose,
  onLogout,
}: {
  pathname: string;
  onClose: () => void;
  onLogout: () => void;
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

      <p className="adminNavLabel">Operate</p>
      <nav className="adminNav" aria-label="Admin navigation">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
          return (
            <Link key={item.href} href={item.href} onClick={onClose} className={active ? "active" : ""}>
              <span className="adminNavIcon" aria-hidden="true">{item.icon}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </Link>
          );
        })}
      </nav>

      <footer className="adminAccount">
        <span>Signed in as</span>
        <strong>Platform admin</strong>
        <button type="button" onClick={onLogout}>Log out</button>
      </footer>
    </>
  );
}

export default function AdminSidebar() {
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
        <SidebarContent pathname={pathname} onClose={() => setOpen(false)} onLogout={handleLogout} />
      </aside>
    </>
  );
}
