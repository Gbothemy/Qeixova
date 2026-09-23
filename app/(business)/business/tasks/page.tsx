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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [templates,setTemplates]=useState<Array<{id:number;title:string;metadata?:{sourceTaskId?:number}}>>([]);

  const load = useCallback(async () => {
    setError("");
    try {
      const query = new URLSearchParams({ search, status: statusFilter, page: String(page), pageSize: "10" });
      const response = await fetch(`/api/business/tasks?${query}`, { cache: "no-store" });
      if (response.status === 401) {
        router.push("/business/login");
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Campaigns could not be loaded.");
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      if (data.pagination) setPagination(data.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Campaigns could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [router, search, statusFilter, page]);

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
    fetch('/api/business/campaign-tools').then(r=>r.json()).then(d=>setTemplates(d.templates||[])).catch(()=>{});
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
  const duplicate = (task:Task) => { router.push(`/business/tasks/new?duplicate=${task.id}`); };
  const saveTemplate = async (task:Task) => { const r=await fetch('/api/business/campaign-tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId:task.id})}); setError(r.ok?'Campaign saved as a reusable template.':'Template could not be saved.'); };

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
            {templates.length>0&&<div style={{padding:14,borderBottom:'1px solid #222'}}><strong style={{color:'#fff'}}>Saved templates</strong><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:9}}>{templates.map(t=><button key={t.id} type="button" onClick={()=>t.metadata?.sourceTaskId&&void duplicate({id:t.metadata.sourceTaskId} as Task)} style={{padding:'8px 11px',borderRadius:9,border:'1px solid #333',background:'#111',color:'#F5A623'}}>{t.title}</button>)}</div></div>}
            <div style={{display:"flex",gap:10,padding:14,flexWrap:"wrap",background:"#0a0a0a",borderBottom:"1px solid #1b1b1b"}}>
              <input aria-label="Search campaigns" value={search} onChange={(e)=>{setSearch(e.target.value);setPage(1);}} placeholder="Search campaigns..." style={{flex:"1 1 220px",padding:"11px 13px",borderRadius:10,border:"1px solid #262626",background:"#111",color:"#fff"}} />
              <select aria-label="Filter campaign status" value={statusFilter} onChange={(e)=>{setStatusFilter(e.target.value);setPage(1);}} style={{padding:"11px 13px",borderRadius:10,border:"1px solid #262626",background:"#111",color:"#fff"}}>
                <option value="all">All statuses</option><option value="active">Active</option><option value="pending_review">Under review</option><option value="paused">Paused</option><option value="expired">Expired</option><option value="rejected">Rejected</option>
              </select>
            </div>
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
                      <button type="button" onClick={()=>void duplicate(task)}>Duplicate</button>
                      <button type="button" onClick={()=>void saveTemplate(task)}>Template</button>
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
            {pagination.pages > 1 && <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:14,background:"#0a0a0a"}}><button type="button" disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Previous</button><span style={{color:"#aaa",fontSize:12}}>Page {pagination.page} of {pagination.pages} · {pagination.total} campaigns</span><button type="button" disabled={page>=pagination.pages} onClick={()=>setPage(v=>v+1)}>Next</button></div>}
          </section>
        </div>
      </main>
    </>
  );
}
