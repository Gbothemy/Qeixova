"use client";

import { useCallback, useEffect, useState } from "react";

interface Business {
  id: number; name: string; email: string; industry?: string | null; website?: string | null;
  balance: number; status: string; email_verified: boolean; onboarding_completed: boolean;
  created_at: string; campaign_count: number; pending_campaigns: number; live_campaigns: number; reserved_budget: number;
}

interface BusinessStats { total: number; active: number; suspended: number; total_balance: number; }

const TH: React.CSSProperties = { padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 800, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "14px 16px", fontSize: 14, color: "#374151", borderBottom: "1px solid #eef0f3", verticalAlign: "middle" };

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: active ? "#e8f5e9" : "#ffebeb", color: active ? "#2e7d32" : "#cc0000", textTransform: "capitalize" }}>{label}</span>;
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article style={{ background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
    <span style={{ display: "block", color: "#888", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</span>
    <strong style={{ display: "block", color: "#151515", fontSize: 28, lineHeight: 1.1, marginTop: 10 }}>{value}</strong>
    <small style={{ display: "block", color: "#5f6876", fontSize: 12, marginTop: 6 }}>{detail}</small>
  </article>;
}

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [stats, setStats] = useState<BusinessStats>({ total: 0, active: 0, suspended: 0, total_balance: 0 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, page: String(page) });
      const res = await fetch(`/api/admin/businesses?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load businesses");
      setBusinesses(data.businesses ?? []);
      setStats(data.stats ?? { total: 0, active: 0, suspended: 0, total_balance: 0 });
      setTotal(data.total ?? 0);
    } catch (error) {
      setBusinesses([]); setTotal(0);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load businesses" });
    } finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { void Promise.resolve().then(fetchBusinesses); }, [fetchBusinesses]);

  async function updateBusinessStatus(business: Business) {
    const shouldActivate = business.status !== "active";
    setActionLoading(business.id); setNotice(null);
    try {
      const res = await fetch("/api/admin/businesses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: business.id, action: shouldActivate ? "activate" : "suspend" }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Business update failed");
      setNotice({ type: "success", message: `${business.name} ${shouldActivate ? "activated" : "suspended"} successfully.` });
      await fetchBusinesses();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Business update failed" });
    } finally { setActionLoading(null); }
  }

  const totalPages = Math.ceil(total / 20);

  return <div>
    <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700, color: "#1A1A1A" }}>Businesses</h1>
    <p style={{ margin: "0 0 24px", color: "#5f6876", fontSize: 14 }}>View and manage registered business accounts on Qeixova.</p>

    <div className="businessStatsGrid">
      <StatCard label="Registered" value={Number(stats.total).toLocaleString()} detail="Total business accounts" />
      <StatCard label="Active" value={Number(stats.active).toLocaleString()} detail="Can create and manage campaigns" />
      <StatCard label="Suspended" value={Number(stats.suspended).toLocaleString()} detail="Temporarily restricted accounts" />
      <StatCard label="Wallets" value={`${Number(stats.total_balance).toLocaleString()} QLT`} detail="Combined available balance" />
    </div>

    <input className="businessSearch" type="search" aria-label="Search businesses" placeholder="Search business name, email, industry, or website..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />

    {notice && <div className={`adminResult${notice.type === "error" ? " error" : ""}`}><span>{notice.message}</span><button type="button" aria-label="Dismiss notice" onClick={() => setNotice(null)}>×</button></div>}

    <div className="admin-table-wrap" style={{ background: "#fff", borderRadius: 12, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1060 }}>
        <thead><tr style={{ background: "#fafafa" }}>{["ID","Business","Email","Wallet","Campaigns","Profile","Verification","Joined","Status","Action"].map(label => <th key={label} style={TH}>{label}</th>)}</tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={10} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>Loading businesses...</td></tr>
          : businesses.length === 0 ? <tr><td colSpan={10} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>No registered businesses found</td></tr>
          : businesses.map((business) => {
            const active = business.status === "active";
            return <tr key={business.id} style={{ background: active ? "transparent" : "#fff8f8" }}>
              <td style={TD}>{business.id}</td>
              <td style={{ ...TD, fontWeight: 600, color: "#222" }}><div style={{ display: "grid", gap: 5 }}><span>{business.name}</span><small style={{ color: "#b56d00", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>Business account</small></div></td>
              <td style={TD}>{business.email}</td>
              <td style={TD}>{Number(business.balance).toLocaleString()} QLT</td>
              <td style={TD}><div style={{ display: "grid", gap: 4, fontSize: 12, lineHeight: 1.35 }}><span><strong>{business.campaign_count}</strong> total</span><span><strong style={{ color: "#b56d00" }}>{business.pending_campaigns}</strong> pending review</span><span><strong style={{ color: "#2e7d32" }}>{business.live_campaigns}</strong> live</span></div></td>
              <td style={{ ...TD, minWidth: 210 }}><div style={{ display: "grid", gap: 4, fontSize: 12, lineHeight: 1.35 }}><span><strong>Industry:</strong> {business.industry || "Not set"}</span><span><strong>Website:</strong> {business.website || "Not set"}</span><span><strong>Reserved:</strong> {Number(business.reserved_budget).toLocaleString()} QLT</span></div></td>
              <td style={TD}><div style={{ display: "grid", gap: 7 }}><StatusPill active={business.email_verified} label={business.email_verified ? "Email verified" : "Email pending"} /><StatusPill active={business.onboarding_completed} label={business.onboarding_completed ? "Onboarded" : "Onboarding open"} /></div></td>
              <td style={{ ...TD, color: "#5f6876" }}>{new Date(business.created_at).toLocaleDateString()}</td>
              <td style={TD}><StatusPill active={active} label={active ? "Active" : "Suspended"} /></td>
              <td style={TD}><button onClick={() => updateBusinessStatus(business)} disabled={actionLoading === business.id} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: active ? "#cc0000" : "#1AEF22", color: active ? "#fff" : "#000", opacity: actionLoading === business.id ? 0.6 : 1 }}>{actionLoading === business.id ? "Updating..." : active ? "Suspend" : "Activate"}</button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>

    {totalPages > 1 && <div style={{ display: "flex", gap: 8, marginTop: 20, alignItems: "center" }}>
      <button onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ddd", background: "#fff" }}>Prev</button>
      <span style={{ fontSize: 13, color: "#5f6876" }}>Page {page} of {totalPages}</span>
      <button onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ddd", background: "#fff" }}>Next</button>
    </div>}
  </div>;
}
