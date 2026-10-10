"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const links = [
  { href: "/dashboard", label: "Home", icon: "/icon-home.svg" },
  { href: "/tasks", label: "Missions", icon: "/icon-task.svg" },
  { href: "/growth", label: "Growth", icon: "/icon-analytics.svg" },
  { href: "/leaderboard", label: "Ranks", icon: "/icon-leaderboard.svg" },
  { href: "/wallet", label: "Wallet", icon: "/icon-wallet.svg" },
  { href: "/profile", label: "Profile", icon: "/icon-profile.svg" },
  { href: "/notifications", label: "Notifications", icon: "/icon-notifications.svg" },
  { href: "/tasks/submit", label: "My Missions", icon: "/icon-task.svg" },
];

export default function MobileNavMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className={`mobile-nav-menu${open ? " mobile-nav-menu--open" : ""}`}>
      <div className="mobile-nav-menu__bar">
        <Link href="/dashboard" className="mobile-nav-menu__brand" onClick={() => setOpen(false)}>
          <Image src="/qeixova-icon.png" alt="" width={30} height={30} />
          <span>Qeixova</span>
        </Link>
        <button type="button" className="mobile-nav-menu__toggle" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="mobile-nav-menu-links" onClick={() => setOpen((value) => !value)}>
          <span className="mobile-nav-menu__toggle-icon" aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
      </div>
      {open && (
        <>
          <button type="button" className="mobile-nav-menu__backdrop" aria-label="Close navigation menu" onClick={() => setOpen(false)} />
          <nav id="mobile-nav-menu-links" className="mobile-nav-menu__panel" aria-label="More navigation">
            {links.map((link) => {
              const active = pathname === link.href || (link.href === "/tasks" && pathname.startsWith("/tasks/"));
              return <Link key={link.href} href={link.href} data-tour={link.href === "/tasks" ? "missions-link" : link.href === "/tasks/submit" ? "my-missions-link" : undefined} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={`mobile-nav-menu__link${active ? " active" : ""}`}>
                <Image src={link.icon} alt="" width={20} height={20} className={active ? "theme-icon active" : "theme-icon"} />
                <span>{link.label}</span>
              </Link>;
            })}
            <div className="mobile-nav-menu__theme"><ThemeToggle /></div>
          </nav>
        </>
      )}
    </header>
  );
}
