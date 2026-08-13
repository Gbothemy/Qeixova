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
    <nav className="bottom-nav contributor-bottom-nav" aria-label="Contributor navigation">
      {nav.map((item) => {
        const active = path === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`contributor-bottom-nav__item${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {active && <span className="contributor-bottom-nav__indicator" aria-hidden="true" />}
            <Image
              src={item.icon}
              alt=""
              width={24}
              height={24}
              className={`contributor-bottom-nav__icon theme-icon${active ? " active" : ""}`}
            />
            <span className="contributor-bottom-nav__label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
