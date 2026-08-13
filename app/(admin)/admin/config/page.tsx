"use client";
import { useEffect, useState } from "react";

interface Config { key: string; value: string; description: string; updated_at: string; }

const LABELS: Record<string, string> = {
  max_submissions_per_hour:   "Max Submissions / Hour",
  referral_bonus_qlt:         "Referral Bonus (QLT)",
  referral_welcome_qlt:       "Welcome Bonus (QLT)",
  referral_earnings_pct:      "Referral Earnings %",
  min_withdrawal_qlt:         "Min Withdrawal (QLT)",
  platform_fee_pct:           "Platform Fee %",
  trust_score_flag_threshold: "Trust Score Flag Threshold",
  trust_score_min_missions:   "Min Missions Before Trust Enforced",
};

export default function ConfigPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/config").then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load economy settings");
      return data;
    }).then(d => {
      if (d.configs) {
        setConfigs(d.configs);
        const vals: Record<string, string> = {};
        d.configs.forEach((c: Config) => { vals[c.key] = c.value; });
        setEditing(vals);
      }
    }).catch((error) => setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load economy settings" }))
      .finally(() => setLoading(false));
  }, []);

  const save = async (key: string) => {
    setSaving(key);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value: editing[key] }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to save economy setting");
      setSaved(key);
      setNotice({ type: "success", message: `${LABELS[key] ?? key} updated successfully.` });
      setTimeout(() => setSaved(null), 1500);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save economy setting" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="adminPage">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "#1A1A1A" }}>Economy Config</h1>
        <p style={{ margin: 0, color: "#5f6876", fontSize: 13 }}>Tune platform economics without redeploying.</p>
      </div>

      {notice && <div className={`adminResult${notice.type === "error" ? " error" : ""}`}><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)}>×</button></div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? <div className="adminPanel">Loading economy settings…</div> : configs.length === 0 ? <div className="adminPanel">No economy settings are available.</div> : configs.map(c => (
          <div key={c.key} style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A", marginBottom: 3 }}>{LABELS[c.key] ?? c.key}</p>
              <p style={{ fontSize: 12, color: "#4b5563" }}>{c.description}</p>
              <p style={{ fontSize: 10, color: "#5f6876", marginTop: 3 }}>Updated: {new Date(c.updated_at).toLocaleString()}</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="text" value={editing[c.key] ?? c.value} onChange={e => setEditing(v => ({ ...v, [c.key]: e.target.value }))}
                style={{ padding: "8px 12px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 14, width: 120, outline: "none", textAlign: "right", fontWeight: 700 }} />
              <button onClick={() => save(c.key)} disabled={saving === c.key}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: saved === c.key ? "#1AEF22" : "#1A1A1A", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", minWidth: 70 }}>
                {saved === c.key ? "✓ Saved" : saving === c.key ? "..." : "Save"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
