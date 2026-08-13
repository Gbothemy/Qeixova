"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "OV" },
  { href: "/admin/users", label: "Users", icon: "US" },
  { href: "/admin/tasks", label: "Missions", icon: "MS" },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: "WD" },
  { href: "/admin/completions", label: "Submissions", icon: "RV" },
  { href: "/admin/logs", label: "Audit Logs", icon: "LG" },
  { href: "/admin/config", label: "Economy", icon: "EC" },
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
      <div style={{ padding: "28px 24px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#F8FAFC", fontWeight: 800, fontSize: 20 }}>Qeixova</div>
            <div style={{ color: "#F5A623", fontSize: 11, marginTop: 2, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" }}>Admin Portal</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 22, cursor: "pointer", display: "none" }}
            className="admin-close-btn"
            aria-label="Close admin menu"
          >
            x
          </button>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "18px 12px" }} aria-label="Admin navigation">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "11px 12px",
                borderRadius: 12,
                color: active ? "#F8FAFC" : "rgba(255,255,255,0.66)",
                background: active ? "rgba(245,166,35,0.14)" : "transparent",
                border: active ? "1px solid rgba(245,166,35,0.2)" : "1px solid transparent",
                textDecoration: "none", fontSize: 14,
                fontWeight: active ? 800 : 600,
                transition: "all 0.15s",
                marginBottom: 4,
              }}
            >
              <span style={{
                width: 32, height: 32, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 900, color: active ? "#0f172a" : "rgba(255,255,255,0.52)",
                background: active ? "#F5A623" : "rgba(255,255,255,0.06)",
                flexShrink: 0,
              }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "16px 18px 22px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={onLogout}
          style={{
            width: "100%", padding: "11px 14px",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12, color: "rgba(255,255,255,0.72)",
            cursor: "pointer", fontSize: 13, textAlign: "left", fontWeight: 700,
          }}
        >
          Log out
        </button>
      </div>
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
  }

  return (
    <>
      <div className="admin-topbar">
        <button
          onClick={() => setOpen(true)}
          style={{
            background: "none", border: "none", color: "#F5A623",
            fontSize: 24, cursor: "pointer", lineHeight: 1,
          }}
          aria-label="Open admin menu"
        >
          Menu
        </button>
        <span style={{ color: "#F5A623", fontWeight: 700, fontSize: 16 }}>Qeixova Admin</span>
      </div>

      {open && <div className="admin-overlay" onClick={() => setOpen(false)} />}

      <aside className={`admin-sidebar${open ? " open" : ""}`} style={{ display: "flex", flexDirection: "column" }}>
        <SidebarContent pathname={pathname} onClose={() => setOpen(false)} onLogout={handleLogout} />
      </aside>
    </>
  );
}
