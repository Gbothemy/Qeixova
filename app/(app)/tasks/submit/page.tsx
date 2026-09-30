"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ContributorLoading from "@/components/ContributorLoading";
import TaskModal, { FullTask } from "@/components/TaskModal";
import { useAuth } from "@/lib/useAuth";

const SELECTED_KEY = "qeixova-my-missions-v2";
const STARTED_KEY = "qeixova-started-missions-v2";

export default function MyMissionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<FullTask[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [startedIds, setStartedIds] = useState<number[]>([]);
  const [activeTask, setActiveTask] = useState<FullTask | null>(null);
  const [activeMode, setActiveMode] = useState<"details" | "proof">("details");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const selected: unknown = JSON.parse(window.localStorage.getItem(SELECTED_KEY) || "[]");
      const started: unknown = JSON.parse(window.localStorage.getItem(STARTED_KEY) || "[]");
      if (Array.isArray(selected)) setSelectedIds(selected.filter((id): id is number => Number.isInteger(id)));
      if (Array.isArray(started)) setStartedIds(started.filter((id): id is number => Number.isInteger(id)));
    } catch {
      window.localStorage.removeItem(SELECTED_KEY);
      window.localStorage.removeItem(STARTED_KEY);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Couldn’t load your missions.");
      setTasks(data.tasks ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn’t load your missions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) void loadTasks(); }, [user, loadTasks]);

  const selectedMissions = useMemo(
    () => tasks.filter((task) => selectedIds.includes(task.id) && !task.completed && !task.lockedByLevel && !task.lockedByType),
    [selectedIds, tasks],
  );
  const pendingMissions = tasks.filter((task) => task.completed && task.completion_status === "pending");

  const startMission = (task: FullTask) => {
    const next = startedIds.includes(task.id) ? startedIds : [...startedIds, task.id];
    setStartedIds(next);
    window.localStorage.setItem(STARTED_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("qeixova-mission-started"));
    if (task.mission_key === "qeixova-awareness-verification") window.dispatchEvent(new Event("qeixova-welcome-details-opened"));
    setActiveMode("details");
    setActiveTask(task);
  };

  const removeMission = (taskId: number) => {
    const nextSelected = selectedIds.filter((id) => id !== taskId);
    const nextStarted = startedIds.filter((id) => id !== taskId);
    setSelectedIds(nextSelected);
    setStartedIds(nextStarted);
    window.localStorage.setItem(SELECTED_KEY, JSON.stringify(nextSelected));
    window.localStorage.setItem(STARTED_KEY, JSON.stringify(nextStarted));
  };

  const handleComplete = async (id: number, proofValue: string) => {
    try {
      const response = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: id, proofValue }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return { ok: false, error: data.error || "Submission failed. Please try again." };

      removeMission(id);
      setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: true, completion_status: "pending" } : task));
      window.dispatchEvent(new CustomEvent("balanceUpdated", { detail: { newBalance: data.newBalance } }));
      return { ok: true, reward: data.reward, xpReward: data.xpReward };
    } catch {
      return { ok: false, error: "Network error. Please try again." };
    }
  };

  if (authLoading || loading) return <ContributorLoading label="Loading My Missions" detail="Getting your selected missions and review status." />;

  return (
    <main className="page-body" style={{ minHeight: "100vh", background: "#080909", paddingBottom: 104 }}>
      <div style={{ width: "min(100%, 820px)", margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 16, padding: "8px 0 20px" }}>
          <div>
            <span style={{ color: "#1AEF22", fontSize: 10, fontWeight: 950, letterSpacing: 1, textTransform: "uppercase" }}>Mission workspace</span>
            <h1 style={{ marginTop: 6, color: "#f5f5f5", fontSize: "clamp(27px, 5vw, 36px)", lineHeight: 1.08, fontWeight: 950 }}>My Missions</h1>
            <p style={{ maxWidth: 560, marginTop: 8, color: "#b8bdb9", fontSize: 13, lineHeight: 1.6 }}>Your selected work, ready when you are. Start a mission for its instructions, then submit proof here when you finish.</p>
          </div>
          <Link href="/tasks" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 40, border: "1px solid #303630", borderRadius: 10, background: "#111411", color: "#e5e8e5", padding: "0 13px", textDecoration: "none", fontSize: 12, fontWeight: 850 }}>Browse missions</Link>
        </header>

        {error && <div role="alert" style={{ marginBottom: 14, border: "1px solid rgba(229,62,62,.35)", borderRadius: 12, background: "rgba(229,62,62,.08)", color: "#ffaaaa", padding: 14 }}>{error}<button onClick={() => void loadTasks()} style={{ marginLeft: 12, color: "inherit", textDecoration: "underline", border: 0, background: "none", cursor: "pointer" }}>Try again</button></div>}

        <section aria-labelledby="selected-missions-heading" style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "4px 2px" }}>
            <h2 id="selected-missions-heading" style={{ color: "#f2f4f2", fontSize: 16, fontWeight: 900 }}>Selected</h2>
            <span style={{ color: "#929993", fontSize: 11 }}>{selectedMissions.length} active</span>
          </div>

          {selectedMissions.length === 0 ? (
            <div style={{ display: "grid", justifyItems: "start", gap: 9, padding: "22px 20px", border: "1px solid #252925", borderRadius: 15, background: "#101211" }}>
              <strong style={{ color: "#f3f5f3", fontSize: 14 }}>No missions selected yet</strong>
              <p style={{ color: "#aeb4af", fontSize: 12, lineHeight: 1.55 }}>Preview missions on the board, then select the ones you want to take on. They’ll appear here.</p>
              <Link href="/tasks" style={{ color: "#1aef22", textDecoration: "none", fontSize: 12, fontWeight: 900 }}>Explore missions →</Link>
            </div>
          ) : selectedMissions.map((task) => {
            const started = startedIds.includes(task.id);
            return (
              <article key={task.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 14, padding: "15px 16px", border: "1px solid #292e2a", borderRadius: 14, background: "linear-gradient(120deg, rgba(255,255,255,.018), #101211 55%)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, marginBottom: 7 }}>
                    <span style={{ border: "1px solid rgba(26,239,34,.23)", borderRadius: 999, background: "rgba(26,239,34,.07)", color: "#1aef22", padding: "4px 8px", fontSize: 9, fontWeight: 950, letterSpacing: .35, textTransform: "uppercase" }}>{started ? "In progress" : "Selected"}</span>
                    <span style={{ color: "#929993", fontSize: 10 }}>{task.category}</span>
                  </div>
                  <h3 style={{ overflowWrap: "anywhere", color: "#f5f5f5", fontSize: 15, fontWeight: 900 }}>{task.title}</h3>
                  <p style={{ marginTop: 6, color: "#aeb4af", fontSize: 11, lineHeight: 1.45 }}>+{Number(task.reward).toLocaleString()} QLT <span aria-hidden="true">·</span> {task.duration} <span aria-hidden="true">·</span> {task.proof_label || task.proof_type} proof</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 7 }}>
                  <button type="button" onClick={() => {
                    if (started) { setActiveMode("proof"); setActiveTask(task); }
                    else startMission(task);
                  }} data-tour={task.mission_key === "qeixova-awareness-verification" ? "welcome-start" : undefined} style={{ minWidth: 132, minHeight: 40, border: 0, borderRadius: 10, background: "#1aef22", color: "#061006", padding: "0 12px", fontSize: 12, fontWeight: 950, cursor: "pointer" }}>{started ? "Submit proof" : "Start mission"}</button>
                  {started && <button type="button" data-tour={task.mission_key === "qeixova-awareness-verification" ? "welcome-view-instructions" : undefined} onClick={() => startMission(task)} style={{ border: 0, background: "transparent", color: "#aeb4af", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>View instructions</button>}
                  <button type="button" onClick={() => removeMission(task.id)} style={{ border: 0, background: "transparent", color: "#8c928d", fontSize: 10, cursor: "pointer" }}>Remove</button>
                </div>
              </article>
            );
          })}
        </section>

        {pendingMissions.length > 0 && (
          <section aria-labelledby="pending-missions-heading" style={{ display: "grid", gap: 9, marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 2px" }}>
              <h2 id="pending-missions-heading" style={{ color: "#f2f4f2", fontSize: 15, fontWeight: 900 }}>Pending review</h2>
              <span style={{ color: "#929993", fontSize: 11 }}>{pendingMissions.length}</span>
            </div>
            {pendingMissions.map((task) => <div key={task.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 15px", border: "1px solid #302d25", borderRadius: 12, background: "#11110f" }}><span style={{ color: "#dedfdb", fontSize: 12, fontWeight: 800 }}>{task.title}</span><span style={{ flexShrink: 0, color: "#f5a623", fontSize: 10, fontWeight: 900 }}>Awaiting review</span></div>)}
          </section>
        )}
      </div>
      {activeTask && <TaskModal key={`${activeTask.id}-${activeMode}`} task={activeTask} startAtProof={activeMode === "proof"} presentation={activeMode === "proof" ? "page" : "modal"} isSelected={selectedIds.includes(activeTask.id)} onToggleSelection={() => removeMission(activeTask.id)} onClose={() => { setActiveTask(null); setActiveMode("details"); }} onComplete={handleComplete} />}
      <BottomNav />
    </main>
  );
}
