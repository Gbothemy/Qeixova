"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const nav = [
  { href: "/dashboard",   label: "Home",     icon: "/icon-home.svg" },
  { href: "/tasks",       label: "Missions", icon: "/icon-task.svg" },
  { href: "/growth",      label: "Growth",   icon: "/icon-analytics.svg" },
  { href: "/leaderboard", label: "Ranks",    icon: "/icon-leaderboard.svg" },
  { href: "/wallet",      label: "Wallet",   icon: "/icon-wallet.svg" },
  { href: "/profile",     label: "Profile",  icon: "/icon-profile.svg" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      width: "100%",
      background: "var(--card-bg)",
      borderTop: "1px solid var(--border)",
      display: "flex",
      zIndex: 50,
      boxShadow: "0 -4px 20px rgba(0,0,0,0.35)",
    }}>
      {nav.map((item) => {
        const active = path === item.href;
        return (
          <Link key={item.href} href={item.href} style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "10px 0 12px",
            textDecoration: "none",
            color: active ? "var(--accent)" : "var(--muted)",
            fontSize: 10,
            fontWeight: active ? 700 : 500,
            gap: 3,
            letterSpacing: 0.3,
            position: "relative",
          }}>
            {active && (
              <div style={{
                position: "absolute",
                top: 0, left: "50%",
                transform: "translateX(-50%)",
                width: 32, height: 3,
                background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                borderRadius: "0 0 4px 4px",
              }} />
            )}
            <Image
              src={item.icon}
              alt={item.label}
              width={24}
              height={24}
              className={active ? "theme-icon active" : "theme-icon"}
              style={{ objectFit: "contain" }}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
