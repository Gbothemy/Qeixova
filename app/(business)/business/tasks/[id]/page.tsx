"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import BusinessLoading from "@/components/BusinessLoading";
import BusinessSidebar from "@/components/BusinessSidebar";

interface Completion {
  id: number;
  full_name: string;
  email: string;
  status: string;
  completed_at: string;
  rejection_reason: string | null;
  proof_summary?: {
    hasProof?: boolean;
    hasScreenshots?: boolean;
    selectedPlatforms?: ProofPlatform[];
  };
  qlt_awarded?: number;
}

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
  rejected_completions: number;
  target_completion_count: number;
  created_at: string;
  campaign_metadata?: { rejectionReason?: string };
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: "rgba(245,166,35,0.08)", color: "#F5A623" },
  approved: { bg: "rgba(26,239,34,0.08)", color: "#1AEF22" },
  rejected: { bg: "rgba(229,62,62,0.08)", color: "#e53e3e" },
};

type ProofPlatform = { id: string; label: string; platform: string; rewardQlt: number };

function PlatformChips({ platforms }: { platforms: ProofPlatform[] }) {
  if (platforms.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
      {platforms.map((platform) => (
        <span key={platform.id} style={{ border: "1px solid rgba(245,166,35,0.18)", background: "rgba(245,166,35,0.08)", color: "#F5A623", borderRadius: 999, padding: "3px 7px", fontSize: 10, fontWeight: 900 }}>
          {platform.platform} - {platform.rewardQlt.toLocaleString()} QLT
        </span>
      ))}
    </div>
  );
}

function ProofSummary({ summary }: { summary?: Completion["proof_summary"] }) {
  if (!summary?.hasProof) return null;
  const platforms = summary.selectedPlatforms || [];

  return (
    <div style={{ marginTop: 6 }}>
      <p style={{ fontSize: 11, color: "#aaa", lineHeight: 1.45 }}>
        Proof submitted. Screenshot evidence is private and available only to admin reviewers.
      </p>
      <PlatformChips platforms={platforms} />
    </div>
  );
}

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [business, setBusiness] = useState<{ name: string } | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<Completion | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(() => {
    fetch(`/api/business/tasks/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setTask(data.task);
          setCompletions(data.completions);
        }
      });
  }, [id]);

  useEffect(() => {
    fetch("/api/business/me")
      .then((res) => {
        if (!res.ok) {
          router.push("/business/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.business) setBusiness(data.business);
      });
    load();
  }, [load, router]);

  const handleAction = async (action: string) => {
    setActionLoading(true);
    await fetch(`/api/business/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActionLoading(false);
    load();
  };

  const handleReview = async (completionId: number, action: "approve" | "reject", rejectionReason?: string) => {
    setReviewingId(completionId);
    await fetch(`/api/business/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, completionId, rejectionReason }),
    });
    setReviewingId(null);
    setRejecting(null);
    setRejectReason("");
    load();
  };

  if (!business || !task) {
    return (
      <BusinessLoading
        title="Loading campaign details"
        detail="Opening performance, submissions, and review controls."
      />
    );
  }

  const progress = task.target_completion_count > 0 ? Math.min((task.approved_completions / task.target_completion_count) * 100, 100) : 0;
  const taskStatus = task.status === "pending_review"
    ? { label: "Under Review", color: "#F5A623", bg: "rgba(245,166,35,0.08)", dot: "#F5A623" }
    : task.status === "rejected"
      ? { label: "Rejected", color: "#e53e3e", bg: "rgba(229,62,62,0.08)", dot: "#e53e3e" }
    : task.is_active
      ? { label: "Active", color: "#1AEF22", bg: "rgba(26,239,34,0.08)", dot: "#1AEF22" }
      : { label: "Paused", color: "#bbb", bg: "rgba(255,255,255,0.04)", dot: "#bbb" };

  return (
    <>
      <BusinessSidebar name={business.name} />
      <main className="page-body business-page-pro">
        <Link href="/business/tasks" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#aaa", textDecoration: "none", marginBottom: 20, padding: "6px 12px", background: "#0a0a0a", borderRadius: 8, border: "1px solid #161616" }}>
          <Image src="/icon-home.svg" alt="Back" width={12} height={12} style={{ objectFit: "contain", opacity: 0.4 }} />
          Back to Campaigns
        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#F5F5F5" }}>{task.title}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 5, background: taskStatus.bg, borderRadius: 20, padding: "4px 10px" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: taskStatus.dot }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: taskStatus.color }}>{taskStatus.label}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#aaa" }}>{task.category}</span>
              <span style={{ fontSize: 12, color: "#F5A623", fontWeight: 600 }}>{task.reward.toLocaleString()} QLT / completion</span>
              <span style={{ fontSize: 11, color: "#bbb" }}>Created {new Date(task.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          {!["pending_review", "rejected"].includes(task.status) && (
            <button type="button" onClick={() => handleAction(task.is_active ? "pause" : "resume")} disabled={actionLoading} style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${task.is_active ? "rgba(229,62,62,0.15)" : "rgba(26,239,34,0.15)"}`, background: task.is_active ? "rgba(229,62,62,0.08)" : "rgba(26,239,34,0.08)", color: task.is_active ? "#e53e3e" : "#1AEF22", fontWeight: 700, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
              {task.is_active ? "Pause" : "Resume"}
            </button>
          )}
        </div>

        {task.status === "rejected" && task.campaign_metadata?.rejectionReason && (
          <div style={{ background: "rgba(229,62,62,0.08)", border: "1px solid rgba(229,62,62,0.22)", borderRadius: 14, padding: "13px 16px", marginBottom: 20 }}>
            <p style={{ color: "#e53e3e", fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Admin rejection reason</p>
            <p style={{ color: "#ddd", fontSize: 13, lineHeight: 1.5 }}>{task.campaign_metadata.rejectionReason}</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Submissions", value: task.total_completions, color: "#4a9eff", icon: "/icon-task.svg" },
            { label: "Approved", value: task.approved_completions, color: "#1AEF22", icon: "/icon-wallet.svg" },
            { label: "Pending", value: task.pending_completions, color: "#F5A623", icon: "/icon-survey.svg" },
            { label: "Rejected", value: task.rejected_completions, color: "#e53e3e", icon: "/icon-app-testing.svg" },
          ].map((item) => (
            <div key={item.label} style={{ background: "#0a0a0a", borderRadius: 14, padding: "14px", border: "1px solid #161616", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: item.color }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Image src={item.icon} alt={item.label} width={12} height={12} style={{ objectFit: "contain", opacity: 0.35 }} />
                <p style={{ fontSize: 10, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>{item.label}</p>
              </div>
              <p style={{ fontSize: 24, fontWeight: 900, color: "#F5F5F5", letterSpacing: 0 }}>{item.value}</p>
            </div>
          ))}
        </div>

        {task.target_completion_count > 0 && (
          <div style={{ background: "#0a0a0a", borderRadius: 14, padding: "16px 18px", border: "1px solid #161616", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#F5F5F5" }}>Campaign Progress</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#F5A623" }}>{task.approved_completions} / {task.target_completion_count}</p>
            </div>
            <div style={{ height: 6, background: "#111", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #F5A623, #1AEF22)", borderRadius: 10, transition: "width 0.4s" }} />
            </div>
            <p style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>{Math.round(progress)}% of target reached</p>
          </div>
        )}

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#F5F5F5" }}>Submissions</p>
            <span style={{ fontSize: 12, color: "#aaa", background: "#0a0a0a", border: "1px solid #161616", borderRadius: 20, padding: "3px 10px" }}>{completions.length} total</span>
          </div>
          {task.pending_completions > 0 && (
            <div style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
              <p style={{ color: "#F5A623", fontSize: 12, fontWeight: 800, marginBottom: 3 }}>Verification queue</p>
              <p style={{ color: "#aaa", fontSize: 12, lineHeight: 1.5 }}>Proof screenshots are private to admin reviewers. Use admin proof approval for evidence inspection.</p>
            </div>
          )}
          {completions.length === 0 ? (
            <div style={{ background: "#0a0a0a", borderRadius: 14, padding: "36px", textAlign: "center", border: "1px solid #161616" }}>
              <Image src="/icon-survey.svg" alt="" width={36} height={36} style={{ objectFit: "contain", opacity: 0.15, marginBottom: 12 }} />
              <p style={{ color: "#bbb", fontSize: 13 }}>No submissions yet. Share your campaign to get started.</p>
            </div>
          ) : (
            <div style={{ background: "#0a0a0a", borderRadius: 14, border: "1px solid #161616", overflow: "hidden" }}>
              {completions.map((completion, index) => {
                const statusColor = STATUS_COLORS[completion.status] ?? STATUS_COLORS.pending;
                return (
                  <div key={completion.id} style={{ padding: "13px 16px", borderBottom: index < completions.length - 1 ? "1px solid #111" : "none", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Image src="/icon-profile.svg" alt="" width={16} height={16} style={{ objectFit: "contain", opacity: 0.3 }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#F5F5F5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{completion.full_name}</p>
                        <p style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{completion.email} - {new Date(completion.completed_at).toLocaleDateString()}</p>
                        <ProofSummary summary={completion.proof_summary} />
                        {typeof completion.qlt_awarded === "number" && (
                          <p style={{ fontSize: 11, color: "#1AEF22", marginTop: 4, fontWeight: 800 }}>
                            Selected reward: {completion.qlt_awarded.toLocaleString()} QLT
                          </p>
                        )}
                        {completion.rejection_reason && <p style={{ fontSize: 11, color: "#e53e3e", marginTop: 2 }}>Reason: {completion.rejection_reason}</p>}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: statusColor.bg, color: statusColor.color, flexShrink: 0 }}>
                        {completion.status}
                      </span>
                      {completion.status === "pending" && (
                        <>
                          <button type="button" disabled={reviewingId === completion.id} onClick={() => handleReview(completion.id, "approve")} style={{ border: "1px solid rgba(26,239,34,0.22)", background: "rgba(26,239,34,0.08)", color: "#1AEF22", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Approve</button>
                          <button type="button" disabled={reviewingId === completion.id} onClick={() => setRejecting(completion)} style={{ border: "1px solid rgba(229,62,62,0.2)", background: "rgba(229,62,62,0.08)", color: "#e53e3e", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Reject</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {rejecting && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "grid", placeItems: "center", padding: 18, zIndex: 100 }}>
          <div style={{ width: "min(100%, 430px)", background: "#0a0a0a", border: "1px solid #222", borderRadius: 18, padding: 18 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#F5F5F5", marginBottom: 6 }}>Reject submission</p>
            <p style={{ fontSize: 12, color: "#aaa", lineHeight: 1.5, marginBottom: 12 }}>Give {rejecting.full_name} a clear reason so they can improve future proof quality.</p>
            <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows={4} placeholder="Example: Screenshot does not show the required repost or timestamp." style={{ width: "100%", border: "1px solid #333", borderRadius: 12, background: "#111", color: "#F5F5F5", padding: 12, fontSize: 13, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" onClick={() => setRejecting(null)} style={{ border: "1px solid #2a2a2a", background: "#111", color: "#ccc", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>Cancel</button>
              <button type="button" onClick={() => handleReview(rejecting.id, "reject", rejectReason)} disabled={reviewingId === rejecting.id} style={{ border: "none", background: "#e53e3e", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
