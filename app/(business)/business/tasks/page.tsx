"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import BusinessLoading from "@/components/BusinessLoading";
import BusinessSidebar from "@/components/BusinessSidebar";

interface Task {
  id: number;
  title: string;
  category: string;
  reward: number;
  mission_type: string;
  is_active: boolean;
  status: string;
  total_completions: number;
  approved_completions: number;
  pending_completions: number;
  created_at: string;
}

const statusCopy: Record<string, { label: string; tone: string }> = {
  pending_review: { label: "Under review", tone: "warning" },
  active: { label: "Active", tone: "success" },
  expired: { label: "Expired", tone: "danger" },
  rejected: { label: "Rejected", tone: "danger" },
  paused: { label: "Paused", tone: "muted" },
};

function getTaskStatus(task: Task) {
  if (task.status === "pending_review") return statusCopy.pending_review;
  if (task.status === "expired") return statusCopy.expired;
  if (task.status === "rejected") return statusCopy.rejected;
  if (task.is_active) return statusCopy.active;
  return statusCopy.paused;
}

export default function BusinessTasksPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<{ name: string } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionTaskId, setActionTaskId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/business/tasks", { cache: "no-store" });
      if (response.status === 401) {
        router.push("/business/login");
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Campaigns could not be loaded.");
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Campaigns could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetch("/api/business/me", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          router.push("/business/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.business) setBusiness(data.business);
      })
      .catch(() => router.push("/business/login"));

    void load();
  }, [load, router]);

  const totals = useMemo(() => ({
    active: tasks.filter((task) => task.is_active && task.status === "active").length,
    pending: tasks.reduce((sum, task) => sum + Number(task.pending_completions || 0), 0),
    approved: tasks.reduce((sum, task) => sum + Number(task.approved_completions || 0), 0),
  }), [tasks]);

  const handleAction = async (task: Task) => {
    const action = task.is_active ? "pause" : "resume";
    setActionTaskId(task.id);
    setError("");
    try {
      const response = await fetch(`/api/business/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Campaign could not be ${action}d.`);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Campaign could not be updated.");
    } finally {
      setActionTaskId(null);
    }
  };

  if (!business || loading) {
    return <BusinessLoading title="Loading campaigns" detail="Preparing campaign status, results, and submissions." />;
  }

  const summary = [
    { label: "All campaigns", value: tasks.length, tone: "warning" },
    { label: "Active", value: totals.active, tone: "success" },
    { label: "Approved actions", value: totals.approved, tone: "success" },
    { label: "Pending review", value: totals.pending, tone: "warning" },
  ];

  return (
    <>
      <BusinessSidebar name={business.name} />
      <main className="page-body business-page-pro">
        <div className="businessWorkspace">
          <section className="adsPanel businessListHeader">
            <div className="businessSectionHead">
              <div>
                <p className="businessEyebrow">Campaign Manager</p>
                <h1 className="businessPageTitle">Campaigns</h1>
                <p className="businessIdentityLine">{tasks.length} campaigns / {totals.active} active / {totals.pending} pending submissions</p>
              </div>
              <Link href="/business/tasks/new" className="businessPrimaryLink">New Campaign</Link>
            </div>
          </section>

          {error && <div className="businessErrorBanner" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}

          <section className="businessMetricGrid businessCompactMetrics" aria-label="Campaign totals">
            {summary.map((item) => (
              <article key={item.label} className={`adsPanel businessStatTile ${item.tone}`}>
                <span>{item.label}</span>
                <strong>{item.value.toLocaleString()}</strong>
              </article>
            ))}
          </section>

          <section className="businessCampaignTable">
            <div className="businessCampaignTableHead">
              <span>Campaign</span><span>Status</span><span>Reward</span><span>Results</span><span>Actions</span>
            </div>
            {tasks.length === 0 ? (
              <div className="businessEmptyState">
                <div><Image src="/icon-create-mission.svg" alt="" width={30} height={30} /></div>
                <h2>No campaigns yet</h2>
                <p>Create your first campaign and manage delivery from this workspace.</p>
                <Link href="/business/tasks/new" className="businessPrimaryLink">Create Campaign</Link>
              </div>
            ) : (
              tasks.map((task, index) => {
                const status = getTaskStatus(task);
                const canToggle = !["pending_review", "expired", "rejected"].includes(task.status);
                const updating = actionTaskId === task.id;
                return (
                  <article key={task.id} className="businessCampaignRow" data-last={index === tasks.length - 1 ? "true" : undefined}>
                    <div>
                      <Link href={`/business/tasks/${task.id}`}>{task.title}</Link>
                      <p>{task.category} / {task.mission_type || "engagement"}</p>
                    </div>
                    <span className={`campaignStatus ${status.tone}`}>{status.label}</span>
                    <strong className="campaignReward">{Number(task.reward || 0).toLocaleString()} QLT</strong>
                    <span className="campaignResults">{Number(task.approved_completions || 0)}/{Number(task.total_completions || 0)}</span>
                    <div className="campaignRowActions">
                      <Link href={`/business/tasks/${task.id}`}>View</Link>
                      {canToggle && (
                        <button
                          type="button"
                          className={task.is_active ? "danger" : "success"}
                          disabled={updating}
                          onClick={() => void handleAction(task)}
                        >
                          {updating ? "Updating..." : task.is_active ? "Pause" : "Resume"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>
      </main>
    </>
  );
}
