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

const TH: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 800,
  color: "#4b5563",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 14,
  color: "#374151",
  borderBottom: "1px solid #eef0f3",
  verticalAlign: "middle",
};

function compactList(values: string[] | undefined, fallback = "Not set") {
  if (!values?.length) return fallback;
  if (values.length <= 3) return values.join(", ");
  return `${values.slice(0, 3).join(", ")} +${values.length - 3}`;
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
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    void Promise.resolve().then(fetchUsers);
  }, [fetchUsers]);

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

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="adminPage">
      <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700, color: "#1A1A1A" }}>Users</h1>
      <p style={{ margin: "0 0 24px", color: "#5f6876", fontSize: 14 }}>
        {total.toLocaleString()} total registered accounts
      </p>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search name, email, industry, country, state, or city..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{
            padding: "10px 16px",
            border: "1.5px solid #e0e0e0",
            borderRadius: 8,
            fontSize: 14,
            width: 360,
            maxWidth: "100%",
            outline: "none",
          }}
        />
      </div>

      <div className="adminLocationOverview">
        <LocationBreakdown title="Contributors by location" groups={locationGroups.filter((group) => group.account_type === "contributor")} />
        <LocationBreakdown title="Businesses by location" groups={locationGroups.filter((group) => group.account_type === "business")} />
      </div>

      {notice && (
        <div className={`adminResult${notice.type === "error" ? " error" : ""}`}>
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)}>x</button>
        </div>
      )}

      <div className="admin-table-wrap" style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1040 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
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
                  <tr key={rowKey} style={{ background: u.banned ? "#fff8f8" : "transparent" }}>
                    <td style={TD}>{u.id}</td>
                    <td style={{ ...TD, fontWeight: 500 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <span style={{ color: "#222" }}>{u.full_name}</span>
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
                          {isBusiness ? "Business" : "Contributor"}
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
                        <strong style={{ color: "#222" }}>{u.country || "Not specified"}</strong>
                        <span>{[u.city, u.state].filter(Boolean).join(", ") || "State/region not specified"}</span>
                        <small style={{ color: u.state ? "#2e7d32" : "#b56d00", fontWeight: 700 }}>{u.state ? "Classified" : "Incomplete location"}</small>
                      </div>
                    </td>
                    <td style={{ ...TD, minWidth: 220 }}>
                      {isBusiness ? (
                        <div style={{ display: "grid", gap: 4, fontSize: 12, lineHeight: 1.35 }}>
                          <span><strong style={{ color: "#555" }}>Industry:</strong> {u.industry || "Not set"}</span>
                          <span><strong style={{ color: "#555" }}>Website:</strong> {u.website || "Not set"}</span>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 4, fontSize: 12, lineHeight: 1.35 }}>
                          <span><strong style={{ color: "#555" }}>State:</strong> {u.state || "Not set"}</span>
                          <span><strong style={{ color: "#555" }}>Interests:</strong> {compactList(u.interests)}</span>
                          <span><strong style={{ color: "#555" }}>Demo:</strong> {[u.age_range, u.gender].filter(Boolean).join(" / ") || "Not set"}</span>
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
                          color: "#fff",
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
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 20, alignItems: "center" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ddd", cursor: "pointer", background: "#fff" }}
          >
            Prev
          </button>
          <span style={{ fontSize: 13, color: "#5f6876" }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ddd", cursor: "pointer", background: "#fff" }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

