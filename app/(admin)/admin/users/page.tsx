"use client";

import { useCallback, useEffect, useState } from "react";

interface User {
  account_type?: "contributor" | "business";
  id: number;
  full_name: string;
  email: string;
  balance: number;
  tasks_completed: number;
  campaign_count?: number;
  created_at: string;
  banned: boolean;
  status?: string;
  industry?: string;
  website?: string;
  interests?: string[];
  country?: string;
  state?: string;
  city?: string;
  age_range?: string;
  gender?: string;
  onboarding_completed?: boolean;
  trust_score?: number;
  level_number?: number;
  level_name?: string;
}

interface LocationGroup {
  account_type: "contributor" | "business";
  country: string;
  region: string;
  count: number;
}

interface UnverifiedUser {
  id: number;
  account_type: "contributor" | "business";
  full_name: string;
  email: string;
  created_at: string;
  verification_created_at: string | null;
  reminder_sent_at: string | null;
  verification_expires_at: string | null;
  email_verified_at: string | null;
}

const TH: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 800,
  color: "#4b5563",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  borderBottom: "1px solid var(--qeixova-color-e5-e7-eb)",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 14,
  color: "#374151",
  borderBottom: "1px solid var(--qeixova-color-ee-f0-f3)",
  verticalAlign: "middle",
};

function compactList(values: string[] | undefined, fallback = "Not set") {
  if (!values?.length) return fallback;
  if (values.length <= 3) return values.join(", ");
  return `${values.slice(0, 3).join(", ")} +${values.length - 3}`;
}

function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function LocationBreakdown({ title, groups }: { title: string; groups: LocationGroup[] }) {
  const visible = groups.slice(0, 6);
  const classified = groups.filter((group) => group.region !== "Not specified").reduce((sum, group) => sum + Number(group.count), 0);
  const unclassified = groups.filter((group) => group.region === "Not specified").reduce((sum, group) => sum + Number(group.count), 0);

  return (
    <section className="adminLocationPanel">
      <div className="adminLocationPanelHead">
        <div><strong>{title}</strong><span>Grouped by country and state/region</span></div>
        <small>{classified.toLocaleString()} classified · {unclassified.toLocaleString()} incomplete</small>
      </div>
      <div className="adminLocationGroups">
        {visible.length ? visible.map((group) => (
          <div className="adminLocationGroup" key={`${group.country}-${group.region}`}>
            <span>{group.country}</span>
            <strong>{group.region}</strong>
            <small>{Number(group.count).toLocaleString()} account{Number(group.count) === 1 ? "" : "s"}</small>
          </div>
        )) : <span className="adminLocationEmpty">No location data yet</span>}
      </div>
    </section>
  );
}

export default function UsersPage() {
  const [view, setView] = useState<"all" | "unverified" | "verified">("all");
  const [users, setUsers] = useState<User[]>([]);
  const [unverifiedUsers, setUnverifiedUsers] = useState<UnverifiedUser[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unverifiedTotal, setUnverifiedTotal] = useState(0);
  const [verifiedTotal, setVerifiedTotal] = useState(0);
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [unverifiedLoading, setUnverifiedLoading] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, page: String(page) });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load users");
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setLocationGroups(data.locationGroups ?? []);
    } catch (error) {
      setUsers([]);
      setTotal(0);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load users" });
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  const fetchUnverifiedUsers = useCallback(async () => {
    setUnverifiedLoading(true);
    try {
      const params = new URLSearchParams({ search, page: String(page), verified: String(view === "verified") });
      const res = await fetch(`/api/admin/users/unverified?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Unable to load ${view} users`);
      setUnverifiedUsers(data.users ?? []);
      if (view === "verified") setVerifiedTotal(data.total ?? 0);
      else setUnverifiedTotal(data.total ?? 0);
    } catch (error) {
      setUnverifiedUsers([]);
      if (view === "verified") setVerifiedTotal(0);
      else setUnverifiedTotal(0);
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${view} users` });
    } finally {
      setUnverifiedLoading(false);
    }
  }, [search, page, view]);

  useEffect(() => {
    if (view === "all") void Promise.resolve().then(fetchUsers);
    else void Promise.resolve().then(fetchUnverifiedUsers);
  }, [view, fetchUsers, fetchUnverifiedUsers]);

  useEffect(() => {
    if (view !== "unverified") return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [view]);

  useEffect(() => {
    if (view !== "unverified") return;
    const nextExpiry = unverifiedUsers
      .map((user) => user.verification_expires_at ? Date.parse(user.verification_expires_at) : Number.NaN)
      .filter((expiresAt) => Number.isFinite(expiresAt) && expiresAt > Date.now())
      .sort((a, b) => a - b)[0];
    if (!nextExpiry) return;
    const timer = window.setTimeout(() => void fetchUnverifiedUsers(), Math.max(0, nextExpiry - Date.now() + 250));
    return () => window.clearTimeout(timer);
  }, [view, unverifiedUsers, fetchUnverifiedUsers]);

  async function sendVerificationReminder(user: UnverifiedUser) {
    const key = `verification-${user.account_type}-${user.id}`;
    setActionLoading(key);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users/unverified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, accountType: user.account_type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Verification reminder could not be sent");
      setNotice({ type: "success", message: `Verification reminder sent to ${user.email}.` });
      await fetchUnverifiedUsers();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Verification reminder could not be sent" });
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteUnverifiedAccount(user: UnverifiedUser) {
    const label = user.full_name ? `${user.full_name} (${user.email})` : user.email;
    if (!window.confirm(`Permanently delete ${label}? This only works while the email is unverified.`)) return;
    const key = `verification-${user.account_type}-${user.id}`;
    setActionLoading(key);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users/unverified", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, accountType: user.account_type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Account could not be deleted");
      setNotice({ type: "success", message: `${user.email} was deleted.` });
      await fetchUnverifiedUsers();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Account could not be deleted" });
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleAccountStatus(user: User) {
    const isBusiness = user.account_type === "business";
    const key = `${user.account_type ?? "contributor"}-${user.id}`;
    setActionLoading(key);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          action: isBusiness
            ? user.banned ? "activate_business" : "suspend_business"
            : user.banned ? "unban" : "ban",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Account update failed");
      setNotice({
        type: "success",
        message: `${user.full_name} ${user.banned ? "reactivated" : isBusiness ? "suspended" : "banned"} successfully.`,
      });
      fetchUsers();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Account update failed" });
    } finally {
      setActionLoading(null);
    }
  }

  const displayedTotal = view === "all" ? total : view === "verified" ? verifiedTotal : unverifiedTotal;
  const totalPages = Math.ceil(displayedTotal / 20);

  return (
    <div className="adminPage">
      <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700, color: "var(--qeixova-color-1a-1a-1a)" }}>Users</h1>
      <p style={{ margin: "0 0 18px", color: "#5f6876", fontSize: 14 }}>
        {view === "all" ? `${total.toLocaleString()} total registered accounts` : view === "verified" ? `${verifiedTotal.toLocaleString()} accounts have verified their email` : `${unverifiedTotal.toLocaleString()} accounts still need email verification`}
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, borderBottom: "1px solid var(--qeixova-color-e5-e7-eb)" }}>
        {([ ["all", "All accounts"], ["unverified", `Unverified email${unverifiedTotal ? ` (${unverifiedTotal})` : ""}`], ["verified", `Verified email${verifiedTotal ? ` (${verifiedTotal})` : ""}`] ] as const).map(([tab, label]) => (
          <button key={tab} type="button" onClick={() => { setView(tab); setPage(1); setNotice(null); }} aria-pressed={view === tab} style={{ padding: "10px 13px", border: 0, borderBottom: view === tab ? "2px solid #1AEF22" : "2px solid transparent", background: "transparent", color: view === tab ? "var(--qeixova-color-1a-1a-1a)" : "#667085", fontWeight: 700, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder={view === "all" ? "Search name, email, industry, country, state, or city..." : `Search ${view} name or email...`}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{
            padding: "10px 16px",
            border: "1.5px solid var(--qeixova-color-e0-e0-e0)",
            borderRadius: 8,
            fontSize: 14,
            width: 360,
            maxWidth: "100%",
            outline: "none",
          }}
        />
      </div>

      {view === "all" ? <div className="adminLocationOverview">
        <LocationBreakdown title="Growth Partners by location" groups={locationGroups.filter((group) => group.account_type === "contributor")} />
        <LocationBreakdown title="Businesses by location" groups={locationGroups.filter((group) => group.account_type === "business")} />
      </div> : null}

      {notice && (
        <div className={`adminResult${notice.type === "error" ? " error" : ""}`}>
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)}>x</button>
        </div>
      )}

      {view !== "all" ? view === "unverified" ? (
        <div className="admin-table-wrap" style={{ background: "var(--qeixova-color-ff-ff-ff)", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
            <thead><tr style={{ background: "var(--qeixova-color-fa-fa-fa)" }}>
              <th style={TH}>ID</th><th style={TH}>Name</th><th style={TH}>Email</th><th style={TH}>Account</th><th style={TH}>Registered</th><th style={TH}>Verification link</th><th style={TH}>Action</th>
            </tr></thead>
            <tbody>
              {unverifiedLoading ? <tr><td colSpan={7} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>Loading unverified accounts...</td></tr>
                : unverifiedUsers.length === 0 ? <tr><td colSpan={7} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>All registered accounts have verified their email.</td></tr>
                : unverifiedUsers.map((user) => {
                  const key = `verification-${user.account_type}-${user.id}`;
                  return <tr key={`${user.account_type}-${user.id}`}>
                    <td style={TD}>{user.id}</td><td style={{ ...TD, fontWeight: 600 }}>{user.full_name || "Unnamed account"}</td><td style={TD}>{user.email}</td>
                    <td style={TD}>{user.account_type === "business" ? "Business" : "Growth Partner"}</td>
                    <td style={{ ...TD, color: "#5f6876" }}>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td style={{ ...TD, color: "#5f6876" }}>{user.reminder_sent_at ? `Reminder sent ${new Date(user.reminder_sent_at).toLocaleString()}` : user.verification_created_at ? `Link created ${new Date(user.verification_created_at).toLocaleString()}` : "No active link"}</td>
                    <td style={TD}>
                      {user.verification_expires_at && Date.parse(user.verification_expires_at) > clockNow ? (
                        <span style={{ color: "#5f6876", fontSize: 12 }} aria-live="off">
                          {user.reminder_sent_at ? "Reminder sent · next action in " : "Link expires in "}
                          {formatCountdown(Date.parse(user.verification_expires_at) - clockNow)}
                        </span>
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => void sendVerificationReminder(user)} disabled={actionLoading === key} style={{ padding: "7px 12px", borderRadius: 7, border: 0, background: "#1AEF22", color: "#142015", fontWeight: 700, cursor: "pointer", opacity: actionLoading === key ? 0.6 : 1 }}>{actionLoading === key ? "Sending..." : "Send reminder"}</button>
                          <button type="button" onClick={() => void deleteUnverifiedAccount(user)} disabled={actionLoading === key} style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #9ca3af", background: "#fff", color: "#111827", fontWeight: 700, cursor: "pointer", opacity: actionLoading === key ? 0.6 : 1 }}>Delete email account</button>
                        </div>
                      )}
                    </td>
                  </tr>;
                })}
            </tbody>
          </table>
        </div>
      ) : <div className="admin-table-wrap" style={{ background: "var(--qeixova-color-ff-ff-ff)", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead><tr style={{ background: "var(--qeixova-color-fa-fa-fa)" }}>
            <th style={TH}>ID</th><th style={TH}>Name</th><th style={TH}>Email</th><th style={TH}>Account</th><th style={TH}>Registered</th><th style={TH}>Email verified</th>
          </tr></thead>
          <tbody>
            {unverifiedLoading ? <tr><td colSpan={6} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>Loading verified accounts...</td></tr>
              : unverifiedUsers.length === 0 ? <tr><td colSpan={6} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>No verified accounts found.</td></tr>
              : unverifiedUsers.map((user) => <tr key={`${user.account_type}-${user.id}`}>
                <td style={TD}>{user.id}</td><td style={{ ...TD, fontWeight: 600 }}>{user.full_name || "Unnamed account"}</td><td style={TD}>{user.email}</td>
                <td style={TD}>{user.account_type === "business" ? "Business" : "Growth Partner"}</td>
                <td style={{ ...TD, color: "#5f6876" }}>{new Date(user.created_at).toLocaleDateString()}</td>
                <td style={{ ...TD, color: "#5f6876" }}>{user.email_verified_at ? new Date(user.email_verified_at).toLocaleString() : "Verified"}</td>
              </tr>)}
          </tbody>
        </table>
      </div> : <div className="admin-table-wrap" style={{ background: "var(--qeixova-color-ff-ff-ff)", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1040 }}>
          <thead>
            <tr style={{ background: "var(--qeixova-color-fa-fa-fa)" }}>
              <th style={TH}>ID</th>
              <th style={TH}>Account</th>
              <th style={TH}>Email</th>
              <th style={TH}>Balance (QLT)</th>
              <th style={TH}>Activity</th>
              <th style={TH}>Location</th>
              <th style={TH}>Profile</th>
              <th style={TH}>Quality</th>
              <th style={TH}>Joined</th>
              <th style={TH}>Status</th>
              <th style={TH}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>
                  No accounts found
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isBusiness = u.account_type === "business";
                const rowKey = `${u.account_type ?? "contributor"}-${u.id}`;

                return (
                  <tr key={rowKey} style={{ background: u.banned ? "var(--qeixova-color-ff-f8-f8)" : "transparent" }}>
                    <td style={TD}>{u.id}</td>
                    <td style={{ ...TD, fontWeight: 500 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <span style={{ color: "var(--qeixova-color-22-22-22)" }}>{u.full_name}</span>
                        <span
                          style={{
                            width: "fit-content",
                            padding: "3px 9px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: 0.4,
                            textTransform: "uppercase",
                            background: isBusiness ? "#fff4dc" : "#e8f5e9",
                            color: isBusiness ? "#b56d00" : "#2e7d32",
                          }}
                        >
                          {isBusiness ? "Business" : "Growth Partner"}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...TD, color: "#374151" }}>{u.email}</td>
                    <td style={TD}>{Number(u.balance).toLocaleString()}</td>
                    <td style={{ ...TD, textAlign: "center" }}>
                      {isBusiness ? `${u.campaign_count ?? 0} campaigns` : `${u.tasks_completed} tasks`}
                    </td>
                    <td style={{ ...TD, minWidth: 170 }}>
                      <div style={{ display: "grid", gap: 4, fontSize: 12, lineHeight: 1.35 }}>
                        <strong style={{ color: "var(--qeixova-color-22-22-22)" }}>{u.country || "Not specified"}</strong>
                        <span>{[u.city, u.state].filter(Boolean).join(", ") || "State/region not specified"}</span>
                        <small style={{ color: u.state ? "#2e7d32" : "#b56d00", fontWeight: 700 }}>{u.state ? "Classified" : "Incomplete location"}</small>
                      </div>
                    </td>
                    <td style={{ ...TD, minWidth: 220 }}>
                      {isBusiness ? (
                        <div style={{ display: "grid", gap: 4, fontSize: 12, lineHeight: 1.35 }}>
                          <span><strong style={{ color: "var(--qeixova-color-55-55-55)" }}>Industry:</strong> {u.industry || "Not set"}</span>
                          <span><strong style={{ color: "var(--qeixova-color-55-55-55)" }}>Website:</strong> {u.website || "Not set"}</span>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 4, fontSize: 12, lineHeight: 1.35 }}>
                          <span><strong style={{ color: "var(--qeixova-color-55-55-55)" }}>State:</strong> {u.state || "Not set"}</span>
                          <span><strong style={{ color: "var(--qeixova-color-55-55-55)" }}>Interests:</strong> {compactList(u.interests)}</span>
                          <span><strong style={{ color: "var(--qeixova-color-55-55-55)" }}>Demo:</strong> {[u.age_range, u.gender].filter(Boolean).join(" / ") || "Not set"}</span>
                        </div>
                      )}
                    </td>
                    <td style={TD}>
                      {isBusiness ? (
                        <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          <span>{u.status || "active"}</span>
                          <span>Campaign owner</span>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          <span>{u.level_name ?? "Starter"} - L{u.level_number ?? 1}</span>
                          <span>{u.trust_score ?? 100}% trust</span>
                          <span style={{ color: u.onboarding_completed ? "#2e7d32" : "#e67e22" }}>{u.onboarding_completed ? "Onboarded" : "Incomplete"}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ ...TD, color: "#5f6876" }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={TD}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          background: u.banned ? "#ffebeb" : "#e8f5e9",
                          color: u.banned ? "#cc0000" : "#2e7d32",
                        }}
                      >
                        {u.banned ? (isBusiness ? "Suspended" : "Banned") : "Active"}
                      </span>
                    </td>
                    <td style={TD}>
                      <button
                        onClick={() => toggleAccountStatus(u)}
                        disabled={actionLoading === rowKey}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                          background: u.banned ? "#1AEF22" : "#cc0000",
                          color: "var(--qeixova-color-ff-ff-ff)",
                          opacity: actionLoading === rowKey ? 0.6 : 1,
                        }}
                      >
                        {u.banned ? (isBusiness ? "Activate" : "Unban") : (isBusiness ? "Suspend" : "Ban")}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 20, alignItems: "center" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--qeixova-color-dd-dd-dd)", cursor: "pointer", background: "var(--qeixova-color-ff-ff-ff)" }}
          >
            Prev
          </button>
          <span style={{ fontSize: 13, color: "#5f6876" }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--qeixova-color-dd-dd-dd)", cursor: "pointer", background: "var(--qeixova-color-ff-ff-ff)" }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
