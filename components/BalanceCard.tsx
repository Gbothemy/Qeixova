import { formatNairaFromQlt } from "@/lib/currency";

interface BalanceCardProps {
  balance: number;
  todayEarned: number;
  tasksToday: number;
  totalAccumulated: number;
  totalWithdrawn: number;
  tasksTotal: number;
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? (n / 1_000_000).toFixed(1) + "M"
    : n >= 1_000
    ? (n / 1_000).toFixed(0) + "k"
    : String(n);

export default function BalanceCard({
  balance,
  todayEarned,
  tasksToday,
  totalAccumulated,
  totalWithdrawn,
  tasksTotal,
}: BalanceCardProps) {
  return (
    <div className="card" style={{
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: 24, padding: "24px 20px 20px", color: "var(--text)",
      margin: "0 16px", position: "relative", overflow: "hidden",
      boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
    }}>
      {/* Gold top bar */}
      <div style={{ position: "absolute", top: 0, left: 24, right: 24, height: 3, background: "linear-gradient(90deg, var(--accent-2), #ffc04d, var(--accent-2))", borderRadius: "0 0 4px 4px" }} />
      <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(245,166,35,0.03)" }} />
      <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(26,239,34,0.02)" }} />

      {/* Balance row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <p style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
            Available Balance
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 14, color: "var(--accent-2)" }}>⭐</span>
            <p style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1 }}>
              {balance.toLocaleString()}
            </p>
            <span style={{ fontSize: 12, color: "var(--muted-2)" }}>QLT</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.15)", borderRadius: 8, padding: "4px 10px", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>≈</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-2)" }}>₦{formatNairaFromQlt(balance, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
          </div>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(245,166,35,0.1)", border: "1.5px solid rgba(245,166,35,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
          💳
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />

      {/* Stats grid — 2x2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 0" }}>

        <div style={{ borderRight: "1px solid var(--border)", paddingRight: 12 }}>
          <p style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3, letterSpacing: 0.4 }}>Today&apos;s QLT</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-2)" }}>
            +{todayEarned.toLocaleString()}
          </p>
        </div>

        <div style={{ paddingLeft: 12 }}>
          <p style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3, letterSpacing: 0.4 }}>Tasks Today</p>
          <p style={{ fontSize: 16, fontWeight: 700 }}>
            {tasksToday} <span style={{ fontSize: 11, color: "var(--muted-2)" }}>done</span>
          </p>
        </div>

        <div style={{ borderRight: "1px solid var(--border)", paddingRight: 12, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3, letterSpacing: 0.4 }}>Total Accumulated</p>
          <p style={{ fontSize: 16, fontWeight: 700 }}>
            {fmt(totalAccumulated)} <span style={{ fontSize: 11, color: "var(--muted-2)" }}>QLT</span>
          </p>
        </div>

        <div style={{ paddingLeft: 12, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3, letterSpacing: 0.4 }}>Total Withdrawn</p>
          <p style={{ fontSize: 16, fontWeight: 700 }}>
            {fmt(totalWithdrawn)} <span style={{ fontSize: 11, color: "var(--muted-2)" }}>QLT</span>
          </p>
        </div>

      </div>

      {/* Total tasks footer */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 11, color: "var(--muted)" }}>Total tasks completed</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-2)" }}>{tasksTotal.toLocaleString()} tasks</p>
      </div>
    </div>
  );
}
