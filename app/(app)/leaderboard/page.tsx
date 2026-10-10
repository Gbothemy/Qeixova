"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import ContributorLoading from "@/components/ContributorLoading";

interface Leader {
  id: number;
  rank: number;
  full_name: string;
  level_number: number;
  level_name: string;
  badge_color: string;
  xp: number;
  streak: number;
  missions_completed: number;
  total_qlt_earned: number | string;
}

const MEDAL_COLORS = ["#F5A623", "var(--qeixova-color-55-55-55)", "#cd7f32"];

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"missions" | "qlt">("missions");
  const [topEarners, setTopEarners] = useState<Leader[]>([]);
  const [topQLT, setTopQLT] = useState<Leader[]>([]);
  const [myRanks, setMyRanks] = useState<{ monthly: number | null; allTime: number | null }>({ monthly: null, allTime: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard").then(r => r.ok ? r.json() : null).then(d => {
      if (d) {
        setTopEarners(d.topEarners ?? []);
        setTopQLT(d.topQLT ?? d.topXP ?? []);
        setMyRanks({
          monthly: d.myRanks?.monthly ?? d.myRank ?? null,
          allTime: d.myRanks?.allTime ?? null,
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <ContributorLoading label="Loading leaderboard" detail="Ranking growth partners by missions and QLT earned." />;

  const list = tab === "missions" ? topEarners : topQLT;
  const activeRank = tab === "missions" ? myRanks.monthly : myRanks.allTime;

  return (
    <div className="page-body" style={{ background: "var(--qeixova-color-ff-ff-ff)", minHeight: "100vh" }}>
      <div className="page-header" style={{ background: "var(--qeixova-color-f5-f5-f5)", borderBottom: "1px solid var(--qeixova-color-dd-dd-dd)", padding: "52px 20px 24px" }}>
        <p style={{ color: "var(--qeixova-color-44-44-44)", fontSize: 13, marginBottom: 4 }}>Human Participation Marketplace</p>
        <p style={{ color: "var(--qeixova-color-0a-0a-0a)", fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Leaderboard</p>
        {activeRank && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 20, padding: "5px 14px", marginTop: 10 }}>
            <span style={{ fontSize: 12, color: "#F5A623", fontWeight: 700 }}>
              Your {tab === "missions" ? "monthly mission" : "all-time QLT"} rank: #{activeRank}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "14px 16px", background: "var(--qeixova-color-ee-ee-ee)", borderBottom: "1px solid var(--qeixova-color-dd-dd-dd)" }}>
        {[{ val: "missions", label: "Monthly Missions" }, { val: "qlt", label: "All-Time QLT" }].map(t => (
          <button key={t.val} onClick={() => setTab(t.val as "missions" | "qlt")} style={{
            flex: 1, padding: "9px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: tab === t.val ? 800 : 500, cursor: "pointer",
            background: tab === t.val ? "linear-gradient(135deg, #1AEF22, #06B517)" : "var(--qeixova-color-e5-e5-e5)",
            color: tab === t.val ? "var(--qeixova-color-ff-ff-ff)" : "var(--qeixova-color-33-33-33)",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {list.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "var(--qeixova-color-ee-ee-ee)", borderRadius: 16, border: "1px solid var(--qeixova-color-dd-dd-dd)" }}>
            <img src="/icon-trophy.svg" width={48} height={48} style={{ opacity:0.3, marginBottom:12, filter:"invert(72%) sepia(60%) saturate(500%) hue-rotate(5deg)" }} alt="" />
            <p style={{ color: "var(--qeixova-color-44-44-44)", fontSize: 14 }}>No data yet. Complete missions to appear here!</p>
          </div>
        ) : list.map((u, i) => (
          <div key={u.id} style={{ background: i < 3 ? "var(--qeixova-color-f2-f2-f2)" : "var(--qeixova-color-ee-ee-ee)", borderRadius: 14, padding: "14px 16px", border: `1px solid ${i < 3 ? "rgba(245,166,35,0.15)" : "var(--qeixova-color-e5-e5-e5)"}`, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: i < 3 ? MEDAL_COLORS[i] + "22" : "var(--qeixova-color-e5-e5-e5)", border: i < 3 ? `2px solid ${MEDAL_COLORS[i]}` : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: i < 3 ? MEDAL_COLORS[i] : "var(--qeixova-color-44-44-44)" }}>#{u.rank ?? i + 1}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--qeixova-color-0a-0a-0a)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name}</p>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: (u.badge_color ?? "var(--qeixova-color-33-33-33)") + "22", color: u.badge_color ?? "var(--qeixova-color-33-33-33)" }}>
                L{u.level_number ?? 1} {u.level_name ?? "Starter"}
              </span>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {tab === "missions" ? (
                <>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#1AEF22" }}>{u.missions_completed}</p>
                  <p style={{ fontSize: 10, color: "var(--qeixova-color-44-44-44)" }}>missions</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#F5A623" }}>{Number(u.total_qlt_earned ?? 0).toLocaleString()}</p>
                  <p style={{ fontSize: 10, color: "var(--qeixova-color-44-44-44)" }}>QLT</p>
                </>
              )}
              {u.streak > 0 && <p style={{ fontSize: 10, color: "#F5A623", marginTop: 2 }}>{u.streak} streak</p>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 16px 0", textAlign: "center" }}>
        <Link href="/tasks" style={{ display: "inline-block", background: "linear-gradient(135deg, #F5A623, #d89420)", color: "var(--qeixova-color-ff-ff-ff)", textDecoration: "none", padding: "12px 28px", borderRadius: 12, fontWeight: 800, fontSize: 14 }}>
          Complete Missions to Rank Up →
        </Link>
      </div>
      <BottomNav />
    </div>
  );
}

