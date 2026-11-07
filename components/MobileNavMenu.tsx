"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const links = [
  { href: "/profile", label: "Profile", icon: "/icon-profile.svg" },
  { href: "/messages", label: "Messages", icon: "/icon-chat.svg" },
  { href: "/notifications", label: "Notifications", icon: "/icon-notifications.svg" },
  { href: "/tasks", label: "Missions", icon: "/icon-task.svg" },
  { href: "/growth", label: "Growth", icon: "/icon-analytics.svg" },
  { href: "/leaderboard", label: "Ranks", icon: "/icon-leaderboard.svg" },
  { href: "/wallet", label: "Wallet", icon: "/icon-wallet.svg" },
  { href: "/settings", label: "Settings", icon: "/icon-settings.svg" },
  { href: "/creator", label: "Home", icon: "/icon-home.svg" },
  { href: "/tasks/submit", label: "My Missions", icon: "/icon-task.svg" },
];

export default function MobileNavMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState({ name: "", following: 0, followers: 0 });

  useEffect(() => {
    let active = true;
    fetch("/api/profile")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active || !data?.profile) return;
        setProfile({
          name: data.profile.full_name || "",
          following: Number(data.profile.creator_following_count || 0),
          followers: Number(data.profile.creator_follower_count || 0),
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    const openFromFeed = () => setOpen(true);
    window.addEventListener("open-mobile-navigation", openFromFeed);
    return () => window.removeEventListener("open-mobile-navigation", openFromFeed);
  }, []);

  return (
    <header className={`mobile-nav-menu${open ? " mobile-nav-menu--open" : ""}`}>
      <div className="mobile-nav-menu__bar">
        <Link href="/creator" className="mobile-nav-menu__brand" onClick={() => setOpen(false)}>
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
            <section className="mobile-nav-menu__profile">
              <div className="mobile-nav-menu__profile-top">
                <Link href="/profile" className="mobile-nav-menu__avatar" onClick={() => setOpen(false)} aria-label="Open your profile">{profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "Q"}</Link>
                <Link href="/creator" className="mobile-nav-menu__quick-action" onClick={() => setOpen(false)} aria-label="Create a post">+</Link>
              </div>
              <Link href="/profile" className="mobile-nav-menu__identity" onClick={() => setOpen(false)}>
                <strong>{profile.name || "Qeixova contributor"}</strong>
                <span>@{profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "contributor"}</span>
              </Link>
              <div className="mobile-nav-menu__counts"><span><b>{profile.following.toLocaleString()}</b> Following</span><span><b>{profile.followers.toLocaleString()}</b> Followers</span></div>
            </section>
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
