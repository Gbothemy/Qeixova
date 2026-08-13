import { getAdminSession } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import DataManagement from "../DataManagement";

async function getStats() {
  const [
    users, newUsersToday,
    completionsTotal, completionsToday, pendingCompletions,
    qltAwarded, qltToday,
    withdrawalsPending, withdrawalsProcessing, withdrawalsTotal,
    activeTasks,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM users`,
    sql`SELECT COUNT(*)::int AS count FROM users WHERE DATE(created_at) = CURRENT_DATE`,
    sql`SELECT COUNT(*)::int AS count FROM completions`,
    sql`SELECT COUNT(*)::int AS count FROM completions WHERE DATE(completed_at) = CURRENT_DATE`,
    sql`SELECT COUNT(*)::int AS count FROM completions WHERE status = 'pending'`,
    sql`SELECT COALESCE(SUM(amount),0)::bigint AS total FROM transactions WHERE type='credit' AND label LIKE 'Task%'`,
    sql`SELECT COALESCE(SUM(t.reward),0)::bigint AS total FROM completions c JOIN tasks t ON t.id = c.task_id WHERE c.status = 'approved' AND DATE(c.completed_at) = CURRENT_DATE`,
    sql`SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0)::bigint AS total FROM transactions WHERE type='debit' AND status='pending'`,
    sql`SELECT COUNT(*)::int AS count FROM transactions WHERE type='debit' AND status='processing'`,
    sql`SELECT COALESCE(SUM(amount),0)::bigint AS total FROM transactions WHERE type='debit' AND status='completed'`,
    sql`SELECT COUNT(*)::int AS count FROM tasks WHERE is_active=true`,
  ]);

  return {
    totalUsers: users[0].count,
    newUsersToday: newUsersToday[0].count,
    completionsTotal: completionsTotal[0].count,
    completionsToday: completionsToday[0].count,
    pendingCompletions: pendingCompletions[0].count,
    qltAwarded: Number(qltAwarded[0].total),
    qltToday: Number(qltToday[0].total),
    withdrawalsPending: withdrawalsPending[0].count,
    withdrawalsPendingAmount: Number(withdrawalsPending[0].total),
    withdrawalsProcessing: withdrawalsProcessing[0].count,
    withdrawalsTotal: Number(withdrawalsTotal[0].total),
    activeTasks: activeTasks[0].count,
  };
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return n.toLocaleString();
}

function StatCard({ label, value, sub, color, alert }: { label: string; value: string; sub?: string; color: string; alert?: boolean }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "22px 24px",
      borderLeft: `4px solid ${color}`,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      position: "relative",
    }}>
      {alert && (
        <div style={{ position: "absolute", top: 14, right: 14, width: 10, height: 10, borderRadius: "50%", background: "#e67e22", boxShadow: "0 0 6px rgba(230,126,34,0.6)" }} />
      )}
      <p style={{ fontSize: 12, color: "#ccc", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color: "#1A1A1A", letterSpacing: -0.5 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

export default async function AdminDashboard() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) redirect("/admin-login");

  const s = await getStats();

  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700, color: "#1A1A1A" }}>Dashboard</h1>
      <p style={{ margin: "0 0 28px", color: "#ccc", fontSize: 14 }}>Platform overview — live data</p>

      {/* Alert bar */}
      {(s.pendingCompletions > 0 || s.withdrawalsPending > 0) && (
        <div style={{ background: "#fff8e1", border: "1px solid #f5a623", borderRadius: 12, padding: "12px 18px", marginBottom: 24, display: "flex", gap: 20, flexWrap: "wrap" }}>
          {s.pendingCompletions > 0 && (
            <span style={{ fontSize: 13, color: "#e67e22", fontWeight: 600 }}>
              {s.pendingCompletions} task submission{s.pendingCompletions !== 1 ? "s" : ""} awaiting review
            </span>
          )}
          {s.withdrawalsPending > 0 && (
            <span style={{ fontSize: 13, color: "#e67e22", fontWeight: 600 }}>
              {s.withdrawalsPending} withdrawal{s.withdrawalsPending !== 1 ? "s" : ""} pending (₦{(s.withdrawalsPendingAmount / 100).toLocaleString()})
            </span>
          )}
        </div>
      )}

      {/* Users */}
      <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Users</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Users" value={s.totalUsers.toLocaleString()} sub={`+${s.newUsersToday} today`} color="#1AEF22" />
        <StatCard label="Active Tasks" value={s.activeTasks.toLocaleString()} color="#1AEF22" />
      </div>

      {/* Tasks */}
      <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Tasks</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Completions" value={s.completionsTotal.toLocaleString()} sub={`${s.completionsToday} today`} color="#4a9eff" />
        <StatCard label="Pending Review" value={s.pendingCompletions.toLocaleString()} color="#e67e22" alert={s.pendingCompletions > 0} />
        <StatCard label="QLT Awarded" value={fmt(s.qltAwarded) + " QLT"} sub={`${fmt(s.qltToday)} QLT today`} color="#F5A623" />
      </div>

      {/* Withdrawals */}
      <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Withdrawals</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="Pending" value={s.withdrawalsPending.toLocaleString()} sub={`₦${(s.withdrawalsPendingAmount / 100).toLocaleString()}`} color="#e67e22" alert={s.withdrawalsPending > 0} />
        <StatCard label="Processing" value={s.withdrawalsProcessing.toLocaleString()} color="#4a9eff" />
        <StatCard label="Total Paid Out" value={"₦" + (s.withdrawalsTotal / 100).toLocaleString()} color="#1AEF22" />
      </div>

      <DataManagement />
    </div>
  );
}
