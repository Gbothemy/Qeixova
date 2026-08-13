"use client";

import { useState } from "react";

type Danger = "medium" | "high" | "critical";
type ClearOption = {
  scope: string;
  label: string;
  description: string;
  danger: Danger;
  icon: string;
};

const OPTIONS: ClearOption[] = [
  { scope: "completions", label: "Clear Mission Submissions", description: "Removes all submission records and resets campaign usage counters. User balances are not affected.", danger: "medium", icon: "📋" },
  { scope: "transactions", label: "Clear Transactions & Balances", description: "Deletes transaction history and resets every contributor QLT balance to zero.", danger: "high", icon: "💰" },
  { scope: "tasks", label: "Deactivate All Missions", description: "Soft-disables all missions so contributors cannot discover them. They can be reactivated later.", danger: "medium", icon: "🔒" },
  { scope: "tasks_hard", label: "Delete All Missions", description: "Permanently deletes all missions and their submission records. This cannot be undone.", danger: "high", icon: "🗑️" },
  { scope: "users", label: "Delete All Users", description: "Permanently deletes user accounts, balances, submissions, and transactions. Missions are kept.", danger: "critical", icon: "👥" },
  { scope: "all", label: "Wipe All App Data", description: "Deletes users, missions, submissions, and transactions. Use only when resetting a test environment.", danger: "critical", icon: "☢️" },
];

export default function DataManagement() {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleClear(scope: string) {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/clear-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const data = await response.json().catch(() => ({}));
      setResult({ ok: response.ok, message: data.message || data.error || "Operation finished." });
    } catch {
      setResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setLoading(false);
      setConfirming(null);
      setConfirmText("");
    }
  }

  return (
    <section className="dataManagement">
      <header>
        <div>
          <div className="dataTitleRow">
            <h2>Data Management</h2>
            <span>Restricted</span>
          </div>
          <p>Controlled reset tools for test data and operational recovery.</p>
        </div>
      </header>

      {result && (
        <div className={result.ok ? "dataResult success" : "dataResult error"} role="status">
          <span aria-hidden="true">{result.ok ? "✓" : "!"}</span>
          <p>{result.message}</p>
          <button type="button" onClick={() => setResult(null)} aria-label="Dismiss result">×</button>
        </div>
      )}

      <div className="dataGrid">
        {OPTIONS.map((option) => {
          const phrase = `DELETE ${option.scope.toUpperCase()}`;
          const isConfirming = confirming === option.scope;
          return (
            <article key={option.scope} className={`dataCard ${option.danger}`}>
              <div className="dataCardTop">
                <span className="dataIcon" aria-hidden="true">{option.icon}</span>
                <div>
                  <span className="dataDanger">{option.danger}</span>
                  <h3>{option.label}</h3>
                  <p>{option.description}</p>
                </div>
              </div>

              {!isConfirming ? (
                <button className="dataStart" type="button" onClick={() => { setConfirming(option.scope); setConfirmText(""); setResult(null); }}>
                  Start confirmation
                </button>
              ) : (
                <div className="dataConfirm">
                  <label htmlFor={`confirm-${option.scope}`}>Type <code>{phrase}</code> to continue</label>
                  <input id={`confirm-${option.scope}`} value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={phrase} autoComplete="off" />
                  <div>
                    <button type="button" onClick={() => { setConfirming(null); setConfirmText(""); }}>Cancel</button>
                    <button type="button" className="execute" onClick={() => handleClear(option.scope)} disabled={confirmText !== phrase || loading}>
                      {loading ? "Processing…" : "Confirm & execute"}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
