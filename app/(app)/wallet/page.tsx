"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import ContributorLoading from "@/components/ContributorLoading";
import { useAuth } from "@/lib/useAuth";
import { WITHDRAWAL_UNLOCK_QLT } from "@/lib/rewardRules";

interface Tx { type: string; label: string; amount: number; status: string; created_at: string; }

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  if (h < 48) return "Yesterday";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

const TX_ICONS: Record<string, string> = { "Task:": "✅", "Withdrawal": "💸", "Referral": "👥", "default": "💰" };
function _txIcon(label: string) {
  for (const key of Object.keys(TX_ICONS)) { if (label.startsWith(key)) return TX_ICONS[key]; }
  return TX_ICONS.default;
}

export default function WalletPage() {
  const { user, loading } = useAuth();
  const [balance, setBalance] = useState(0);
  const [missionEarnedQlt, setMissionEarnedQlt] = useState(0);
  const [bonusEarnedQlt, setBonusEarnedQlt] = useState(0);
  const [pendingQlt, setPendingQlt] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [rejected, setRejected] = useState<{ title: string; rejection_reason: string; completed_at: string }[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [bankAccounts, setBankAccounts] = useState<{ id: number; bank_name: string; account_number: string; account_name: string }[]>([]);

  const fetchWallet = async () => {
    try {
      const r = await fetch("/api/wallet"); if (!r.ok) return;
      const d = await r.json();
      if (d.balance !== undefined) setBalance(d.balance);
      if (d.mission_earned_qlt !== undefined) setMissionEarnedQlt(Number(d.mission_earned_qlt));
      if (d.bonus_earned_qlt !== undefined) setBonusEarnedQlt(Number(d.bonus_earned_qlt));
      if (d.transactions) setTransactions(d.transactions);
      if (d.pending_qlt !== undefined) setPendingQlt(d.pending_qlt);
      if (d.pending_count !== undefined) setPendingCount(d.pending_count);
      if (d.rejected) setRejected(d.rejected);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchWallet();
    fetch("/api/bank-accounts").then(r => r.ok ? r.json() : null).then(d => { if (d?.accounts) setBankAccounts(d.accounts); }).catch(() => {});
    window.addEventListener("balanceUpdated", fetchWallet);
    return () => window.removeEventListener("balanceUpdated", fetchWallet);
  }, []);

  const handleWithdraw = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.canWithdraw) {
      setMsg({
        type: "error",
        text: `Withdrawals are locked. Earn ${Math.max(0, WITHDRAWAL_UNLOCK_QLT - Number(user?.total_earned_qlt ?? 0)).toLocaleString()} more approved mission QLT. Bonuses do not count.`,
      });
      return;
    }
    setSubmitting(true); setMsg(null);
    const res = await fetch("/api/wallet/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(amount), bank }) });
    const data = await res.json();
    if (res.ok) {
      setMsg({ type: "success", text: "Withdrawal request submitted! Processing within 24 hours." });
      setBalance(data.newBalance); setAmount(""); setBank(""); fetchWallet();
    } else { setMsg({ type: "error", text: data.error || "Something went wrong" }); }
    setSubmitting(false);
  };

  if (loading) return <ContributorLoading label="Loading wallet" detail="Preparing your balance, earnings, and withdrawals." />;

  const withdrawalUnlocked = Boolean(user?.canWithdraw);
  const missionQltNeeded = Math.max(0, WITHDRAWAL_UNLOCK_QLT - Number(user?.total_earned_qlt ?? 0));

  return (
    <div className="page-body" style={{ background: "#000000", minHeight: "100vh" }}>
      {/* Header */}
      <div className="page-header" style={{ background: "#0a0a0a", borderBottom: "1px solid #222222", padding: "52px 20px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: "rgba(26,239,34,0.03)" }} />
        <p style={{ color: "#bbbbbb", fontSize: 13, marginBottom: 4 }}>Points Balance</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <Image src="/icon-wallet.svg" alt="wallet" width={24} height={24} style={{ objectFit: "contain", marginBottom: -4 }} />
          <p style={{ color: "#F5F5F5", fontSize: 38, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>{balance.toLocaleString()}</p>
          <span style={{ color: "#bbbbbb", fontSize: 14 }}>QLT</span>
        </div>
        <p style={{ color: "#cccccc", fontSize: 14, fontWeight: 600, marginTop: 6 }}>≈ ₦{(balance / 100).toLocaleString()} cash value</p>
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ color: "#1AEF22", fontSize: 12, fontWeight: 700 }}>{missionEarnedQlt.toLocaleString()} mission QLT</span>
          <span style={{ color: "#F5A623", fontSize: 12, fontWeight: 700 }}>{bonusEarnedQlt.toLocaleString()} bonus QLT</span>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          {[{ label: "Min. Withdrawal", value: "100,000 QLT" }, { label: "Rate", value: "100 QLT = ₦1" }, { label: "Fee", value: "Free" }].map(item => (
            <div key={item.label} style={{ flex: 1, background: "#111111", border: "1px solid #222222", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
              <p style={{ color: "#bbbbbb", fontSize: 10, marginBottom: 3 }}>{item.label}</p>
              <p style={{ color: "#F5F5F5", fontWeight: 700, fontSize: 13 }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="wallet-layout" style={{ display: "block" }}>
        {/* Pending QLT Banner */}
        {pendingQlt > 0 && (
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 16, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 12, color: "#F5A623", fontWeight: 700, marginBottom: 2 }}>Pending QLT</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: "#F5A623" }}>+{pendingQlt.toLocaleString()} QLT</p>
                <p style={{ fontSize: 11, color: "#999999", marginTop: 2 }}>{pendingCount} submission{pendingCount !== 1 ? "s" : ""} under review</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ background: "rgba(245,166,35,0.15)", borderRadius: 10, padding: "6px 12px" }}>
                  <p style={{ fontSize: 11, color: "#F5A623", fontWeight: 600 }}>Under Review</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rejected Tasks */}
        {rejected.length > 0 && (
          <div style={{ padding: "16px 16px 0" }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "#F5F5F5", marginBottom: 10 }}>Rejected Submissions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rejected.map((r, i) => (
                <div key={i} style={{ background: "rgba(229,62,62,0.06)", border: "1px solid rgba(229,62,62,0.2)", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#F5F5F5", marginBottom: 4 }}>{r.title}</p>
                  <p style={{ fontSize: 12, color: "#e53e3e" }}>Reason: {r.rejection_reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Withdraw form */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ background: "#111111", borderRadius: 20, padding: "22px 20px", border: "1px solid #222222" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1a1a1a", border: "1px solid #222222", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Image src="/icon-wallet.svg" alt="withdraw" width={20} height={20} style={{ objectFit: "contain" }} />
              </div>
              <p style={{ fontWeight: 800, fontSize: 16, color: "#F5F5F5" }}>Withdraw Funds</p>
            </div>

            {!withdrawalUnlocked && (
              <div style={{ background: "rgba(229,62,62,0.1)", border: "1px solid rgba(229,62,62,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                <div>
                  <p style={{ color: "#e87373", fontSize: 13, fontWeight: 800 }}>Withdrawals are locked</p>
                  <p style={{ color: "#cccccc", fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>
                    Earn {missionQltNeeded.toLocaleString()} more approved mission QLT to reach 50,001 QLT. Bonus QLT does not count.
                  </p>
                </div>
              </div>
            )}

            {withdrawalUnlocked && msg && (
              <div style={{ background: msg.type === "success" ? "rgba(26,239,34,0.1)" : "rgba(229,62,62,0.1)", border: `1px solid ${msg.type === "success" ? "rgba(26,239,34,0.3)" : "rgba(229,62,62,0.3)"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{msg.type === "success" ? "✅" : "⚠️"}</span>
                <p style={{ color: msg.type === "success" ? "#1AEF22" : "#e53e3e", fontSize: 13, fontWeight: 600 }}>{msg.text}</p>
              </div>
            )}

            <form onSubmit={handleWithdraw} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#bbbbbb", fontWeight: 700, letterSpacing: 0.5 }}>QLT POINTS TO CONVERT</label>
                <div style={{ position: "relative", marginTop: 8 }}>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={withdrawalUnlocked ? "Min. 100,000 QLT" : "Locked until 50,001 mission QLT"}
                    disabled={!withdrawalUnlocked}
                    style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #333333", fontSize: 16, outline: "none", color: "#F5F5F5", background: "#1a1a1a", opacity: withdrawalUnlocked ? 1 : 0.55, cursor: withdrawalUnlocked ? "text" : "not-allowed" }}
                    onFocus={e => (e.target.style.borderColor = "#1AEF22")}
                    onBlur={e => (e.target.style.borderColor = "#999999")}
                  />
                </div>
                {Number(amount) > 0 && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, background: "rgba(26,239,34,0.1)", borderRadius: 8, padding: "7px 12px" }}>
                    <span style={{ fontSize: 14 }}>⭐</span>
                    <span style={{ fontSize: 13, color: "#1AEF22", fontWeight: 600 }}>{Number(amount).toLocaleString()} QLT</span>
                    <span style={{ color: "#aaaaaa" }}>→</span>
                    <span style={{ fontSize: 13, color: "#1AEF22", fontWeight: 700 }}>₦{(Number(amount) / 100).toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#bbbbbb", fontWeight: 700, letterSpacing: 0.5 }}>BANK ACCOUNT</label>
                <select value={bank} onChange={e => setBank(e.target.value)} disabled={!withdrawalUnlocked}
                  style={{ width: "100%", marginTop: 8, padding: "14px 16px", borderRadius: 12, border: "1.5px solid #333333", fontSize: 14, outline: "none", color: "#F5F5F5", background: "#1a1a1a", cursor: withdrawalUnlocked ? "pointer" : "not-allowed", opacity: withdrawalUnlocked ? 1 : 0.55 }}>
                  <option value="">Select bank account</option>
                  {bankAccounts.length > 0 ? (
                    bankAccounts.map(acc => (
                      <option key={acc.id} value={`${acc.bank_name} — ${acc.account_number}`}>
                        {acc.bank_name} — {acc.account_number.replace(/(\d{3})(\d{4})(\d{3})/, "$1 $2 $3")} ({acc.account_name})
                      </option>
                    ))
                  ) : (
                    <option disabled>No accounts saved — add one in Profile</option>
                  )}
                </select>
              </div>
              <button type="submit" disabled={submitting || !withdrawalUnlocked} style={{
                background: submitting || !withdrawalUnlocked ? "#555555" : "linear-gradient(135deg, #F5A623, #d89420)",
                color: "#000", border: "none", borderRadius: 14, padding: "16px",
                fontWeight: 800, fontSize: 15, cursor: submitting || !withdrawalUnlocked ? "not-allowed" : "pointer",
                boxShadow: submitting || !withdrawalUnlocked ? "none" : "0 6px 20px rgba(245,166,35,0.35)", marginTop: 4,
              }}>
                {submitting ? "Processing..." : withdrawalUnlocked ? "Convert & Withdraw →" : "Withdrawals Locked"}
              </button>
            </form>
          </div>
        </div>

        {/* Transactions */}
        <div style={{ padding: "24px 16px 0" }}>
          <p style={{ fontWeight: 800, fontSize: 17, color: "#F5F5F5", marginBottom: 14 }}>Transaction History</p>
          {transactions.length === 0 ? (
            <div style={{ background: "#111111", borderRadius: 16, padding: "32px", textAlign: "center", border: "1px solid #222222" }}>
              <p style={{ fontSize: 32 }}>📊</p>
              <p style={{ color: "#bbbbbb", marginTop: 8, fontSize: 14 }}>No transactions yet</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {transactions.map((tx, i) => (
                <div key={i} style={{ background: "#111111", borderRadius: 16, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #222222" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 13, background: tx.type === "credit" ? "rgba(26,239,34,0.12)" : "rgba(229,62,62,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Image src={tx.label.startsWith("Withdrawal") ? "/icon-wallet.svg" : "/icon-task.svg"} alt="tx" width={22} height={22} style={{ objectFit: "contain" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#F5F5F5" }}>{tx.label}</p>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                        <p style={{ fontSize: 11, color: "#bbbbbb" }}>{timeAgo(tx.created_at)}</p>
                        {tx.status === "pending" && (
                          <span style={{ fontSize: 10, background: "rgba(245,166,35,0.12)", color: "#F5A623", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>Pending</span>
                        )}
                        {tx.status === "processing" && (
                          <span style={{ fontSize: 10, background: "rgba(26,115,232,0.12)", color: "#4a9eff", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>Processing</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ background: tx.type === "credit" ? "rgba(26,239,34,0.12)" : "rgba(229,62,62,0.12)", borderRadius: 10, padding: "5px 12px" }}>
                    <p style={{ fontWeight: 800, fontSize: 13, color: tx.type === "credit" ? "#1AEF22" : "#e53e3e" }}>
                      {tx.type === "credit" ? "+" : "-"}{tx.amount.toLocaleString()} QLT
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

function _LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000000" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
        <p style={{ color: "#1AEF22", fontWeight: 700 }}>Loading wallet...</p>
      </div>
    </div>
  );
}
