"use client";
import { useEffect, useState, useCallback } from "react";

interface Completion {
  id: number;
  user_id: number;
  user_name: string;
  email: string;
  trust_score: number;
  task_title: string;
  category: string;
  mission_type: string;
  proof_type: string;
  proof_value: string | null;
  completed_at: string;
  status: string;
  rejection_reason: string | null;
  reward: number;
  xp_reward: number;
}

const TH: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "12px 14px", fontSize: 13, color: "#374151", borderBottom: "1px solid #eef0f3", verticalAlign: "middle" };

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:  { bg: "#fff8e1", color: "#e67e22" },
  approved: { bg: "#e8f5e9", color: "#2e7d32" },
  rejected: { bg: "#fce4ec", color: "#c62828" },
};

const MISSION_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  engagement:    { bg: "#e3f2fd", color: "#1565c0", label: "Engagement" },
  participation: { bg: "#fff8e1", color: "#e67e22", label: "Participation" },
  premium:       { bg: "#f3e5f5", color: "#7b1fa2", label: "Premium" },
};

const REJECTION_REASONS = [
  "Screenshot does not match task requirement",
  "Username not visible in screenshot",
  "Task not completed correctly",
  "Duplicate or reused submission",
  "Suspicious activity detected",
  "Profile link does not match",
];

type ProofScreenshot = { name: string; dataUrl: string };
type ProofPlatform = { id: string; label: string; platform: string; rewardQlt: number };

function parseScreenshots(value: string | null): ProofScreenshot[] {
  if (!value) return [];
  if (value.startsWith("data:image/")) return [{ name: "Screenshot proof", dataUrl: value }];

  try {
    const parsed = JSON.parse(value) as { type?: string; screenshots?: { name?: string; dataUrl?: string }[] };
    if (parsed.type !== "screenshots" || !Array.isArray(parsed.screenshots)) return [];
    return parsed.screenshots
      .filter((shot) => typeof shot.dataUrl === "string" && shot.dataUrl.startsWith("data:image/"))
      .map((shot, index) => ({ name: shot.name || `Screenshot ${index + 1}`, dataUrl: shot.dataUrl as string }));
  } catch {
    return [];
  }
}

function parseProofPlatforms(value: string | null): ProofPlatform[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as { selectedPlatforms?: Partial<ProofPlatform>[] };
    if (!Array.isArray(parsed.selectedPlatforms)) return [];
    return parsed.selectedPlatforms
      .filter((platform) => typeof platform?.platform === "string")
      .map((platform) => ({
        id: String(platform.id || platform.platform),
        label: String(platform.label || platform.platform),
        platform: String(platform.platform),
        rewardQlt: Number(platform.rewardQlt) || 0,
      }));
  } catch {
    return [];
  }
}

function parseProofText(value: string | null) {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value) as { value?: string };
    return typeof parsed.value === "string" ? parsed.value : value;
  } catch {
    return value;
  }
}

function PlatformChips({ platforms }: { platforms: ProofPlatform[] }) {
  if (platforms.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
      {platforms.map((platform) => (
        <span key={platform.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, background: "#fff8e1", color: "#9a6500", padding: "3px 7px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>
          {platform.platform} - {platform.rewardQlt.toLocaleString()} QLT
        </span>
      ))}
    </div>
  );
}

function ProofCell({ type, value, onPreview }: { type: string; value: string | null; onPreview: (shots: ProofScreenshot[]) => void }) {
  if (!value) return <span style={{ color: "#667085" }}>—</span>;
  const shots = parseScreenshots(value);
  const selectedPlatforms = parseProofPlatforms(value);
  const proofText = parseProofText(value);
  if (shots.length > 0) {
    return (
      <div>
        <button
          type="button"
          onClick={() => onPreview(shots)}
          style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 180, border: "1px solid #d7f3d8", borderRadius: 12, background: "#f2fbf2", padding: 6, cursor: "pointer", textAlign: "left" }}
        >
          <img src={shots[0].dataUrl} alt={shots[0].name} style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 9, border: "1px solid #d9ead9", flexShrink: 0 }} />
          <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
            <strong style={{ color: "#2e7d32", fontSize: 12 }}>{shots.length} screenshot{shots.length === 1 ? "" : "s"}</strong>
            <small style={{ color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Click to preview</small>
          </span>
        </button>
        <PlatformChips platforms={selectedPlatforms} />
      </div>
    );
  }
  if (value === "[screenshot uploaded]" || value.startsWith("[")) {
    return (
      <span title="This older proof was saved before image previews were enabled. Ask the contributor to resubmit if the image must be inspected." style={{ display: "inline-block", padding: "3px 9px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: "#fff8e1", color: "#b7791f", whiteSpace: "nowrap" }}>
        No preview saved
      </span>
    );
  }
  if (value === "__legacy_unreachable__") {
    return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: "#e8f5e9", color: "#2e7d32" }}>📸 Screenshot</span>;
  }
  if (type === "url") {
    return (
      <div>
        <a href={proofText} target="_blank" rel="noopener noreferrer" style={{ color: "#1565c0", fontSize: 12, wordBreak: "break-all" }}>{proofText.length > 40 ? proofText.slice(0, 40) + "..." : proofText}</a>
        <PlatformChips platforms={selectedPlatforms} />
      </div>
    );
  }
  return (
    <div className="adminPage">
      <span style={{ fontSize: 12, color: "#5f6876" }}>{proofText.length > 50 ? proofText.slice(0, 50) + "..." : proofText}</span>
      <PlatformChips platforms={selectedPlatforms} />
    </div>
  );
}

function TrustBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#2e7d32" : score >= 50 ? "#e67e22" : "#c62828";
  const bg    = score >= 80 ? "#e8f5e9" : score >= 50 ? "#fff8e1" : "#fce4ec";
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: bg, color }}>{score}%</span>;
}

export default function CompletionsPage() {
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [proofFilter, setProofFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: number; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState(REJECTION_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [previewShots, setPreviewShots] = useState<ProofScreenshot[] | null>(null);

  const fetchCompletions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (proofFilter) params.set("proof_type", proofFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/completions?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load mission proof");
      setCompletions(data.completions ?? []);
      setTotal(data.total ?? 0);
    } catch (error) {
      setCompletions([]);
      setTotal(0);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load mission proof" });
    } finally { setLoading(false); }
  }, [page, proofFilter, statusFilter]);

  useEffect(() => { void Promise.resolve().then(fetchCompletions); }, [fetchCompletions]);

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/completions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completionId: id, action: "approve" }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Approval failed");
      setNotice({ type: "success", message: "Mission proof approved and QLT released." });
      fetchCompletions();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Approval failed" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    const reason = customReason.trim() || rejectReason;
    setNotice(null);
    try {
      const res = await fetch("/api/admin/completions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completionId: rejectModal.id, action: "reject", rejectionReason: reason }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Rejection failed");
      setNotice({ type: "success", message: "Mission proof rejected with reason saved." });
      setRejectModal(null);
      setCustomReason("");
      fetchCompletions();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Rejection failed" });
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / 30);
  const pendingCount = completions.filter(c => c.status === "pending").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "#1A1A1A" }}>User Mission Proof Approval</h1>
          <p style={{ margin: 0, color: "#5f6876", fontSize: 13 }}>{total.toLocaleString()} total · {pendingCount} pending review</p>
        </div>
        {statusFilter === "pending" && pendingCount > 0 && (
          <div style={{ background: "#fff8e1", border: "1px solid #f5a623", borderRadius: 10, padding: "8px 16px", fontSize: 13, color: "#e67e22", fontWeight: 600 }}>
            ⚠️ {pendingCount} awaiting review
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {[{ val: "pending", label: "Pending" }, { val: "approved", label: "Approved" }, { val: "rejected", label: "Rejected" }, { val: "", label: "All" }].map(f => (
          <button key={f.val} onClick={() => { setStatusFilter(f.val); setPage(1); }}
            style={{ padding: "7px 16px", borderRadius: 20, border: "1.5px solid", borderColor: statusFilter === f.val ? "#1AEF22" : "#d8dde5", background: statusFilter === f.val ? "#1AEF22" : "#fff", color: statusFilter === f.val ? "#041006" : "#4b5563", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            {f.label}
          </button>
        ))}
        <div style={{ width: 1, background: "#eee", margin: "0 4px" }} />
        {["", "screenshot", "url", "text"].map(f => (
          <button key={f} onClick={() => { setProofFilter(f); setPage(1); }}
            style={{ padding: "7px 14px", borderRadius: 20, border: "1.5px solid", borderColor: proofFilter === f ? "#4b5563" : "#d8dde5", background: proofFilter === f ? "#4b5563" : "#fff", color: proofFilter === f ? "#fff" : "#4b5563", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            {f === "" ? "All Proof" : f}
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
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={TH}>ID</th>
              <th style={TH}>User / Trust</th>
              <th style={TH}>Mission</th>
              <th style={TH}>Type</th>
              <th style={TH}>Reward</th>
              <th style={TH}>Proof</th>
              <th style={TH}>Status</th>
              <th style={TH}>Date</th>
              <th style={TH}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>Loading…</td></tr>
            ) : completions.length === 0 ? (
              <tr><td colSpan={9} style={{ ...TD, textAlign: "center", color: "#667085", padding: 40 }}>No submissions found</td></tr>
            ) : completions.map(c => {
              const mt = MISSION_COLORS[c.mission_type] ?? MISSION_COLORS.engagement;
              return (
                <tr key={c.id} style={{ background: c.status === "pending" ? "#fffdf5" : "white" }}>
                  <td style={{ ...TD, color: "#667085" }}>{c.id}</td>
                  <td style={TD}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.user_name}</div>
                    <div style={{ fontSize: 11, color: "#5f6876", marginBottom: 3 }}>{c.email}</div>
                    <TrustBadge score={c.trust_score ?? 100} />
                  </td>
                  <td style={{ ...TD, maxWidth: 180 }}>
                    <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.task_title}</div>
                    <div style={{ fontSize: 11, color: "#5f6876" }}>{c.category}</div>
                    {c.rejection_reason && <div style={{ fontSize: 11, color: "#c62828", marginTop: 2 }}>↳ {c.rejection_reason}</div>}
                  </td>
                  <td style={TD}>
                    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: mt.bg, color: mt.color }}>{mt.label}</span>
                  </td>
                  <td style={TD}>
                    <div style={{ fontWeight: 700, color: "#2e7d32", fontSize: 13 }}>{c.reward?.toLocaleString()} QLT</div>
                    <div style={{ fontSize: 11, color: "#5f6876" }}>+{c.xp_reward ?? 0} QLT bonus</div>
                  </td>
                  <td style={{ ...TD, maxWidth: 220 }}><ProofCell type={c.proof_type} value={c.proof_value} onPreview={setPreviewShots} /></td>
                  <td style={TD}>
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: (STATUS_COLORS[c.status] ?? STATUS_COLORS.pending).bg, color: (STATUS_COLORS[c.status] ?? STATUS_COLORS.pending).color }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ ...TD, color: "#5f6876", whiteSpace: "nowrap", fontSize: 12 }}>
                    {new Date(c.completed_at).toLocaleDateString()}<br />
                    <span style={{ fontSize: 11 }}>{new Date(c.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </td>
                  <td style={TD}>
                    {c.status === "pending" ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => handleApprove(c.id)} disabled={actionLoading === c.id}
                          style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: "#1AEF22", color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                          {actionLoading === c.id ? "…" : "✓ Approve"}
                        </button>
                        <button onClick={() => setRejectModal({ id: c.id, title: c.task_title })} disabled={actionLoading === c.id}
                          style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: "#fce4ec", color: "#c62828", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                          ✕ Reject
                        </button>
                      </div>
                    ) : <span style={{ color: "#667085", fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              );
            })}
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

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>Reject completed mission proof</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#5f6876" }}>{rejectModal.title}</p>
            <label style={{ fontSize: 11, fontWeight: 800, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5 }}>Reason</label>
            <select value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              style={{ width: "100%", marginTop: 6, marginBottom: 12, padding: "10px 12px", borderRadius: 8, border: "1.5px solid #ddd", fontSize: 13, outline: "none" }}>
              {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <label style={{ fontSize: 11, fontWeight: 800, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5 }}>Custom (optional)</label>
            <input value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="Override with custom reason..."
              style={{ width: "100%", marginTop: 6, marginBottom: 20, padding: "10px 12px", borderRadius: 8, border: "1.5px solid #ddd", fontSize: 13, outline: "none" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setRejectModal(null); setCustomReason(""); }} style={{ flex: 1, padding: "11px", borderRadius: 9, border: "1.5px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleReject} disabled={actionLoading !== null} style={{ flex: 1, padding: "11px", borderRadius: 9, border: "none", background: "#c62828", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                {actionLoading !== null ? "Rejecting…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewShots && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setPreviewShots(null)}>
          <div style={{ width: "min(980px, 100%)", maxHeight: "92vh", overflow: "auto", background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Proof screenshots</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>{previewShots.length} image{previewShots.length === 1 ? "" : "s"} submitted by contributor</p>
              </div>
              <button type="button" onClick={() => setPreviewShots(null)} style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", padding: "9px 12px", fontWeight: 700, cursor: "pointer" }}>Close</button>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {previewShots.map((shot, index) => (
                <figure key={`${shot.name}-${index}`} style={{ margin: 0, border: "1px solid #eef0f3", borderRadius: 14, padding: 10, background: "#f9fafb" }}>
                  <img src={shot.dataUrl} alt={shot.name} style={{ display: "block", width: "100%", maxHeight: "72vh", objectFit: "contain", borderRadius: 10, background: "#111" }} />
                  <figcaption style={{ marginTop: 8, color: "#4b5563", fontSize: 12 }}>{shot.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
