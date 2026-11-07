"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";

const nav = [
  { href: "/creator",     label: "Home",     icon: "/icon-home.svg" },
  { href: "/tasks",       label: "Missions", icon: "/icon-task.svg" },
  { href: "/notifications", label: "Notifications", icon: "/icon-notifications.svg" },
  { href: "/messages",    label: "Chat",     icon: "/icon-chat.svg" },
  { href: "/profile",     label: "Profile",  icon: "/icon-profile.svg" },
];

export default function BottomNav() {
  const path = usePathname();
  const [unreadMessages, setUnreadMessages] = useState(0);
  useEffect(() => {
    let active = true;
    const loadUnread = async () => {
      const response = await fetch("/api/contributor/messages", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json().catch(() => ({}));
      if (!active) return;
      const chats = Array.isArray(data.conversations) ? data.conversations : [];
      const requests = Array.isArray(data.requests) ? data.requests : [];
      setUnreadMessages([...chats, ...requests].reduce((total, chat) => total + Number(chat.unread_count || 0), 0));
    };
    void loadUnread();
    const timer = window.setInterval(() => void loadUnread(), 6000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return (
    <nav className="bottom-nav contributor-bottom-nav" aria-label="Growth Partner navigation">
      {nav.map((item) => {
        const active = path === item.href || (item.href === "/tasks" && path.startsWith("/tasks/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`contributor-bottom-nav__item${active ? " active" : ""}`}
            data-tour={item.href === "/tasks" ? "missions-link" : undefined}
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
            {item.href === "/messages" && unreadMessages > 0 ? <span className="contributor-bottom-nav__badge" aria-label={`${unreadMessages} unread messages`}>{unreadMessages > 99 ? "99+" : unreadMessages}</span> : null}
            <span className="contributor-bottom-nav__label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
