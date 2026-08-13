"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BusinessBottomNav from "@/components/BusinessBottomNav";
import BusinessSidebar from "@/components/BusinessSidebar";

type NotificationTone = "green" | "gold" | "blue" | "purple";

type NotificationStat = {
  label: string;
  value: number;
  tone: NotificationTone;
};

type BusinessNotification = {
  id: string;
  type: "approved" | "participation" | "verification" | "growth" | "wallet" | "campaign" | "system";
  title: string;
  body: string;
  status: string;
  tone: NotificationTone;
  href?: string | null;
  metadata?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at: string;
};

const filters = [
  "All",
  "Unread",
];

const filterType: Record<string, BusinessNotification["type"] | "all" | "unread"> = {
  All: "all",
  Unread: "unread",
};

export default function BusinessGrowthPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("Business");
  const [notificationStats, setNotificationStats] = useState<NotificationStat[]>([]);
  const [notifications, setNotifications] = useState<BusinessNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState(filters[0]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadOwnerNotifications(background = false) {
      try {
        if (background) setRefreshing(true);
        const [meRes, notificationsRes] = await Promise.all([
          fetch("/api/business/me"),
          fetch("/api/business/notifications"),
        ]);

        if (!meRes.ok || !notificationsRes.ok) {
          router.push("/business/login");
          return;
        }

        const [meData, notificationsData] = await Promise.all([
          meRes.json(),
          notificationsRes.json(),
        ]);

        if (!mounted) return;
        if (meData?.business?.name) setBusinessName(meData.business.name);
        setNotificationStats(notificationsData.stats ?? []);
        const nextNotifications = notificationsData.notifications ?? [];
        const nextUnread = Number(notificationsData.unread ?? 0);
        setNotifications(nextNotifications);
        setUnreadCount(nextUnread);
        window.dispatchEvent(new CustomEvent("businessAlertsUpdated", { detail: { unread: nextUnread } }));
        setLastSyncedAt(new Date());
      } catch {
        router.push("/business/login");
      } finally {
        if (mounted) setLoading(false);
        if (mounted) setRefreshing(false);
      }
    }

    loadOwnerNotifications();
    const refreshTimer = window.setInterval(() => loadOwnerNotifications(true), 30000);
    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
    };
  }, [router]);

  const visibleNotifications = useMemo(() => {
    const type = filterType[activeFilter] ?? "all";
    if (type === "all") return notifications;
    if (type === "unread") return notifications.filter((item) => !item.read_at);
    return notifications.filter((item) => item.type === type);
  }, [activeFilter, notifications]);

  const liveUnreadCount = notifications.length > 0 ? notifications.filter((item) => !item.read_at).length : unreadCount;

  async function markAllAsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString(), status: "Read" })));
    setUnreadCount(0);
    setNotificationStats((current) => current.map((item) => item.label === "Unread" ? { ...item, value: 0 } : item));
    window.dispatchEvent(new CustomEvent("businessAlertsUpdated", { detail: { unread: 0 } }));
    await fetch("/api/business/notifications", { method: "PATCH" }).catch(() => {});
  }

  async function openNotification(item: BusinessNotification) {
    if (item.read_at) return;

    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((notification) => (
      notification.id === item.id
        ? { ...notification, read_at: readAt, status: "Read" }
        : notification
    )));
    setUnreadCount((current) => Math.max(0, current - 1));
    setNotificationStats((current) => current.map((stat) => (
      stat.label === "Unread" ? { ...stat, value: Math.max(0, stat.value - 1) } : stat
    )));
    const optimisticUnread = Math.max(0, notifications.filter((notification) => !notification.read_at).length - 1);
    window.dispatchEvent(new CustomEvent("businessAlertsUpdated", { detail: { unread: optimisticUnread } }));

    const res = await fetch("/api/business/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: item.id }),
    }).catch(() => null);

    if (!res?.ok) {
      setNotifications((current) => current.map((notification) => (
        notification.id === item.id
          ? { ...notification, read_at: null, status: item.status || "Unread" }
          : notification
      )));
      setUnreadCount((current) => current + 1);
      setNotificationStats((current) => current.map((stat) => (
        stat.label === "Unread" ? { ...stat, value: stat.value + 1 } : stat
      )));
      window.dispatchEvent(new CustomEvent("businessAlertsUpdated", { detail: { unread: optimisticUnread + 1 } }));
    } else {
      const data = await res.json().catch(() => ({}));
      if (typeof data.unread === "number") {
        window.dispatchEvent(new CustomEvent("businessAlertsUpdated", { detail: { unread: data.unread } }));
      }
    }
  }

  function formatSyncTime(value: Date | null) {
    if (!value) return "Syncing now";
    return value.toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatNotificationDate(value: string) {
    if (!value) return "Recent";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recent";
    return date.toLocaleString("en-NG", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <>
      <div className="notificationLayout">
        <BusinessSidebar name={businessName} />
        <main className="page-body business-page-pro notificationPage">
          <div className="businessWorkspace notificationWorkspace">
            <section className="adsPanel notificationHero">
              <div>
                <p className="notificationEyebrow">{businessName} alerts</p>
                <h1 className="businessPageTitle">Notifications</h1>
                <p>Important campaign updates will appear here, just like a clean inbox for approvals, reviews, unread notices, and contributor actions.</p>
              </div>
              <div className="heroStatus">
                <span>Unread</span>
                <strong>{liveUnreadCount}</strong>
                <small><i /> {refreshing ? "Refreshing" : `Synced ${formatSyncTime(lastSyncedAt)}`}</small>
              </div>
            </section>

            {notificationStats.length > 0 && (
              <section className="notificationStats">
                {notificationStats.map((item) => (
                  <article key={item.label} className={`adsPanel statCard ${item.tone}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </section>
            )}

            <section className="notificationGrid">
              <aside className="filterPanel">
                <div className="filterList">
                  {filters.map((filter) => (
                    <button key={filter} className={filter === activeFilter ? "active" : ""} type="button" onClick={() => setActiveFilter(filter)}>{filter}</button>
                  ))}
                </div>
              </aside>

              <section className="adsPanel notificationListPanel">
                <div className="sectionHead">
                  <div>
                    <p className="notificationEyebrow">Alerts inbox</p>
                    <h2>{activeFilter === "Unread" ? "Unread alerts" : "Notifications"}</h2>
                  </div>
                  <button type="button" onClick={markAllAsRead} disabled={notifications.length === 0}>Mark all as read</button>
                </div>

                <div className="notificationList">
                  {loading ? (
                    <div className="emptyNotifications notificationLoadingState">
                      <span className="businessMiniSpinner" aria-hidden="true" />
                      <div>
                        <strong>Loading your campaign notifications</strong>
                        <p>Checking campaigns, approved participation, verification updates, and growth signals owned by this business account.</p>
                      </div>
                    </div>
                  ) : visibleNotifications.length === 0 ? (
                    <div className="emptyNotifications facebookEmpty">
                      <span className="emptyBell">
                        <Image src="/icon-notifications.svg" alt="" width={38} height={38} />
                      </span>
                      <strong>{activeFilter === "Unread" ? "No unread alerts" : "No notifications yet"}</strong>
                      <p>{activeFilter === "Unread" ? "New campaign approvals, proof submissions, and important unread notices will show here." : "When something important happens with your campaigns, alerts will show here in order from newest to oldest."}</p>
                    </div>
                  ) : (
                    visibleNotifications.map((item) => (
                      <article
                        key={item.id}
                        className={`notificationItem ${item.tone} ${item.read_at ? "read" : "unread"}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openNotification(item)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openNotification(item);
                          }
                        }}
                      >
                        <div className="notificationIcon">
                          <Image src="/icon-notifications.svg" alt="" width={22} height={22} />
                        </div>
                        <div>
                          <div className="notificationTitle">
                            <strong>{item.title}</strong>
                            <span>{formatNotificationDate(item.created_at)}</span>
                          </div>
                          <p>{item.body}</p>
                          <small>{item.read_at ? "Read" : item.status || "Unread"}</small>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>

            </section>
          </div>
        </main>
      </div>
      <BusinessBottomNav />
      <style>{styles}</style>
    </>
  );
}

const styles = `
  .notificationLayout {
    min-height: 100vh;
    background: #000;
  }

  .notificationPage {
    min-width: 0;
  }

  .notificationWorkspace {
    width: min(100%, 1440px);
    margin: 0 auto;
  }

  .notificationHero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 16px;
    align-items: center;
    padding: 22px;
    margin-bottom: 16px;
  }

  .notificationEyebrow {
    margin: 0 0 7px;
    color: #F5A623;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .9px;
    text-transform: uppercase;
  }

  .notificationHero h1 {
    margin: 0;
    font-size: clamp(34px, 4.4vw, 54px);
    line-height: 1.02;
  }

  .notificationHero p:not(.notificationEyebrow) {
    max-width: 760px;
    margin: 10px 0 0;
    color: #aaa;
    font-size: 14px;
    line-height: 1.65;
  }

  .heroStatus {
    padding: 16px;
    border: 1px solid rgba(245, 166, 35, .25);
    border-radius: 15px;
    background: rgba(245, 166, 35, .08);
    text-align: right;
  }

  .heroStatus span,
  .heroStatus strong {
    display: block;
  }

  .heroStatus span,
  .statCard span {
    color: #aaa;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .heroStatus strong {
    margin-top: 6px;
    color: #fff;
    font-size: 32px;
  }

  .heroStatus small {
    display: inline-flex;
    justify-content: flex-end;
    align-items: center;
    gap: 7px;
    margin-top: 10px;
    color: #bbb;
    font-size: 12px;
    font-weight: 800;
  }

  .heroStatus i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #1AEF22;
    box-shadow: 0 0 0 5px rgba(26, 239, 34, .12);
    animation: livePulse 1.4s ease-in-out infinite;
  }

  @keyframes livePulse {
    0%, 100% { opacity: .55; transform: scale(.9); }
    50% { opacity: 1; transform: scale(1.08); }
  }

  .notificationStats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .statCard {
    padding: 17px;
    border-top: 3px solid #F5A623;
  }

  .statCard.green { border-top-color: #1AEF22; }
  .statCard.blue { border-top-color: #4a9eff; }
  .statCard.purple { border-top-color: #a855f7; }

  .statCard strong {
    display: block;
    margin-top: 10px;
    color: #F5F5F5;
    font-size: 30px;
    line-height: 1;
  }

  .notificationGrid {
    display: grid;
    grid-template-columns: 180px minmax(0, 760px);
    justify-content: center;
    gap: 18px;
    align-items: start;
  }

  .notificationListPanel {
    padding: 12px;
  }

  .filterPanel {
    position: sticky;
    top: 18px;
  }

  .filterList {
    display: grid;
    gap: 6px;
  }

  .filterList button,
  .sectionHead button {
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #bbb;
    cursor: pointer;
    font-weight: 800;
  }

  .filterList button {
    min-height: 40px;
    padding: 10px 14px;
    text-align: left;
  }

  .filterList button.active {
    background: rgba(245, 166, 35, .14);
    color: #F5A623;
  }

  .sectionHead {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 15px;
  }

  .sectionHead h2 {
    margin: 0;
    color: #F5F5F5;
    font-size: 22px;
  }

  .sectionHead button {
    padding: 10px 12px;
    color: #F5A623;
  }

  .sectionHead button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .notificationList {
    display: grid;
    gap: 4px;
  }

  .notificationItem {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 12px;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    outline: none;
  }

  .notificationItem.read {
    opacity: .72;
  }

  .notificationItem.unread {
    border-color: rgba(245, 166, 35, .2);
    background: rgba(245, 166, 35, .045);
  }

  .notificationItem:focus-visible {
    border-color: rgba(245, 166, 35, .42);
    background: #101010;
    box-shadow: 0 12px 30px rgba(0, 0, 0, .2);
  }

  .notificationIcon {
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgba(245, 166, 35, .14);
  }

  .notificationIcon img {
    filter: invert(76%) sepia(63%) saturate(894%) hue-rotate(342deg) brightness(101%) contrast(92%);
  }

  .notificationItem:hover {
    background: #101010;
  }

  .notificationItem.green .notificationIcon {
    background: rgba(26, 239, 34, .1);
  }

  .notificationItem.blue .notificationIcon {
    background: rgba(74, 158, 255, .12);
  }

  .notificationItem.purple .notificationIcon {
    background: rgba(168, 85, 247, .12);
  }

  .notificationTitle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .notificationTitle strong {
    color: #F5F5F5;
    font-size: 14px;
  }

  .notificationTitle span {
    color: #777;
    font-size: 12px;
    white-space: nowrap;
  }

  .notificationItem p {
    margin: 6px 0 10px;
    color: #aaa;
    font-size: 13px;
    line-height: 1.55;
  }

  .notificationItem small {
    display: inline-flex;
    width: fit-content;
    padding: 4px 9px;
    border-radius: 999px;
    background: #111;
    color: #bbb;
    font-size: 11px;
    font-weight: 850;
  }

  .notificationItem.unread small {
    background: rgba(245, 166, 35, .14);
    color: #F5A623;
  }

  .emptyNotifications {
    padding: 42px 20px;
    border-radius: 12px;
    background: transparent;
    text-align: center;
  }

  .notificationLoadingState {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .emptyNotifications strong {
    display: block;
    color: #F5F5F5;
    font-size: 18px;
  }

  .emptyNotifications p {
    max-width: 360px;
    margin: 8px auto 0;
    color: #999;
    font-size: 13px;
    line-height: 1.6;
  }

  .facebookEmpty {
    min-height: 310px;
    display: grid;
    align-content: center;
    justify-items: center;
  }

  .emptyBell {
    width: 76px;
    height: 76px;
    display: grid;
    place-items: center;
    margin-bottom: 14px;
    border-radius: 50%;
    background: #151515;
    box-shadow: inset 0 0 0 1px #222;
  }

  .emptyBell img {
    filter: invert(76%) sepia(63%) saturate(894%) hue-rotate(342deg) brightness(101%) contrast(92%);
  }

  @media (min-width: 1024px) {
    .notificationLayout {
      display: flex;
      align-items: flex-start;
    }

    .notificationPage {
      flex: 1;
      width: calc(100% - 260px);
    }
  }

  @media (max-width: 980px) {
    .notificationHero,
    .notificationGrid {
      grid-template-columns: 1fr;
    }

    .filterPanel {
      position: static;
    }

    .notificationStats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .heroStatus {
      text-align: left;
    }
  }

  @media (max-width: 620px) {
    .notificationHero,
    .notificationListPanel {
      padding: 16px;
    }

    .filterList {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .filterList button {
      white-space: nowrap;
    }

    .notificationStats {
      grid-template-columns: 1fr;
    }

    .sectionHead,
    .notificationTitle {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;
