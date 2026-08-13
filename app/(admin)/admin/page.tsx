import Link from "next/link";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import DataManagement from "../DataManagement";
import { getAdminSession } from "@/lib/adminAuth";
import { formatNairaFromQlt } from "@/lib/currency";
import { sql } from "@/lib/db";

type RecentAdminUser = { full_name: string | null; email: string; created_at: string | Date };

const emptyStats = {
  totalUsers: 0, newUsersToday: 0, completionsTotal: 0, completionsToday: 0,
  pendingCompletions: 0, approvedCompletions: 0, rejectedCompletions: 0,
  qltAwarded: 0, qltToday: 0, withdrawalsPending: 0,
  withdrawalsPendingAmount: 0, withdrawalsProcessing: 0, withdrawalsTotal: 0,
  activeTasks: 0, pendingCampaigns: 0, liveCampaigns: 0,
  recentUsers: [] as RecentAdminUser[],
};

async function getStats() {
  const [users, newUsersToday, completionsTotal, completionsToday, pendingCompletions,
    approvedCompletions, rejectedCompletions, qltAwarded, qltToday, withdrawalsPending,
    withdrawalsProcessing, withdrawalsTotal, activeTasks, pendingCampaigns, liveCampaigns,
    recentUsers] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM users`,
    sql`SELECT COUNT(*)::int AS count FROM users WHERE DATE(created_at) = CURRENT_DATE`,
    sql`SELECT COUNT(*)::int AS count FROM completions`,
    sql`SELECT COUNT(*)::int AS count FROM completions WHERE DATE(completed_at) = CURRENT_DATE`,
    sql`SELECT COUNT(*)::int AS count FROM completions WHERE status = 'pending'`,
    sql`SELECT COUNT(*)::int AS count FROM completions WHERE status = 'approved'`,
    sql`SELECT COUNT(*)::int AS count FROM completions WHERE status = 'rejected'`,
    sql`SELECT COALESCE(SUM(amount),0)::bigint AS total FROM transactions WHERE type='credit' AND label LIKE 'Task%'`,
    sql`SELECT COALESCE(SUM(t.reward),0)::bigint AS total FROM completions c JOIN tasks t ON t.id = c.task_id WHERE c.status = 'approved' AND DATE(c.completed_at) = CURRENT_DATE`,
    sql`SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0)::bigint AS total FROM transactions WHERE type='debit' AND status='pending'`,
    sql`SELECT COUNT(*)::int AS count FROM transactions WHERE type='debit' AND status='processing'`,
    sql`SELECT COALESCE(SUM(amount),0)::bigint AS total FROM transactions WHERE type='debit' AND status='completed'`,
    sql`SELECT COUNT(*)::int AS count FROM tasks WHERE is_active=true`,
    sql`SELECT COUNT(*)::int AS count FROM tasks WHERE business_id IS NOT NULL AND COALESCE(campaign_status, task_status, '') = 'pending_review'`,
    sql`SELECT COUNT(*)::int AS count FROM tasks WHERE business_id IS NOT NULL AND COALESCE(campaign_status, task_status, '') IN ('live','approved')`,
    sql`SELECT full_name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5`,
  ]);

  return {
    totalUsers: users[0].count, newUsersToday: newUsersToday[0].count,
    completionsTotal: completionsTotal[0].count, completionsToday: completionsToday[0].count,
    pendingCompletions: pendingCompletions[0].count, approvedCompletions: approvedCompletions[0].count,
    rejectedCompletions: rejectedCompletions[0].count, qltAwarded: Number(qltAwarded[0].total),
    qltToday: Number(qltToday[0].total), withdrawalsPending: withdrawalsPending[0].count,
    withdrawalsPendingAmount: Number(withdrawalsPending[0].total),
    withdrawalsProcessing: withdrawalsProcessing[0].count,
    withdrawalsTotal: Number(withdrawalsTotal[0].total), activeTasks: activeTasks[0].count,
    pendingCampaigns: pendingCampaigns[0].count, liveCampaigns: liveCampaigns[0].count,
    recentUsers: recentUsers as RecentAdminUser[],
  };
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString();
}

function currencyFromQlt(amount: number) { return `₦${formatNairaFromQlt(amount)}`; }
function percent(value: number, total: number) { return total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100)); }
function timeLabel(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

function KpiCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <article className="opsKpi" style={{ "--tone": tone } as CSSProperties}><span>{label}</span><strong>{value}</strong><p>{detail}</p></article>;
}

function QueueRow({ label, detail, value, href, tone }: { label: string; detail: string; value: string; href: string; tone: string }) {
  return <Link className="opsQueueRow" href={href} style={{ "--tone": tone } as CSSProperties}><span aria-hidden="true" /><div><strong>{label}</strong><small>{detail}</small></div><b>{value}</b></Link>;
}

export default async function AdminDashboard() {
  if (!await getAdminSession()) redirect("/admin-login");

  let databaseAvailable = true;
  let s = emptyStats;
  try { s = await getStats(); }
  catch (error) {
    databaseAvailable = false;
    if (process.env.NODE_ENV === "production") console.error("[admin/dashboard] failed to load statistics", error);
  }

  const pendingActions = s.pendingCompletions + s.withdrawalsPending + s.pendingCampaigns;
  const totalCampaigns = s.liveCampaigns + s.pendingCampaigns;
  const approvalRate = percent(s.approvedCompletions, s.completionsTotal);
  const rejectionRate = percent(s.rejectedCompletions, s.completionsTotal);
  const reviewRate = percent(s.pendingCompletions, s.completionsTotal);
  const payoutOpen = s.withdrawalsPending + s.withdrawalsProcessing;

  return <div className="opsDashboard">
    {!databaseAvailable && <div className="opsDatabaseAlert" role="alert">Live statistics are temporarily unavailable. Check the database connection and refresh this page.</div>}
    <header className="opsHeader"><div><span className="opsEyebrow">Admin Operations</span><h1>Control Center</h1><p>Monitor queues, contributor activity, campaign reviews, rewards, and payout movement from one focused dashboard.</p></div><div className={pendingActions > 0 ? "opsPriority active" : "opsPriority"}><span>Priority Queue</span><strong>{pendingActions.toLocaleString()}</strong><p>{pendingActions > 0 ? "Items require admin decision" : "No critical queue pressure"}</p></div></header>

    <section className="opsKpiGrid" aria-label="Admin overview">
      <KpiCard label="Contributors" value={s.totalUsers.toLocaleString()} detail={`+${s.newUsersToday} today`} tone="#1AEF22" />
      <KpiCard label="Active Missions" value={s.activeTasks.toLocaleString()} detail="Visible to contributors" tone="#F5A623" />
      <KpiCard label="Submissions" value={s.completionsTotal.toLocaleString()} detail={`${s.completionsToday} submitted today`} tone="#3B82F6" />
      <KpiCard label="QLT Awarded" value={`${fmt(s.qltAwarded)} QLT`} detail={`${fmt(s.qltToday)} QLT today`} tone="#22C55E" />
      <KpiCard label="Open Payouts" value={payoutOpen.toLocaleString()} detail={currencyFromQlt(s.withdrawalsPendingAmount)} tone="#EF4444" />
      <KpiCard label="Paid Out" value={currencyFromQlt(s.withdrawalsTotal)} detail="Completed withdrawals" tone="#0EA5E9" />
    </section>

    <section className="opsLayout">
      <article className="opsPanel opsPanelLarge"><div className="opsPanelHeader"><div><h2>Decision Queues</h2><p>Fast access to review surfaces that control platform quality and cash movement.</p></div></div><div className="opsQueueList">
        <QueueRow label="Mission Proof Review" detail="Approve or reject contributor submissions" value={s.pendingCompletions.toLocaleString()} href="/admin/completions" tone="#F97316" />
        <QueueRow label="Business Campaign Review" detail="Check content, targeting, budget, and launch readiness" value={s.pendingCampaigns.toLocaleString()} href="/admin/tasks" tone="#F5A623" />
        <QueueRow label="Withdrawal Operations" detail="Verify and process contributor payout requests" value={s.withdrawalsPending.toLocaleString()} href="/admin/withdrawals" tone="#EF4444" />
      </div></article>
      <article className="opsPanel"><div className="opsPanelHeader"><div><h2>Review Health</h2><p>Submission distribution across approval states.</p></div></div><div className="opsMeterList">
        <div><span>Approved</span><strong>{approvalRate}%</strong><i><b style={{ width: `${approvalRate}%` }} /></i></div>
        <div><span>Pending</span><strong>{reviewRate}%</strong><i><b style={{ width: `${reviewRate}%` }} /></i></div>
        <div><span>Rejected</span><strong>{rejectionRate}%</strong><i><b style={{ width: `${rejectionRate}%` }} /></i></div>
      </div></article>
    </section>

    <section className="opsLayout bottom">
      <article className="opsPanel opsPanelLarge"><div className="opsPanelHeader"><div><h2>Platform Flow</h2><p>How work is moving through the business-to-contributor pipeline.</p></div></div><div className="opsFlow"><div><span>Business campaigns</span><strong>{totalCampaigns.toLocaleString()}</strong></div><div><span>Live missions</span><strong>{s.activeTasks.toLocaleString()}</strong></div><div><span>Contributor submissions</span><strong>{s.completionsTotal.toLocaleString()}</strong></div><div><span>Rewards released</span><strong>{fmt(s.qltAwarded)} QLT</strong></div></div></article>
      <article className="opsPanel"><div className="opsPanelHeader"><div><h2>New Contributors</h2><p>Latest user registrations.</p></div></div><div className="opsUserList">{s.recentUsers.length === 0 ? <p>No contributors yet.</p> : s.recentUsers.map(user => <div key={`${user.email}-${String(user.created_at)}`}><span>{(user.full_name || user.email || "U").slice(0, 1).toUpperCase()}</span><div><strong>{user.full_name || "Unnamed contributor"}</strong><small>{user.email}</small></div><time>{timeLabel(user.created_at)}</time></div>)}</div></article>
    </section>

    <section className="opsPanel"><div className="opsPanelHeader"><div><h2>Admin Shortcuts</h2><p>Common operational destinations.</p></div></div><div className="opsShortcutGrid"><Link href="/admin/users">Manage contributors</Link><Link href="/admin/tasks">Mission inventory</Link><Link href="/admin/logs">Audit logs</Link><Link href="/admin/config">Economy settings</Link></div></section>
    <DataManagement />
  </div>;
}
