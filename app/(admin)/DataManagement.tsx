"use client";
import { useState } from "react";

interface ClearOption {
  scope: string;
  label: string;
  description: string;
  danger: "medium" | "high" | "critical";
  icon: string;
}

const OPTIONS: ClearOption[] = [
  {
    scope: "completions",
    label: "Clear Task Completions",
    description: "Removes all task completion records and resets task budgets. User balances are NOT affected.",
    danger: "medium",
    icon: "📋",
  },
  {
    scope: "transactions",
    label: "Clear Transactions & Balances",
    description: "Deletes all transaction history and resets every user's QLT balance to 0.",
    danger: "high",
    icon: "💰",
  },
  {
    scope: "tasks",
    label: "Deactivate All Tasks",
    description: "Soft-disables all tasks so users can't see them. Tasks can be re-activated individually.",
    danger: "medium",
    icon: "🔒",
  },
  {
    scope: "tasks_hard",
    label: "Delete All Tasks",
    description: "Permanently deletes all tasks and their completion records. This cannot be undone.",
    danger: "high",
    icon: "🗑️",
  },
  {
    scope: "users",
    label: "Delete All Users",
    description: "Permanently deletes all user accounts, their balances, completions, and transactions. Tasks are kept.",
    danger: "critical",
    icon: "👥",
  },
  {
    scope: "all",
    label: "Wipe All App Data",
    description: "Nuclear option. Deletes ALL users, tasks, completions, and transactions. The database will be empty.",
    danger: "critical",
    icon: "☢️",
  },
];

const DANGER_STYLES = {
  medium:   { bg: "#fff8e1", border: "#f0c040", btn: "#e67e22", badge: "#fff3cd", badgeText: "#856404" },
  high:     { bg: "#fff0f0", border: "#f5a0a0", btn: "#cc0000", badge: "#ffe0e0", badgeText: "#cc0000" },
  critical: { bg: "#1a0000", border: "#cc0000", btn: "#8b0000", badge: "#cc0000", badgeText: "#fff" },
};

export default function DataManagement() {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleClear = async (scope: string) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/clear-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, message: data.message || data.error });
    } catch {
      setResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setLoading(false);
      setConfirming(null);
      setConfirmText("");
    }
  };

  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>Data Management</h2>
        <span style={{ background: "#ffebeb", color: "#cc0000", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, letterSpacing: 0.5 }}>
          DANGER ZONE
        </span>
      </div>
      <p style={{ margin: "0 0 24px", color: "#ccc", fontSize: 14 }}>
        These actions are irreversible. Use with extreme caution.
      </p>

      {result && (
        <div style={{
          background: result.ok ? "#e8f5e9" : "#ffebeb",
          border: `1px solid ${result.ok ? "#b3f5b6" : "#f5a0a0"}`,
          borderRadius: 10, padding: "12px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>{result.ok ? "✅" : "❌"}</span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: result.ok ? "#2e7d32" : "#cc0000" }}>
            {result.message}
          </p>
          <button onClick={() => setResult(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#aaa" }}>×</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {OPTIONS.map((opt) => {
          const s = DANGER_STYLES[opt.danger];
          const isConfirming = confirming === opt.scope;
          const CONFIRM_PHRASE = `DELETE ${opt.scope.toUpperCase()}`;

          return (
            <div key={opt.scope} style={{
              background: opt.danger === "critical" ? "#fff8f8" : "#fff",
              border: `1.5px solid ${s.border}`,
              borderRadius: 12, padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>{opt.label}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: s.badge, color: s.badgeText, textTransform: "uppercase" }}>
                      {opt.danger}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#ccc", lineHeight: 1.5 }}>{opt.description}</p>
                </div>
              </div>

              {!isConfirming ? (
                <button
                  onClick={() => { setConfirming(opt.scope); setConfirmText(""); setResult(null); }}
                  style={{
                    width: "100%", padding: "9px", borderRadius: 8, border: "none",
                    background: s.btn, color: "#fff", cursor: "pointer",
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  {opt.icon} {opt.label}
                </button>
              ) : (
                <div style={{ background: "#f9f9f9", borderRadius: 8, padding: 14, border: "1px solid #eee" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#bbb", fontWeight: 600 }}>
                    Type <code style={{ background: "#f0f0f0", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>{CONFIRM_PHRASE}</code> to confirm:
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_PHRASE}
                    style={{
                      width: "100%", padding: "8px 10px", borderRadius: 6,
                      border: "1.5px solid #ddd", fontSize: 13, outline: "none",
                      boxSizing: "border-box", marginBottom: 10,
                      fontFamily: "monospace",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { setConfirming(null); setConfirmText(""); }}
                      style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 13 }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleClear(opt.scope)}
                      disabled={confirmText !== CONFIRM_PHRASE || loading}
                      style={{
                        flex: 2, padding: "8px", borderRadius: 6, border: "none",
                        background: confirmText === CONFIRM_PHRASE ? s.btn : "#ccc",
                        color: "#fff", cursor: confirmText === CONFIRM_PHRASE ? "pointer" : "not-allowed",
                        fontSize: 13, fontWeight: 700,
                      }}
                    >
                      {loading ? "Processing..." : "Confirm & Execute"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

