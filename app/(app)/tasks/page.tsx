"use client";
import { useCallback, useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import ContributorLoading from "@/components/ContributorLoading";
import TaskCard, { Task } from "@/components/TaskCard";
import TaskModal, { FullTask } from "@/components/TaskModal";
import { useAuth } from "@/lib/useAuth";

type MissionCategoryFilter = {
  val: string;
  label: string;
  accent: string;
  aliases?: string[];
};

const topCategoryFilters: MissionCategoryFilter[] = [
  { val: "All", label: "All Opportunities", accent: "#1AEF22" },
  { val: "Content Distribution", label: "Content Distribution", accent: "#4a9eff", aliases: ["Social Media", "Content"] },
  { val: "Music Promotion", label: "Music Promotion", accent: "#F5A623" },
  { val: "Business Awareness", label: "Business Awareness", accent: "#1AEF22" },
  { val: "Creator Campaigns", label: "Creator Campaigns", accent: "#c084fc", aliases: ["Creator Campaign"] },
  { val: "App Testing", label: "App Testing", accent: "#14b8a6", aliases: ["App Testing & Reviews"] },
  { val: "Referral Missions", label: "Referral Missions", accent: "#f87171", aliases: ["Referral Mission"] },
];

const moreCategoryFilters: MissionCategoryFilter[] = [
  { val: "Surveys & Feedback", label: "Surveys & Feedback", accent: "#fb7185", aliases: ["Survey", "Surveys"] },
  { val: "Event Promotion", label: "Event Promotion", accent: "#f97316" },
  { val: "Community Growth", label: "Community Growth", accent: "#22c55e" },
  { val: "Video Engagement", label: "Video Engagement", accent: "#e879f9" },
  { val: "Brand Ambassador Missions", label: "Brand Ambassador", accent: "#60a5fa" },
  { val: "AI & Digital Work", label: "AI & Digital Work", accent: "#38bdf8", aliases: ["AI Testing"] },
  { val: "Local Discovery Missions", label: "Local Discovery", accent: "#10b981" },
  { val: "Trend Missions", label: "Trend Missions", accent: "#fb7185" },
  { val: "Premium Missions", label: "Premium Missions", accent: "#facc15", aliases: ["Premium Mission"] },
];

interface Meta { userLevel: number; levelName: string; badgeColor: string; xp: number; dailyEarned: number; dailyCap: number; dailyRemaining: number; trustScore: number; }

const allCategoryFilters = [...topCategoryFilters, ...moreCategoryFilters];

function normalizeCategory(category: string) {
  const normalized = category.trim().toLowerCase();
  const match = allCategoryFilters.find((filter) => {
    if (filter.val.toLowerCase() === normalized || filter.label.toLowerCase() === normalized) return true;
    return filter.aliases?.some((alias) => alias.toLowerCase() === normalized);
  });
  return match?.val ?? category;
}

export default function TasksPage() {
  const { user, loading } = useAuth();
  const [tasks, setTasks] = useState<FullTask[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [proofFilter, setProofFilter] = useState("All proof");
  const [rewardFilter, setRewardFilter] = useState("Any reward");
  const [availabilityFilter, setAvailabilityFilter] = useState("Open");
  const [selectedTask, setSelectedTask] = useState<FullTask | null>(null);

  const loadTasks = useCallback(() => {
    setFetching(true); setFetchError(false);
    fetch("/api/tasks")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { if (d?.tasks) setTasks(d.tasks); if (d?.meta) setMeta(d.meta); })
      .catch(() => setFetchError(true))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    void Promise.resolve().then(loadTasks);
  }, [user, loadTasks]);

  const handleComplete = async (id: number, proofValue: string) => {
    try {
      const res = await fetch("/api/tasks/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: id, proofValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true, completion_status: "pending" } : t));
        window.dispatchEvent(new CustomEvent("balanceUpdated", { detail: { newBalance: data.newBalance } }));
        return { ok: true, reward: data.reward, xpReward: data.xpReward };
      }
      return { ok: false, error: data.error || "Submission failed" };
    } catch {
      return { ok: false, error: "Network error. Please try again." };
    }
  };

  if (loading || fetching) return <ContributorLoading label="Loading missions" detail="Finding approved campaigns that match your profile." />;

  if (fetchError) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000000", flexDirection: "column", gap: 16, padding: 24 }}>
      <img src="/icon-alert.svg" width={48} height={48} style={{ opacity:0.5, filter:"invert(40%) sepia(100%) saturate(500%) hue-rotate(320deg)" }} alt="" />
      <p style={{ fontWeight: 700, color: "#F5F5F5", fontSize: 16 }}>Couldn&apos;t load missions</p>
      <button onClick={loadTasks} style={{ background: "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", border: "none", borderRadius: 12, padding: "12px 28px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Retry</button>
    </div>
  );

  const filtered = tasks
    .filter((task) => {
      const metadata = task.campaign_metadata ?? {};
      const text = [
        task.title,
        task.category,
        task.instructions,
        task.campaign_goal,
        task.business_name,
        metadata.objective,
        metadata.contentType,
        metadata.selectedPricingLabel,
        metadata.contentLink,
        metadata.assetName,
        metadata.targetLocation?.summary,
        ...(task.steps ?? []),
        ...(task.target_platforms ?? []),
        ...(task.target_interests ?? []),
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesQuery = query.trim() ? text.includes(query.trim().toLowerCase()) : true;
      const matchesCategory = activeCategory === "All" || normalizeCategory(task.category) === activeCategory;
      const matchesProof = proofFilter === "All proof" || task.proof_type === proofFilter.toLowerCase();
      const matchesReward = rewardFilter === "Any reward"
        || (rewardFilter === "High reward" && Number(task.reward) >= 1500)
        || (rewardFilter === "Quick earn" && Number(task.reward) < 1500);
      const matchesAvailability = availabilityFilter === "All"
        || (availabilityFilter === "Open" && !task.completed && !task.lockedByLevel && !task.lockedByType)
        || (availabilityFilter === "Pending" && task.completed);
      return matchesQuery && matchesCategory && matchesProof && matchesReward && matchesAvailability;
    })
    .sort((a, b) => {
      const aScore = Number((a as FullTask & { matchScore?: number }).matchScore ?? 100);
      const bScore = Number((b as FullTask & { matchScore?: number }).matchScore ?? 100);
      return bScore - aScore || Number(b.reward) - Number(a.reward);
    });

  const completedCount = tasks.filter(t => t.completed).length;
  const activeLabel = allCategoryFilters.find((filter) => filter.val === activeCategory)?.label ?? activeCategory;

  return (
    <div className="page-body" style={{ background: "#000000", minHeight: "100vh", paddingBottom: 88 }}>
      {/* Header */}
      <div className="page-header" style={{ background: "#080909", borderBottom: "1px solid #222222", padding: "48px 16px 16px", position: "relative", overflow: "hidden" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 16, alignItems: "start" }}>
            <div>
              <p style={{ color: "#F5A623", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Matched mission board</p>
              <h1 style={{ color: "#F5F5F5", fontSize: 28, lineHeight: 1.1, fontWeight: 950, letterSpacing: 0, margin: 0 }}>Missions matching your profile</h1>
              <p style={{ color: "#aaaaaa", fontSize: 13, marginTop: 8, lineHeight: 1.6, maxWidth: 560 }}>Only campaigns aligned with your selected interests and state are shown here.</p>
            </div>
            {meta && (
              <div style={{ minWidth: 190, border: "1px solid #242826", borderRadius: 14, background: "#0d0f0e", padding: 12 }}>
                <span style={{ display: "inline-flex", fontSize: 11, fontWeight: 900, padding: "4px 9px", borderRadius: 999, background: (meta.badgeColor ?? "#ccc") + "22", color: meta.badgeColor ?? "#ccc" }}>
                  L{meta.userLevel} {meta.levelName}
                </span>
                <p style={{ marginTop: 9, color: "#bbbbbb", fontSize: 12 }}>Trust: <strong style={{ color: "#F5F5F5" }}>{meta.trustScore}%</strong></p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mission category filters */}
      <div style={{ padding: "14px 16px", background: "#0b0c0c", borderBottom: "1px solid #222222" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) repeat(3, minmax(120px, 160px))", gap: 8 }} className="missionToolbar">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, business, platform, location..."
              style={{ width: "100%", border: "1px solid #303030", borderRadius: 12, background: "#080909", color: "#F5F5F5", padding: "12px 14px", fontSize: 13, outline: "none" }}
            />
            <select value={proofFilter} onChange={(event) => setProofFilter(event.target.value)} style={{ minWidth: 0, border: "1px solid #303030", borderRadius: 12, background: "#080909", color: "#cccccc", padding: "11px 10px", fontSize: 12 }}>
              <option>All proof</option>
              <option>Screenshot</option>
              <option>Url</option>
              <option>Text</option>
            </select>
            <select value={rewardFilter} onChange={(event) => setRewardFilter(event.target.value)} style={{ minWidth: 0, border: "1px solid #303030", borderRadius: 12, background: "#080909", color: "#cccccc", padding: "11px 10px", fontSize: 12 }}>
              <option>Any reward</option>
              <option>High reward</option>
              <option>Quick earn</option>
            </select>
            <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} style={{ minWidth: 0, border: "1px solid #303030", borderRadius: 12, background: "#080909", color: "#cccccc", padding: "11px 10px", fontSize: 12 }}>
              <option>Open</option>
              <option>Pending</option>
              <option>All</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
          {topCategoryFilters.map((filter) => {
            const active = activeCategory === filter.val;
            return (
              <button key={filter.val} onClick={() => setActiveCategory(filter.val)} style={{
                flexShrink: 0, padding: "8px 14px", borderRadius: 20,
                border: active ? "none" : "1.5px solid #333333",
                background: active ? filter.accent : "#1a1a1a",
                color: active ? "#000" : "#cccccc",
                fontWeight: active ? 800 : 600, fontSize: 12, cursor: "pointer",
              }}>{filter.label}</button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <p style={{ color: "#bbbbbb", fontSize: 12, fontWeight: 700 }}>
            {filtered.length.toLocaleString()} {activeCategory === "All" ? "available mission" : activeLabel.toLowerCase() + " mission"}{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
        </div>
      </div>

      {/* Progress */}
      {completedCount > 0 && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ background: "#111111", borderRadius: 12, padding: "12px 16px", border: "1px solid #222222" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#F5F5F5" }}>{completedCount} of {tasks.length} missions completed</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#1AEF22" }}>{Math.round((completedCount / tasks.length) * 100)}%</p>
            </div>
            <div style={{ height: 5, background: "#222222", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(completedCount / tasks.length) * 100}%`, background: "linear-gradient(90deg, #1AEF22, #F5A623)", borderRadius: 10 }} />
            </div>
          </div>
        </div>
      )}

      {/* Mission list */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }} className="missionList">
        {tasks.length === 0 ? (
          <div className="missionsEmptyState" style={{ width: "100%", minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "34px 18px", background: "#0f1110", borderRadius: 18, border: "1px solid #242826" }}>
            <div style={{ width: "min(100%, 430px)", margin: "0 auto" }}>
              <p style={{ fontSize: 44, marginBottom: 14 }}>🎯</p>
              <p style={{ fontWeight: 900, fontSize: 18, color: "#F5F5F5", marginBottom: 10, lineHeight: 1.3 }}>No matched missions are live yet</p>
              <p style={{ color: "#bbbbbb", fontSize: 14, lineHeight: 1.65, margin: "0 auto" }}>When an approved campaign matches your selected interests and state, it will appear here.</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", background: "#111111", borderRadius: 16, border: "1px solid #222222" }}>
            <img src="/icon-check-circle.svg" width={40} height={40} style={{ opacity:0.4, filter:"invert(58%) sepia(98%) saturate(400%) hue-rotate(83deg) brightness(110%)", marginBottom:8 }} alt="" />
            <p style={{ color: "#F5F5F5", fontWeight: 800, marginTop: 8 }}>No missions match the current filters</p>
            <p style={{ color: "#bbbbbb", fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>Clear the extra filters to return to your matched mission list.</p>
            <button type="button" onClick={() => { setActiveCategory("All"); setQuery(""); setProofFilter("All proof"); setRewardFilter("Any reward"); setAvailabilityFilter("Open"); }} style={{ marginTop: 14, border: "none", borderRadius: 12, background: "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", padding: "11px 18px", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>Clear filters</button>
          </div>
        ) : (
          filtered.map(task => (
            <TaskCard key={task.id} task={task as Task} onStart={t => setSelectedTask(t as FullTask)} />
          ))
        )}
      </div>

      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} onComplete={handleComplete} />
      )}
      <BottomNav />
      <style jsx>{`
        @media (max-width: 780px) {
          .missionToolbar {
            grid-template-columns: 1fr !important;
          }
          .missionsEmptyState {
            grid-column: 1 / -1;
          }
          .page-header > div > div:first-child {
            grid-template-columns: 1fr !important;
          }
        }
        .missionsEmptyState {
          grid-column: 1 / -1;
        }
        .missionList {
          width: 100%;
        }
      `}</style>
    </div>
  );
}
