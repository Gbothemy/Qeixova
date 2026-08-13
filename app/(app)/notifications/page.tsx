"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";

type Filter = "all" | "unread" | "read";
type Notification = {
  id: number;
  type: string;
  title: string;
  message: string;
  href: string | null;
  status: "read" | "unread";
  read_at: string | null;
  created_at: string;
};

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

function notificationTone(type: string) {
  if (type.includes("rejected") || type.includes("withdrawal")) return "#F5A623";
  if (type.includes("growth")) return "#60A5FA";
  return "#1AEF22";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/contributor/notifications?filter=${filter}&limit=100`, { cache: "no-store" });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load notifications");
      setItems(data.notifications ?? []);
      setUnread(Number(data.unread ?? 0));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }, [filter, router]);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  async function markRead(item: Notification) {
    if (item.status === "read") return;
    setItems(current => current.map(entry => entry.id === item.id ? { ...entry, status: "read", read_at: new Date().toISOString() } : entry));
    setUnread(current => Math.max(0, current - 1));
    const response = await fetch("/api/contributor/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) }).catch(() => null);
    if (!response?.ok) void loadNotifications();
    else if (filter === "unread") setItems(current => current.filter(entry => entry.id !== item.id));
  }

  async function markAllRead() {
    if (unread === 0 || updating) return;
    setUpdating(true);
    const response = await fetch("/api/contributor/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAll: true }) }).catch(() => null);
    if (response?.ok) {
      setUnread(0);
      if (filter === "unread") setItems([]);
      else setItems(current => current.map(item => ({ ...item, status: "read", read_at: item.read_at || new Date().toISOString() })));
    } else setError("Unable to mark notifications as read");
    setUpdating(false);
  }

  return (
    <div className="notificationsPage page-body">
      <header className="notificationsHero">
        <Link href="/dashboard" className="notificationsBack" aria-label="Back to dashboard">←</Link>
        <div>
          <span>Activity center</span>
          <h1>Notifications</h1>
          <p>{unread > 0 ? `${unread} unread update${unread === 1 ? "" : "s"}` : "You are all caught up"}</p>
        </div>
        <div className="notificationsBell"><Image src="/icon-notifications.svg" alt="" width={24} height={24} /></div>
      </header>

      <section className="notificationsToolbar" aria-label="Notification controls">
        <div className="notificationFilters">
          {(["all", "unread", "read"] as Filter[]).map(value => (
            <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>
          ))}
        </div>
        <button className="markAllButton" type="button" onClick={markAllRead} disabled={unread === 0 || updating}>{updating ? "Updating…" : "Mark all read"}</button>
      </section>

      <main className="notificationsList" aria-live="polite">
        {error && <div className="notificationsError"><span>{error}</span><button type="button" onClick={loadNotifications}>Try again</button></div>}
        {loading ? (
          <div className="notificationsState"><span className="notificationSpinner" /><strong>Loading notifications</strong><p>Checking your latest Qeixova activity.</p></div>
        ) : items.length === 0 ? (
          <div className="notificationsState"><span className="emptyBell"><Image src="/icon-notifications.svg" alt="" width={34} height={34} /></span><strong>{filter === "unread" ? "No unread notifications" : filter === "read" ? "No read notifications yet" : "No notifications yet"}</strong><p>Mission, reward, comment, and account updates will appear here.</p></div>
        ) : items.map(item => {
          const content = <><span className="notificationDot" style={{ background: notificationTone(item.type) }} /><div className="notificationCopy"><div className="notificationTitle"><strong>{item.title}</strong><time dateTime={item.created_at}>{timeAgo(item.created_at)}</time></div><p>{item.message}</p><div className="notificationMeta"><span className={item.status}>{item.status}</span>{item.href && <b>View details →</b>}</div></div></>;
          return item.href ? <Link key={item.id} href={item.href} className={`notificationCard ${item.status}`} onClick={() => void markRead(item)}>{content}</Link> : <button key={item.id} type="button" className={`notificationCard ${item.status}`} onClick={() => void markRead(item)}>{content}</button>;
        })}
      </main>
      <BottomNav />

      <style jsx global>{`
        .notificationsPage{width:min(100%,1080px);min-height:100vh;margin:0 auto;background:#070807;color:#f5f5f5;padding-bottom:112px;border-inline:1px solid #1b1f1b;box-shadow:0 0 70px rgba(0,0,0,.3)}
        .notificationsHero{position:relative;display:grid;grid-template-columns:46px minmax(0,1fr) 54px;gap:18px;align-items:center;padding:52px 34px 30px;background:radial-gradient(circle at 90% 5%,rgba(26,239,34,.13),transparent 38%),linear-gradient(135deg,#0d100d,#090a09);border-bottom:1px solid #242824}
        .notificationsHero span{color:#1AEF22;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.notificationsHero h1{margin:4px 0 2px;font-size:26px}.notificationsHero p{color:#a5aaa5;font-size:12px}
        .notificationsBack,.notificationsBell{display:grid;place-items:center;width:46px;height:46px;border:1px solid #2b302b;border-radius:14px;background:#151815;color:#f5f5f5;text-decoration:none;font-size:20px;transition:.18s ease}.notificationsBack:hover{border-color:#4b544b;transform:translateX(-2px)}.notificationsBell{width:54px;height:54px;background:rgba(26,239,34,.09);border-color:rgba(26,239,34,.26);box-shadow:0 10px 30px rgba(26,239,34,.06)}.notificationsBell img{filter:none}
        .notificationsToolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:18px 34px;border-bottom:1px solid #222622;background:#0d100d}.notificationFilters{display:flex;gap:8px;min-width:0}.notificationFilters button,.markAllButton{min-height:40px;border:1px solid #2d322d;border-radius:11px;background:#171a17;color:#aeb5af;padding:9px 15px;font-size:11px;font-weight:800;text-transform:capitalize;cursor:pointer;transition:.18s ease}.notificationFilters button:hover,.markAllButton:hover:not(:disabled){border-color:#4b544b;color:#fff}.notificationFilters button.active{background:#1AEF22;border-color:#1AEF22;color:#051006;box-shadow:0 7px 20px rgba(26,239,34,.15)}.markAllButton{color:#F5A623;white-space:nowrap}.markAllButton:disabled{opacity:.42;cursor:not-allowed}
        .notificationsList{display:grid;gap:12px;padding:24px 34px}.notificationCard{display:grid;grid-template-columns:10px minmax(0,1fr);gap:16px;width:100%;padding:20px 22px;border:1px solid #242824;border-radius:17px;background:linear-gradient(145deg,#121512,#0e100e);color:#f5f5f5;text-align:left;text-decoration:none;font:inherit;cursor:pointer;box-shadow:0 12px 28px rgba(0,0,0,.14);transition:.18s ease}.notificationCard:hover{transform:translateY(-2px);border-color:#414941;background:#151915}.notificationCard.unread{background:linear-gradient(135deg,rgba(26,239,34,.105),#111511 45%,#0f120f);border-color:rgba(26,239,34,.28)}.notificationDot{width:10px;height:10px;border-radius:50%;margin-top:5px;box-shadow:0 0 0 4px rgba(255,255,255,.035)}.notificationCopy{min-width:0}.notificationTitle{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.notificationTitle strong{font-size:15px;line-height:1.35;overflow-wrap:anywhere}.notificationTitle time{flex-shrink:0;color:#858b86;font-size:11px}.notificationCopy>p{margin:7px 0 14px;color:#b9c0ba;font-size:13px;line-height:1.58;overflow-wrap:anywhere}.notificationMeta{display:flex;justify-content:space-between;align-items:center;gap:10px}.notificationMeta span{padding:4px 9px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}.notificationMeta .unread{background:rgba(26,239,34,.12);color:#1AEF22}.notificationMeta .read{background:#232723;color:#9da49e}.notificationMeta b{color:#F5A623;font-size:11px}
        .notificationsState{display:grid;place-items:center;padding:64px 20px;border:1px solid #202020;border-radius:16px;background:#101010;text-align:center}.notificationsState strong{margin-top:13px;font-size:16px}.notificationsState p{max-width:320px;margin-top:6px;color:#999;font-size:12px;line-height:1.55}.emptyBell{display:grid;place-items:center;width:62px;height:62px;border-radius:18px;background:rgba(26,239,34,.08);border:1px solid rgba(26,239,34,.18)}.notificationSpinner{width:28px;height:28px;border:3px solid #242424;border-top-color:#1AEF22;border-radius:50%;animation:spin .8s linear infinite}.notificationsError{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 14px;border:1px solid rgba(229,62,62,.3);border-radius:12px;background:rgba(229,62,62,.08);color:#ff9d9d;font-size:12px}.notificationsError button{border:0;border-radius:8px;background:#e53e3e;color:#fff;padding:7px 10px;font-weight:800;cursor:pointer}@keyframes spin{to{transform:rotate(360deg)}}
        @media(min-width:768px){.notificationsPage{padding-bottom:90px}.notificationCard{min-height:126px}}
        @media(max-width:640px){.notificationsPage{border:0}.notificationsHero{grid-template-columns:42px minmax(0,1fr) 46px;gap:12px;padding:36px 18px 24px}.notificationsBack{width:42px;height:42px}.notificationsBell{width:46px;height:46px}.notificationsToolbar{align-items:stretch;flex-direction:column;padding:14px 16px}.notificationFilters{display:grid;grid-template-columns:repeat(3,1fr)}.markAllButton{width:100%}.notificationsList{padding:16px}.notificationCard{padding:17px 16px;gap:12px}.notificationTitle strong{font-size:14px}.notificationCopy>p{font-size:12px}}
      `}</style>
    </div>
  );
}
