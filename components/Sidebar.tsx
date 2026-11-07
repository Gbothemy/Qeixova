"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const nav = [
  { href: "/creator", label: "Home", icon: "/icon-home.svg" },
  { href: "/tasks", label: "Missions", icon: "/icon-task.svg" },
  { href: "/notifications", label: "Notifications", icon: "/icon-notifications.svg" },
  { href: "/messages", label: "Messages", icon: "/icon-chat.svg" },
  { href: "/growth", label: "Growth", icon: "/icon-analytics.svg" },
  { href: "/leaderboard", label: "Ranks", icon: "/icon-leaderboard.svg" },
  { href: "/wallet", label: "Wallet", icon: "/icon-wallet.svg" },
  { href: "/profile", label: "Profile", icon: "/icon-profile.svg" },
  { href: "/settings", label: "Settings", icon: "/icon-settings.svg" },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState({ fullName: "", balance: 0, xp: 0, levelName: "Starter" });

  useEffect(() => {
    fetch("/api/auth/me").then(response => response.ok ? response.json() : null).then(data => {
      if (data?.user) setUser(current => ({ ...current, fullName: data.user.full_name, xp: data.user.xp ?? 0, levelName: data.user.levelName ?? "Starter" }));
    }).catch(() => {});
    fetch("/api/wallet").then(response => response.ok ? response.json() : null).then(data => {
      if (data) setUser(current => ({ ...current, balance: data.balance ?? 0 }));
    }).catch(() => {});
  }, []);

  const initials = user.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "Q";

  return (
    <aside className="sidebar xStyleSidebar" aria-label="Primary navigation">
      <Link href="/creator" className="xStyleBrand" aria-label="Qeixova home">
        <Image src="/qeixova-icon.png" alt="" width={36} height={36} />
        <span>Qeixova</span>
      </Link>

      <nav className="xStyleNav">
        {nav.map(item => {
          const active = path === item.href || (item.href === "/tasks" && path.startsWith("/tasks/"));
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} data-tour={item.href === "/tasks" ? "missions-link" : undefined} className={`xStyleNavLink${active ? " active" : ""}`}>
            <Image src={item.icon} alt="" width={23} height={23} className={active ? "theme-icon active" : "theme-icon"} />
            <span>{item.label}</span>
          </Link>;
        })}
      </nav>

      <Link href="/creator" className="xStylePostButton">Create post</Link>

      <div className="xStyleProfileFooter">
        <Link href="/profile" className="xStyleProfileIdentity" aria-label="Open your profile">
          <span className="xStyleAvatar">{initials}</span>
          <span className="xStyleProfileText"><strong>{user.fullName || "Qeixova contributor"}</strong><small>{user.fullName ? `@${user.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24)}` : "Your account"}</small></span>
        </Link>
        <div className="xStyleFooterActions"><span className="xStyleBalance" title="Available wallet balance">{user.balance.toLocaleString()} QLT</span><ThemeToggle compact /><button type="button" className="xStyleLogout" aria-label="Log out" title="Log out" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}>···</button></div>
      </div>
      <style jsx>{`
        .xStyleSidebar{display:flex;flex-direction:column;gap:8px;width:280px;padding:8px 20px 12px;background:var(--bg);border-right:1px solid var(--border);box-shadow:none}.xStyleBrand{display:flex;align-items:center;gap:13px;min-height:54px;padding:0 10px;color:var(--text);font-size:19px;font-weight:800;letter-spacing:-.035em;text-decoration:none}.xStyleBrand img{width:34px;height:34px;object-fit:contain}.xStyleNav{display:flex;flex:1;flex-direction:column;gap:3px;padding:0 0 6px}.xStyleNavLink{display:flex;align-items:center;gap:16px;min-height:48px;padding:0 12px;border-radius:12px;color:var(--text);font-size:16px;font-weight:500;text-decoration:none;transition:background .14s ease,color .14s ease}.xStyleNavLink img{flex:0 0 24px;object-fit:contain}.xStyleNavLink:hover{background:color-mix(in srgb,var(--accent) 8%,var(--bg))}.xStyleNavLink.active{background:rgba(26,239,34,.11);color:#159532;font-weight:750}.xStylePostButton{display:flex;align-items:center;justify-content:center;min-height:54px;margin:2px 0 12px;border-radius:999px;background:#13171b;color:white;font-size:15px;font-weight:800;text-decoration:none;transition:filter .15s ease}.xStylePostButton:hover{filter:brightness(1.15)}.xStyleProfileFooter{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 6px;margin-top:auto;padding:12px 4px 2px;border-top:1px solid var(--border)}.xStyleProfileIdentity{display:flex;align-items:center;gap:10px;min-width:0;color:var(--text);text-decoration:none}.xStyleAvatar{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border-radius:50%;background:#dff1e5;color:#267b48;font-size:12px;font-weight:800}.xStyleProfileText{display:grid;min-width:0;gap:3px}.xStyleProfileText strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.xStyleProfileText small{overflow:hidden;color:var(--muted);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.xStyleFooterActions{display:flex;align-items:center;gap:4px}.xStyleBalance{color:var(--muted);font-size:9px;white-space:nowrap}.xStyleLogout{width:30px;height:30px;border:0;border-radius:50%;background:transparent;color:var(--text);font-size:20px;line-height:1;cursor:pointer}.xStyleLogout:hover{background:var(--card-bg)}
        @media(min-width:1024px){.xStyleSidebar{position:sticky;top:0;height:100vh;min-height:100vh;overflow-y:auto}.xStyleNavLink{min-height:52px;font-size:17px}.xStylePostButton{min-height:56px;font-size:16px}}
      `}</style>
    </aside>
  );
}
