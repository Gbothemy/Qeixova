"use client";
import { useEffect, useState } from "react";

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_default: boolean;
}

const NIGERIAN_BANKS = [
  "Access Bank", "Citibank", "Ecobank", "Fidelity Bank", "First Bank",
  "First City Monument Bank (FCMB)", "Globus Bank", "Guaranty Trust Bank (GTBank)",
  "Heritage Bank", "Keystone Bank", "Kuda Bank", "Moniepoint",
  "Opay", "Palmpay", "Polaris Bank", "Providus Bank", "Stanbic IBTC Bank",
  "Standard Chartered Bank", "Sterling Bank", "SunTrust Bank", "Titan Trust Bank",
  "Union Bank", "United Bank for Africa (UBA)", "Unity Bank",
  "VFD Microfinance Bank", "Wema Bank", "Zenith Bank",
];

interface Props {
  onClose: () => void;
}

export default function BankAccountsModal({ onClose }: Props) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [view, setView] = useState<"list" | "add">("list");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({ bankName: "", accountNumber: "", accountName: "" });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const fetchAccounts = () => {
    setLoading(true);
    fetch("/api/bank-accounts")
      .then((r) => r.json())
      .then((d) => { if (d.accounts) setAccounts(d.accounts); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { void Promise.resolve().then(fetchAccounts); }, []);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.bankName || !form.accountNumber || !form.accountName) {
      setError("All fields are required."); return;
    }
    if (!/^\d{10}$/.test(form.accountNumber)) {
      setError("Account number must be exactly 10 digits."); return;
    }
    setSubmitting(true);
    const res = await fetch("/api/bank-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setSuccess("Account added successfully!");
      setForm({ bankName: "", accountNumber: "", accountName: "" });
      fetchAccounts();
      setTimeout(() => { setSuccess(""); setView("list"); }, 1200);
    } else {
      setError(data.error || "Failed to add account.");
    }
  };

  const handleDelete = async (id: number) => {
    await fetch("/api/bank-accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchAccounts();
  };

  const handleSetDefault = async (id: number) => {
    await fetch("/api/bank-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchAccounts();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card-bg)", borderRadius: "24px 24px 0 0",
          width: "100%", maxWidth: 480, maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
          animation: "slideUp 0.25s ease",
          border: "1px solid var(--border)",
        }}
      >
        <style>{`@keyframes slideUp { from { transform:translateY(100%); opacity:0 } to { transform:translateY(0); opacity:1 } }`}</style>

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--muted)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {view === "add" && (
              <button onClick={() => { setView("list"); setError(""); }}
                style={{ background: "var(--card-bg)", border: "none", borderRadius: 10, width: 34, height: 34, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)" }}>
                ←
              </button>
            )}
            <div>
              <h2 style={{ fontWeight: 800, fontSize: 18, color: "var(--text)" }}>
                {view === "list" ? "Bank Accounts" : "Add Bank Account"}
              </h2>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {view === "list" ? "Manage your withdrawal accounts" : "Enter your account details"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "var(--card-bg)", border: "none", borderRadius: 10, width: 34, height: 34, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)" }}>
            ✕
          </button>
        </div>

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <div style={{ padding: "20px 24px 36px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>🏦</p>
                <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading accounts...</p>
              </div>
            ) : accounts.length === 0 ? (
              <div style={{
                background: "var(--card-bg)", border: "2px dashed rgba(0,0,0,0.12)",
                borderRadius: 16, padding: "36px 24px", textAlign: "center", marginBottom: 20,
              }}>
                <p style={{ fontSize: 36, marginBottom: 10 }}>🏦</p>
                <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 6 }}>No accounts yet</p>
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Add a bank account to enable withdrawals</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {accounts.map((acc) => (
                  <div key={acc.id} style={{
                    background: acc.is_default ? "rgba(26,239,34,0.08)" : "var(--card-bg)",
                    border: `1.5px solid ${acc.is_default ? "rgba(26,239,34,0.3)" : "var(--muted)"}`,
                    borderRadius: 16, padding: "16px 18px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                    background: acc.is_default ? "linear-gradient(135deg, var(--accent), var(--accent))" : "var(--muted)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 20, flexShrink: 0,
                        }}>
                          🏦
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{acc.bank_name}</p>
                          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2, letterSpacing: 1 }}>
                            {acc.account_number.replace(/(\d{3})(\d{4})(\d{3})/, "$1 $2 $3")}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{acc.account_name}</p>
                        </div>
                      </div>
                      {acc.is_default && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: "var(--accent)",
                          background: "var(--card-bg)", borderRadius: 6, padding: "3px 8px",
                          border: "1px solid rgba(179,245,182,0.24)",
                        }}>
                          DEFAULT
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      {!acc.is_default && (
                        <button
                          onClick={() => handleSetDefault(acc.id)}
                        style={{
                            flex: 1, padding: "8px", borderRadius: 10,
                            background: "var(--card-bg)", border: "1.5px solid var(--border)",
                            fontSize: 12, fontWeight: 600, color: "var(--accent)", cursor: "pointer",
                          }}
                        >
                          Set as Default
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(acc.id)}
                        style={{
                          padding: "8px 16px", borderRadius: 10,
                          background: "rgba(229,62,62,0.06)", border: "1.5px solid rgba(229,62,62,0.12)",
                          fontSize: 12, fontWeight: 600, color: "var(--danger)", cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => { setView("add"); setError(""); setSuccess(""); }}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, var(--accent), var(--accent))",
                color: "var(--button-text, #fff)", border: "none", borderRadius: 14, padding: "15px",
                fontWeight: 800, fontSize: 15, cursor: "pointer",
                boxShadow: "0 6px 20px rgba(26,239,34,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              + Add New Account
            </button>
          </div>
        )}

        {/* ── ADD VIEW ── */}
        {view === "add" && (
          <div style={{ padding: "20px 24px 36px" }}>
            {error && (
              <div style={{ background: "rgba(229,62,62,0.1)", border: "1px solid rgba(229,62,62,0.3)", borderRadius: 10, padding: "11px 14px", marginBottom: 16, fontSize: 13, color: "#e53e3e" }}>
                ⚠️ {error}
              </div>
            )}
            {success && (
              <div style={{ background: "rgba(26,239,34,0.1)", border: "1px solid rgba(26,239,34,0.3)", borderRadius: 10, padding: "11px 14px", marginBottom: 16, fontSize: 13, color: "#1AEF22", fontWeight: 600 }}>
                ✅ {success}
              </div>
            )}

            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Bank name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#bbbbbb", letterSpacing: 0.5 }}>BANK NAME</label>
                <div style={{ position: "relative", marginTop: 8 }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🏦</span>
                  <select
                    value={form.bankName}
                    onChange={(e) => set("bankName", e.target.value)}
                    style={{
                      width: "100%", padding: "13px 14px 13px 42px",
                      borderRadius: 12, border: "1.5px solid #333333",
                      fontSize: 14, outline: "none", color: form.bankName ? "#F5F5F5" : "#bbbbbb",
                      background: "#1a1a1a", cursor: "pointer",
                      appearance: "none",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#1AEF22")}
                    onBlur={(e) => (e.target.style.borderColor = "#999999")}
                  >
                    <option value="">Select your bank</option>
                    {NIGERIAN_BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Account number */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#bbbbbb", letterSpacing: 0.5 }}>ACCOUNT NUMBER</label>
                <div style={{ position: "relative", marginTop: 8 }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔢</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit account number"
                    value={form.accountNumber}
                    onChange={(e) => set("accountNumber", e.target.value.replace(/\D/g, ""))}
                    style={{
                      width: "100%", padding: "13px 14px 13px 42px",
                      borderRadius: 12, border: "1.5px solid #333333",
                      fontSize: 15, outline: "none", color: "#F5F5F5",
                      background: "#1a1a1a", letterSpacing: 2,
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#1AEF22")}
                    onBlur={(e) => (e.target.style.borderColor = "#999999")}
                  />
                  {form.accountNumber.length === 10 && (
                    <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>✅</span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "#bbbbbb", marginTop: 4 }}>
                  {form.accountNumber.length}/10 digits
                </p>
              </div>

              {/* Account name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#bbbbbb", letterSpacing: 0.5 }}>ACCOUNT NAME</label>
                <div style={{ position: "relative", marginTop: 8 }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>👤</span>
                  <input
                    type="text"
                    placeholder="Name on the account"
                    value={form.accountName}
                    onChange={(e) => set("accountName", e.target.value)}
                    style={{
                      width: "100%", padding: "13px 14px 13px 42px",
                      borderRadius: 12, border: "1.5px solid #333333",
                      fontSize: 14, outline: "none", color: "#F5F5F5",
                      background: "#1a1a1a",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#1AEF22")}
                    onBlur={(e) => (e.target.style.borderColor = "#999999")}
                  />
                </div>
              </div>

              {/* Info note */}
              <div style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
                <p style={{ fontSize: 12, color: "#cccccc", lineHeight: 1.6 }}>
                  Make sure the account name matches your bank records exactly. Withdrawals to incorrect accounts cannot be reversed.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: submitting ? "#999999" : "linear-gradient(135deg, #F5A623, #d89420)",
                  color: "#fff", border: "none", borderRadius: 14, padding: "15px",
                  fontWeight: 800, fontSize: 15,
                  cursor: submitting ? "not-allowed" : "pointer",
                  boxShadow: submitting ? "none" : "0 6px 20px rgba(245,166,35,0.35)",
                  marginTop: 4,
                }}
              >
                {submitting ? "Saving..." : "Save Account →"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
