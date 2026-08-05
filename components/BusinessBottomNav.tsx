"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  { href: "/business/dashboard", label: "Overview", icon: "/icon-home.svg" },
  { href: "/business/tasks", label: "Campaigns", icon: "/icon-task.svg" },
  { href: "/business/tasks/new", label: "Create", icon: "/icon-content.svg" },
  { href: "/business/wallet", label: "Billing", icon: "/icon-wallet.svg" },
  { href: "/business/growth", label: "Alerts", icon: "/icon-notifications.svg" },
  { href: "/business/profile", label: "Profile", icon: "/icon-profile.svg" },
];

export default function BusinessBottomNav() {
  const path = usePathname();
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const unreadAlertLabel = unreadAlerts > 99 ? "99+" : String(unreadAlerts);

  useEffect(() => {
    let mounted = true;
    const loadUnreadAlerts = async () => {
      const res = await fetch("/api/business/notifications", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json().catch(() => ({}));
      if (mounted) setUnreadAlerts(Number(data.unread ?? 0));
    };
    const handleAlertUpdate = (event: Event) => {
      const unread = (event as CustomEvent<{ unread?: number }>).detail?.unread;
      if (typeof unread === "number") setUnreadAlerts(Math.max(0, unread));
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadUnreadAlerts();
    };
    loadUnreadAlerts();
    window.addEventListener("businessAlertsUpdated", handleAlertUpdate);
    window.addEventListener("focus", loadUnreadAlerts);
    document.addEventListener("visibilitychange", handleVisibility);
    const timer = window.setInterval(loadUnreadAlerts, 10000);
    return () => {
      mounted = false;
      window.removeEventListener("businessAlertsUpdated", handleAlertUpdate);
      window.removeEventListener("focus", loadUnreadAlerts);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <nav className="businessMobileNav bottom-nav" aria-label="Business mobile navigation">
      {nav.map((item) => {
        const active = path === item.href || (item.href === "/business/tasks" && path.startsWith("/business/tasks/") && path !== "/business/tasks/new");
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : ""}>
            <span className="businessMobileIcon">
              <Image src={item.icon} alt="" width={19} height={19} />
            </span>
            <span>{item.label}</span>
            {item.href === "/business/growth" && unreadAlerts > 0 && (
              <span className="businessAlertBadge" aria-label={`${unreadAlertLabel} unread alerts`}>{unreadAlertLabel}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
