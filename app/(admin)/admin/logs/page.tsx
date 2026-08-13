"use client";
import { useEffect, useState, useCallback } from "react";

interface LogEntry {
  id: number; event_type: string; entity_type: string | null; entity_id: number | null;
  data: Record<string, unknown>; created_at: string; user_name: string; email: string;
}
const EVENT_COLORS: Record<string, string> = {
  mission_submitted:   "#4a9eff",
  mission_approved:    "#2e7d32",
  mission_rejected:    "#c62828",
  qlt_progress_awarded: "#F5A623",
  level_up:            "#c084fc",
  wallet_credited:     "#1AEF22",
  wallet_debited:      "#e53e3e",
  referral_bonus:      "#F5A623",
  milestone_awarded:   "#c084fc",
  trust_score_updated: "#4b5563",
  rate_limit_hit:      "#e67e22",
  fraud_flagged:       "#c62828",
};

const TH: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "10px 14px", fontSize: 12, color: "#374151", borderBottom: "1px solid #eef0f3", verticalAlign: "top" };

const EVENT_TYPES = ["", "mission_submitted", "mission_approved", "mission_rejected", "wallet_credited", "level_up", "rate_limit_hit", "fraud_flagged", "referral_bonus", "milestone_awarded"];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventFilter, setEventFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (eventFilter) params.set("event_type", eventFilter);
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load audit logs");
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch (loadError) {
      setLogs([]);
      setTotal(0);
      setError(loadError instanceof Error ? loadError.message : "Unable to load audit logs");
    } finally { setLoading(false); }
  }, [page, eventFilter]);

  useEffect(() => { void Promise.resolve().then(fetchLogs); }, [fetchLogs]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="adminPage">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "#1A1A1A" }}>Audit Logs</h1>
        <p style={{ margin: 0, color: "#5f6876", fontSize: 13 }}>{total.toLocaleString()} events logged</p>
      </div>

      {error && <div className="adminResult error"><span>{error}</span><button type="button" onClick={() => void fetchLogs()}>Retry</button></div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {EVENT_TYPES.map(e => (
          <button key={e} onClick={() => { setEventFilter(e); setPage(1); }}
            style={{ padding: "6px 12px", borderRadius: 20, border: "1.5px solid", borderColor: eventFilter === e ? "#1AEF22" : "#d8dde5", background: eventFilter === e ? "#1AEF22" : "#fff", color: eventFilter === e ? "#041006" : "#4b5563", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
            {e === "" ? "All Events" : e.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={TH}>Time</th>
              <th style={TH}>Event</th>
              <th style={TH}>User</th>
              <th style={TH}>Entity</th>
              <th style={TH}>Data</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...TD, textAlign: "center", padding: 40, color: "#667085" }}>Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} style={{ ...TD, textAlign: "center", padding: 40, color: "#667085" }}>No logs found</td></tr>
            ) : logs.map(l => (
              <tr key={l.id}>
                <td style={{ ...TD, color: "#5f6876", whiteSpace: "nowrap" }}>
                  {new Date(l.created_at).toLocaleDateString()}<br />
                  <span style={{ fontSize: 10 }}>{new Date(l.created_at).toLocaleTimeString()}</span>
                </td>
                <td style={TD}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: (EVENT_COLORS[l.event_type] ?? "#4b5563") + "18", color: EVENT_COLORS[l.event_type] ?? "#4b5563" }}>
                    {l.event_type.replace(/_/g, " ")}
                  </span>
                </td>
                <td style={TD}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{l.user_name ?? "—"}</div>
                  <div style={{ fontSize: 10, color: "#5f6876" }}>{l.email}</div>
                </td>
                <td style={{ ...TD, color: "#5f6876" }}>
                  {l.entity_type && <span>{l.entity_type} #{l.entity_id}</span>}
                </td>
                <td style={{ ...TD, maxWidth: 300 }}>
                  <pre style={{ fontSize: 10, color: "#4b5563", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {JSON.stringify(l.data, null, 1)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #ddd", cursor: "pointer", background: "#fff" }}>← Prev</button>
          <span style={{ fontSize: 13, color: "#5f6876" }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #ddd", cursor: "pointer", background: "#fff" }}>Next →</button>
        </div>
      )}
    </div>
  );
}
