"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BalanceCard from "@/components/BalanceCard";
import BottomNav from "@/components/BottomNav";
import ContributorNotifications from "@/components/ContributorNotifications";
import ContributorLoading from "@/components/ContributorLoading";
import OnboardingFlow from "@/components/OnboardingFlow";
import { useAuth } from "@/lib/useAuth";
import { WITHDRAWAL_UNLOCK_QLT } from "@/lib/rewardRules";
import ThemeToggle from "@/components/ThemeToggle";

interface WalletData {
  balance: number;
  stats: { tasks_today: number; today_earned: number; tasks_total: number; total_accumulated: number; total_withdrawn: number; };
  transactions: { type: string; label: string; amount: number; created_at: string }[];
}

interface MatchedMission {
  id: number;
  title: string;
  reward: number;
  category: string;
  estimated_time: string;
  completed: boolean;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  if (h < 48) return "Yesterday";
  return `${Math.floor(diff / 86400000)} days ago`;
}

export default function Home() {
  const { user, loading } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [matchedMissions, setMatchedMissions] = useState<MatchedMission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const load = () => fetch("/api/wallet").then(r => r.ok ? r.json() : null).then(d => { if (d) setWallet(d); }).catch(() => {});
    load();
    window.addEventListener("balanceUpdated", load);

    fetch("/api/tasks", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setMatchedMissions((data?.tasks ?? []).filter((task: MatchedMission) => !task.completed).slice(0, 3)))
      .catch(() => setMatchedMissions([]))
      .finally(() => setMissionsLoading(false));

    // Check onboarding status
    fetch("/api/onboarding").then(r => r.ok ? r.json() : null).then(d => {
      if (d && d.onboarding_completed === false) setShowOnboarding(true);
    }).catch(() => {});

    return () => window.removeEventListener("balanceUpdated", load);
  }, [user]);

  if (loading) return <ContributorLoading label="Loading dashboard" detail="Preparing your earnings, missions, and activity." />;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="page-body" style={{ background: "var(--qeixova-color-ff-ff-ff)", minHeight: "100vh" }}>
      {showOnboarding && user && (
        <OnboardingFlow userName={user.fullName} onComplete={() => { setShowOnboarding(false); router.push("/tasks"); }} />
      )}
      {/* Header */}
      <div className="page-header" style={{ background: "var(--qeixova-color-f5-f5-f5)", borderBottom: "1px solid var(--qeixova-color-dd-dd-dd)", padding: "52px 20px 90px", position: "relative", overflow: "visible" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(26,239,34,0.03)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", position: "relative" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1AEF22", boxShadow: "0 0 8px #1AEF22" }} />
              <p style={{ color: "var(--qeixova-color-44-44-44)", fontSize: 13 }}>{greeting()}</p>
            </div>
            <p style={{ color: "var(--qeixova-color-0a-0a-0a)", fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
              {user?.fullName?.split(" ")[0] ?? "Welcome back"}!
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <ThemeToggle />
            <ContributorNotifications />
          </div>
        </div>
        {user && user.streak > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(26,239,34,0.08)", border: "1px solid rgba(26,239,34,0.2)", borderRadius: 20, padding: "5px 14px", marginTop: 14 }}>
            <img src="/icon-fire.svg" width={14} height={14} style={{ filter: "invert(58%) sepia(98%) saturate(400%) hue-rotate(83deg) brightness(110%)" }} alt="" />
            <span style={{ color: "#1AEF22", fontSize: 12, fontWeight: 700 }}>{user.streak}-day streak — Keep it up!</span>
          </div>
        )}
      </div>

      {/* Balance card */}
      <div style={{ marginTop: -64, position: "relative", zIndex: 30 }}>
        <BalanceCard
          balance={wallet?.balance ?? user?.balance ?? 0}
          todayEarned={wallet?.stats?.today_earned ?? 0}
          tasksToday={wallet?.stats?.tasks_today ?? 0}
          totalAccumulated={wallet?.stats?.total_accumulated ?? 0}
          totalWithdrawn={wallet?.stats?.total_withdrawn ?? 0}
          tasksTotal={wallet?.stats?.tasks_total ?? 0}
        />
      </div>

      {/* First Task Banner */}
      {wallet && wallet.stats.tasks_total === 0 && (
        <div style={{ padding: "20px 16px 0" }}>
          <Link href="/tasks" style={{ textDecoration: "none" }}>
            <div style={{ background: "var(--qeixova-color-ee-ee-ee)", borderRadius: 18, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, border: "1px solid #1AEF22", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(26,239,34,0.05)" }} />
              <div style={{ flex: 1 }}>
                <p style={{ color: "var(--qeixova-color-0a-0a-0a)", fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Complete your first mission</p>
                <p style={{ color: "var(--qeixova-color-33-33-33)", fontSize: 13 }}>Start earning QLT — missions take 1–10 minutes</p>
              </div>
              <div style={{ background: "var(--qeixova-color-00-00-00)", borderRadius: 12, padding: "12px 20px", flexShrink: 0 }}>
                <span style={{ color: "var(--qeixova-color-ff-ff-ff)", fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>Start →</span>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* QLT Level progress */}
      {user && (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ background: "var(--qeixova-color-ee-ee-ee)", borderRadius: 16, padding: "16px 18px", border: "1px solid var(--qeixova-color-dd-dd-dd)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: user.badgeColor ?? "#1AEF22" }}>
                  {user.levelName ?? "Starter"}
                </span>
              </div>
              {user.nextLevel ? (
                <span style={{ fontSize: 11, color: "var(--qeixova-color-44-44-44)" }}>
                  {user.qltToNextLevel.toLocaleString()} QLT to {user.nextLevel.emoji} {user.nextLevel.name}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "#F5A623", fontWeight: 700 }}>Max Level</span>
              )}
            </div>
            <div style={{ height: 5, background: "var(--qeixova-color-dd-dd-dd)", borderRadius: 10, overflow: "hidden", marginBottom: 6 }}>
              <div style={{
                height: "100%",
                width: `${user.progressPct ?? 0}%`,
                background: "linear-gradient(90deg, #1AEF22, #F5A623)",
                borderRadius: 10, transition: "width 0.4s",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--qeixova-color-55-55-55)" }}>
                  {user.total_earned_qlt.toLocaleString()} mission QLT earned lifetime
                </span>
                <span style={{ fontSize: 11, color: "#F5A623" }}>
                  {user.bonus_earned_qlt.toLocaleString()} bonus QLT
                </span>
              </div>
              {!user.canWithdraw && (
                <span style={{ fontSize: 11, color: "#F5A623", fontWeight: 600 }}>
                  <img src="/icon-lock.svg" width={10} height={10} style={{ opacity:0.7, marginRight:3, verticalAlign:"middle" }} alt="" />
                  {Math.max(0, WITHDRAWAL_UNLOCK_QLT - user.total_earned_qlt).toLocaleString()} QLT to unlock withdrawals
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/wallet" style={{ flex: 1, background: "var(--qeixova-color-00-00-00)", border: "none", color: "var(--qeixova-color-ff-ff-ff)", borderRadius: 14, padding: "14px 0", textAlign: "center", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            Withdraw
          </Link>
          <Link href="/tasks" style={{ flex: 1, background: "linear-gradient(135deg, #F5A623, #d89420)", color: "var(--qeixova-color-ff-ff-ff)", borderRadius: 14, padding: "14px 0", textAlign: "center", fontWeight: 800, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 16px rgba(245,166,35,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            Earn Now
          </Link>
        </div>
      </div>

      {/* Profile-matched missions */}
      <div style={{ padding: "28px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
          <div>
            <p style={{ fontWeight: 800, fontSize: 17, color: "var(--qeixova-color-0a-0a-0a)", marginBottom: 4 }}>New missions for you</p>
            <p style={{ color: "var(--qeixova-color-44-44-44)", fontSize: 12, lineHeight: 1.5 }}>Matched with your selected interests and state.</p>
          </div>
          <Link href="/tasks" style={{ fontSize: 13, color: "#1AEF22", fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>View all</Link>
        </div>

        {missionsLoading ? (
          <div style={{ minHeight: 154, background: "var(--qeixova-color-ee-ee-ee)", borderRadius: 16, border: "1px solid var(--qeixova-color-dd-dd-dd)", display: "grid", placeItems: "center", color: "var(--qeixova-color-66-66-66)", fontSize: 13 }}>
            Finding matched missions...
          </div>
        ) : matchedMissions.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            {matchedMissions.map((mission) => (
              <Link key={mission.id} href="/tasks" style={{ textDecoration: "none" }}>
                <div style={{ minHeight: 86, background: "var(--qeixova-color-ee-ee-ee)", borderRadius: 16, border: "1px solid var(--qeixova-color-dd-dd-dd)", padding: "15px 17px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: "var(--qeixova-color-0a-0a-0a)", fontSize: 14, fontWeight: 800, marginBottom: 5 }}>{mission.title}</p>
                    <p style={{ color: "var(--qeixova-color-55-55-55)", fontSize: 11 }}>{mission.category || "Participation mission"} · {mission.estimated_time || "5 min"}</p>
                  </div>
                  <span style={{ color: "#F5A623", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>{Number(mission.reward).toLocaleString()} QLT</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ minHeight: 154, background: "var(--qeixova-color-ee-ee-ee)", borderRadius: 16, padding: "28px 24px", textAlign: "center", border: "1px solid var(--qeixova-color-dd-dd-dd)", display: "grid", placeItems: "center" }}>
            <div>
              <Image src="/icon-target.svg" width={38} height={38} alt="" style={{ opacity: 0.42, marginBottom: 10 }} />
              <p style={{ color: "var(--qeixova-color-0a-0a-0a)", fontSize: 14, fontWeight: 800, marginBottom: 7 }}>No matched missions right now</p>
              <p style={{ color: "var(--qeixova-color-55-55-55)", fontSize: 12, lineHeight: 1.5 }}>New business campaigns will appear here when they match your selected interests and state.</p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div style={{ padding: "28px 16px 0" }}>
        <p style={{ fontWeight: 800, fontSize: 17, color: "var(--qeixova-color-0a-0a-0a)", marginBottom: 16 }}>Recent Activity</p>
        {wallet?.transactions?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {wallet.transactions.slice(0, 5).map((tx, i) => (
              <div key={i} style={{ background: "var(--qeixova-color-ee-ee-ee)", borderRadius: 16, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--qeixova-color-dd-dd-dd)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: tx.type === "credit" ? "rgba(26,239,34,0.12)" : "rgba(229,62,62,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Image src={tx.type === "credit" ? "/icon-task.svg" : "/icon-wallet.svg"} alt="tx" width={20} height={20} style={{ objectFit: "contain" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--qeixova-color-0a-0a-0a)" }}>{tx.label}</p>
                    <p style={{ fontSize: 11, color: "var(--qeixova-color-44-44-44)", marginTop: 2 }}>{timeAgo(tx.created_at)}</p>
                  </div>
                </div>
                <div style={{ background: tx.type === "credit" ? "rgba(26,239,34,0.12)" : "rgba(229,62,62,0.12)", borderRadius: 10, padding: "5px 12px" }}>
                  <p style={{ fontWeight: 800, color: tx.type === "credit" ? "#1AEF22" : "#e53e3e", fontSize: 13 }}>
                    {tx.type === "credit" ? "+" : "-"}{tx.amount.toLocaleString()} QLT
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: "var(--qeixova-color-ee-ee-ee)", borderRadius: 16, padding: "32px", textAlign: "center", border: "1px solid var(--qeixova-color-dd-dd-dd)" }}>
            <img src="/icon-analytics.svg" width={36} height={36} style={{ opacity:0.3, filter:"invert(58%) sepia(98%) saturate(400%) hue-rotate(83deg) brightness(110%)", marginBottom:8 }} alt="" />
            <p style={{ color: "var(--qeixova-color-44-44-44)", fontSize: 14 }}>No activity yet — complete your first mission!</p>
          </div>
        )}
      </div>

      {/* Step 6 — Daily Progress Bar */}
      {wallet && wallet.stats.tasks_today > 0 && (
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ background: "var(--qeixova-color-ee-ee-ee)", borderRadius: 16, padding: "16px 18px", border: "1px solid var(--qeixova-color-dd-dd-dd)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--qeixova-color-0a-0a-0a)" }}>Complete 3 missions today</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1AEF22" }}>{Math.min(wallet.stats.tasks_today, 3)}/3</p>
            </div>
            <div style={{ height: 6, background: "var(--qeixova-color-dd-dd-dd)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min((wallet.stats.tasks_today / 3) * 100, 100)}%`, background: "linear-gradient(90deg, #1AEF22, #F5A623)", borderRadius: 10, transition: "width 0.4s ease" }} />
            </div>
            <p style={{ fontSize: 11, color: "var(--qeixova-color-33-33-33)", marginTop: 8 }}>Stay active and earn more consistently.</p>
          </div>
        </div>
      )}

      {/* Step 10 — Exit Hook */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ background: "var(--qeixova-color-f5-f5-f5)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--qeixova-color-e5-e5-e5)", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--qeixova-color-33-33-33)" }}>New participation missions are added regularly. Come back for more opportunities.</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

function _LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--qeixova-color-ff-ff-ff)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
        <p style={{ color: "#1AEF22", fontWeight: 700 }}>Loading...</p>
      </div>
    </div>
  );
}
