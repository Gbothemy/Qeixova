"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type ContributorNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  href: string | null;
  status: "read" | "unread";
  read_at: string | null;
  created_at: string;
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return `${Math.floor(hours / 24)}d ago`;
}

function tone(type: string) {
  if (type.includes("approved") || type.includes("reward")) return "var(--accent)";
  if (type.includes("rejected") || type.includes("withdrawal")) return "var(--accent-2)";
  if (type.includes("growth")) return "var(--blue)";
  return "var(--accent)";
}

export default function ContributorNotifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ContributorNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const recent = useMemo(() => items.slice(0, 5), [items]);

  const loadNotifications = async () => {
    setLoading(true);
    const res = await fetch("/api/contributor/notifications?limit=6", { cache: "no-store" }).catch(() => null);
    setLoading(false);
    if (!res?.ok) return;
    const data = await res.json().catch(() => ({}));
    setItems(data.notifications ?? []);
    setUnread(Number(data.unread ?? 0));
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const markAsRead = async (id: number) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status: "read", read_at: new Date().toISOString() } : item));
    setUnread((current) => Math.max(0, current - 1));
    await fetch("/api/contributor/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
  };

  return (
    <div className="notifWrap" ref={ref}>
      <button
        type="button"
        className="notifButton"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          if (!open) void loadNotifications();
        }}
      >
        <Image src="/icon-notifications.svg" alt="" width={21} height={21} className="theme-icon" />
        {unread > 0 && <span className="notifBadge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <section className="notifPanel" aria-label="Recent notifications">
          <header className="notifHead">
            <div>
              <strong>Notifications</strong>
              <span>{unread > 0 ? `${unread} unread update${unread === 1 ? "" : "s"}` : "You are all caught up"}</span>
            </div>
            <Link className="notifViewAll" href="/notifications" onClick={() => setOpen(false)}>View all</Link>
          </header>

          <div className="notifList">
            {loading ? (
              <div className="notifEmpty">Loading updates...</div>
            ) : recent.length === 0 ? (
              <div className="notifEmpty">No notifications yet.</div>
            ) : recent.map((item) => {
              const content = (
                <>
                  <span className="notifDot" style={{ background: tone(item.type) }} />
                  <div>
                    <div className="notifTitleRow">
                      <strong>{item.title}</strong>
                      <small>{timeAgo(item.created_at)}</small>
                    </div>
                    <p>{item.message}</p>
                    <div className="notifFooter">
                      <span className={`notifStatus ${item.status}`}>{item.status}</span>
                      {item.href && <span className="notifOpen">Open</span>}
                    </div>
                  </div>
                </>
              );

              return item.href ? (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`notifItem ${item.status}`}
                  onClick={() => {
                    setOpen(false);
                    if (item.status === "unread") void markAsRead(item.id);
                  }}
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  className={`notifItem ${item.status}`}
                  onClick={() => {
                    if (item.status === "unread") void markAsRead(item.id);
                  }}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <style jsx>{`
        .notifWrap {
          position: relative;
          flex-shrink: 0;
        }
        .notifButton {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.06);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          position: relative;
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .notifButton :global(.theme-icon) {
          filter: none;
        }
        .notifBadge {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 19px;
          height: 19px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-2);
          color: var(--button-text, #000);
          font-size: 10px;
          font-weight: 900;
          border: 2px solid var(--card-bg);
        }
        .notifPanel {
          position: absolute;
          right: 0;
          top: calc(100% + 12px);
          width: min(390px, calc(100vw - 28px));
          background: var(--card-bg);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          box-shadow: 0 26px 80px rgba(0, 0, 0, 0.45);
          z-index: 50;
          overflow: hidden;
          backdrop-filter: blur(18px);
        }
        .notifHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 16px 13px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .notifHead strong {
          display: block;
          color: #f7f7f7;
          font-size: 15px;
        }
        .notifHead span {
          display: block;
          color: #a5aaa5;
          font-size: 12px;
          margin-top: 3px;
        }
        .notifHead .notifViewAll {
          color: #050505;
          background: #1AEF22;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
          border-radius: 999px;
          padding: 7px 11px;
          line-height: 1;
          box-shadow: 0 8px 20px rgba(26, 239, 34, 0.16);
        }
        .notifList {
          max-height: 405px;
          overflow-y: auto;
          padding: 8px;
        }
        .notifItem {
          width: 100%;
          border: 1px solid transparent;
          background: transparent;
          text-align: left;
          display: grid;
          grid-template-columns: 10px minmax(0, 1fr);
          gap: 12px;
          border-radius: 15px;
          padding: 13px 12px;
          color: #f5f5f5;
          text-decoration: none;
          cursor: pointer;
          appearance: none;
          font: inherit;
          transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
        }
        .notifItem:hover {
          background: rgba(255,255,255,0.045);
          border-color: rgba(255,255,255,0.08);
          transform: translateY(-1px);
        }
        .notifItem.unread {
          background: linear-gradient(135deg, rgba(26,239,34,0.1), rgba(26,239,34,0.035));
          border-color: rgba(26,239,34,0.22);
        }
        .notifDot {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          margin-top: 5px;
        }
        .notifTitleRow {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
        }
        .notifTitleRow strong {
          color: #f5f5f5;
          font-size: 13px;
          line-height: 1.25;
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .notifTitleRow small {
          color: #8b928c;
          font-size: 10px;
          white-space: nowrap;
          padding-top: 1px;
        }
        .notifItem p {
          color: #c7ccc8;
          font-size: 12px;
          line-height: 1.45;
          margin: 4px 0 8px;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .notifFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .notifStatus {
          display: inline-flex;
          width: fit-content;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .notifStatus.unread {
          background: rgba(26,239,34,0.14);
          color: #1AEF22;
        }
        .notifStatus.read {
          background: rgba(255,255,255,0.08);
          color: #a5aaa5;
        }
        .notifOpen {
          color: #f5a623;
          font-size: 11px;
          font-weight: 800;
        }
        .notifEmpty {
          color: #a5aaa5;
          padding: 28px 12px;
          text-align: center;
          font-size: 13px;
        }
        :global(a.notifItem),
        :global(a.notifItem:visited),
        :global(a.notifItem:hover),
        :global(a.notifItem:focus) {
          color: #f5f5f5 !important;
          text-decoration: none !important;
        }
        :global(a.notifItem p),
        :global(a.notifItem strong),
        :global(a.notifItem small),
        :global(a.notifItem span) {
          text-decoration: none !important;
        }
        :global(.notifViewAll),
        :global(.notifViewAll:visited),
        :global(.notifViewAll:hover),
        :global(.notifViewAll:focus) {
          color: #050505 !important;
          text-decoration: none !important;
        }
        @media (max-width: 520px) {
          .notifPanel {
            position: fixed;
            right: 14px;
            left: 14px;
            top: 86px;
            width: auto;
          }
        }
      `}</style>
    </div>
  );
}
