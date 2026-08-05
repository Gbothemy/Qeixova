"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  { href: "/business/dashboard", label: "Overview", icon: "/icon-home.svg", desc: "Account health" },
  { href: "/business/tasks", label: "Campaigns", icon: "/icon-task.svg", desc: "Campaign manager" },
  { href: "/business/tasks/new", label: "Create", icon: "/icon-content.svg", desc: "Guided campaign setup" },
  { href: "/business/wallet", label: "Billing", icon: "/icon-wallet.svg", desc: "Credits and spend" },
  { href: "/business/growth", label: "Alerts", icon: "/icon-notifications.svg", desc: "Notifications" },
  { href: "/business/profile", label: "Profile", icon: "/icon-profile.svg", desc: "Account settings" },
];

function isActivePath(path: string, href: string) {
  if (href === "/business/tasks") return path === href || (path.startsWith("/business/tasks/") && path !== "/business/tasks/new");
  return path === href;
}

export default function BusinessSidebar({ name }: { name: string }) {
  const path = usePathname();
  const router = useRouter();
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
    <aside className="businessAdsSidebar">
      <div className="businessAdsBrand">
        <Link href="/business/dashboard" className="businessAdsLogo">
          <Image src="/qeixova-icon.png" alt="Qeixova" width={36} height={36} />
          <div>
            <strong>Qeixova</strong>
            <span>Business Manager</span>
          </div>
        </Link>
        <Link href="/business/tasks/new" className="businessCreateButton">
          <Image src="/icon-create-mission.svg" alt="" width={15} height={15} />
          Create Campaign
        </Link>
      </div>

      <div className="businessAccountBox">
        <div className="businessAvatar">{name.slice(0, 1).toUpperCase()}</div>
        <div>
          <span>Ad account</span>
          <strong>{name}</strong>
        </div>
      </div>

      <nav className="businessAdsNav" aria-label="Business navigation">
        <p>Manage</p>
        {nav.map((item) => {
          const active = isActivePath(path, item.href);
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""}>
              <span className="navIcon">
                <Image src={item.icon} alt="" width={18} height={18} />
              </span>
              <span className="navCopy">
                <strong>{item.label}</strong>
                <small>{item.desc}</small>
              </span>
              {item.href === "/business/growth" && unreadAlerts > 0 && (
                <span className="businessAlertBadge" aria-label={`${unreadAlertLabel} unread alerts`}>{unreadAlertLabel}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="businessSidebarFoot">
        <div>
          <span>Status</span>
          <strong>Ready to launch</strong>
        </div>
        <button type="button" onClick={() => router.push("/business/profile")}>Profile</button>
      </div>
    </aside>
  );
}
