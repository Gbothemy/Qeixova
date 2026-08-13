"use client";
import { useEffect, useState, useCallback } from "react";
import { formatNairaFromQlt } from "@/lib/currency";

interface Withdrawal {
  id: number;
  user_name: string;
  amount: number;
  label: string;
  created_at: string;
  status: string;
}

type StatusFilter = "all" | "pending" | "processing" | "completed" | "failed";

const TH: React.CSSProperties = { padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 800, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "14px 16px", fontSize: 14, color: "#374151", borderBottom: "1px solid #eef0f3", verticalAlign: "middle" };
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: "#fff8e1", color: "#e67e22" },
  processing: { bg: "#e3f2fd", color: "#1565c0" },
  completed:  { bg: "#e8f5e9", color: "#2e7d32" },
  failed:     { bg: "#ffebeb", color: "#cc0000" },
};

function QLTToNaira(QLT: number) {
  return "₦" + formatNairaFromQlt(QLT, { minimumFractionDigits: 2 });
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filter !== "all" ? { status: filter } : {});
      const res = await fetch(`/api/admin/withdrawals?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load withdrawals");
      setWithdrawals(data.withdrawals ?? []);
    } catch (error) {
      setWithdrawals([]);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load withdrawals" });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void Promise.resolve().then(fetchWithdrawals); }, [fetchWithdrawals]);

  async function handleAction(id: number, action: "approve" | "processing" | "reject") {
    setActionLoading(id);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Withdrawal action failed");
      const label = action === "approve" ? "marked paid" : action === "processing" ? "moved to processing" : "rejected";
      setNotice({ type: "success", message: `Withdrawal ${label} successfully.` });
      fetchWithdrawals();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Withdrawal action failed" });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="adminPage">
      <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700, color: "#1A1A1A" }}>Withdrawals</h1>
      <p style={{ margin: "0 0 24px", color: "#5f6876", fontSize: 14 }}>Manage withdrawal requests</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["all", "pending", "processing", "completed", "failed"] as StatusFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "8px 18px", borderRadius: 20, border: "1.5px solid", borderColor: filter === f ? "#1AEF22" : "#d8dde5", background: filter === f ? "#1AEF22" : "#fff", color: filter === f ? "#041006" : "#4b5563", cursor: "pointer", fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>
            {f}
          </button>
        ))}
      </div>

      {notice && (
        <div className={`adminResult${notice.type === "error" ? " error" : ""}`}>
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)}>x</button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={TH}>ID</th>
              <th style={TH}>User</th>
              <th style={TH}>QLT</th>
              <th style={TH}>Naira</th>
              <th style={TH}>Bank Details</th>
              <th style={TH}>Date</th>
              <th style={TH}>Status</th>
              <th style={TH}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>Loading...</td></tr>
            ) : withdrawals.length === 0 ? (
              <tr><td colSpan={8} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>No withdrawals found</td></tr>
            ) : withdrawals.map((w) => {
              const sc = STATUS_COLORS[w.status] ?? { bg: "#f3f4f6", color: "#4b5563" };
              return (
                <tr key={w.id}>
                  <td style={TD}>{w.id}</td>
                  <td style={{ ...TD, fontWeight: 500 }}>{w.user_name}</td>
                  <td style={TD}>{Number(w.amount).toLocaleString()}</td>
                  <td style={TD}>{QLTToNaira(w.amount)}</td>
                  <td style={{ ...TD, maxWidth: 260 }}>
                    {/* Parse the rich label: "Withdrawal to BankName | Acct: 1234567890 | Name: John Doe" */}
                    {(() => {
                      const info = w.label.replace("Withdrawal to ", "");
                      const parts = info.split("|").map((s: string) => s.trim());
                      if (parts.length >= 3) {
                        return (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#1A1A1A" }}>{parts[0]}</div>
                            <div style={{ fontSize: 12, color: "#5f6876", marginTop: 2 }}>{parts[1]}</div>
                            <div style={{ fontSize: 12, color: "#5f6876", marginTop: 1 }}>{parts[2]}</div>
                          </div>
                        );
                      }
                      return <span style={{ fontSize: 13, color: "#5f6876" }}>{info}</span>;
                    })()}
                  </td>
                  <td style={{ ...TD, color: "#5f6876" }}>{new Date(w.created_at).toLocaleDateString()}</td>
                  <td style={TD}>
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color, textTransform: "capitalize" }}>
                      {w.status}
                    </span>
                  </td>
                  <td style={TD}>
                    {w.status === "pending" && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => handleAction(w.id, "processing")} disabled={actionLoading === w.id}
                          style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#1565c0", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          Processing
                        </button>
                        <button onClick={() => handleAction(w.id, "reject")} disabled={actionLoading === w.id}
                          style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#cc0000", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          Reject
                        </button>
                      </div>
                    )}
                    {w.status === "processing" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => handleAction(w.id, "approve")} disabled={actionLoading === w.id}
                          style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#1AEF22", color: "#000", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                          Mark Paid
                        </button>
                        <button onClick={() => handleAction(w.id, "reject")} disabled={actionLoading === w.id}
                          style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#cc0000", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          Reject
                        </button>
                      </div>
                    )}
                    {(w.status === "completed" || w.status === "failed") && (
                      <span style={{ color: "#667085", fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
