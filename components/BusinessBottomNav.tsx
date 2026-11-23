"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/business/dashboard", label: "Overview", icon: "/icon-home.svg" },
  { href: "/business/tasks", label: "Campaigns", icon: "/icon-task.svg" },
  { href: "/business/tasks/new", label: "Create", icon: "/icon-content.svg" },
  { href: "/business/creator", label: "Creator", icon: "/icon-chat.svg" },
  { href: "/business/wallet", label: "Billing", icon: "/icon-wallet.svg" },
];

export default function BusinessBottomNav() {
  const path = usePathname();

  return (
    <nav className="businessMobileNav bottom-nav" aria-label="Business navigation">
      {nav.map((item) => {
        const active = path === item.href || (item.href === "/business/tasks" && path.startsWith("/business/tasks/") && path !== "/business/tasks/new");
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <span className="businessMobileIcon">
              <Image src={item.icon} alt="" width={19} height={19} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
