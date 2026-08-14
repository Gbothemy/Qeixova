"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Campaign = {
  id: number | null;
  task_id: number;
  business_name?: string;
  business_email?: string;
  title: string;
  mission_category: string;
  campaign_goal: string;
  description?: string;
  status: string;
  total_slots: number;
  filled_slots: number;
  completed_slots: number;
  approved_slots: number;
  rejected_slots: number;
  total_budget: number;
  reserved_budget: number;
  platform_commission: number;
  verification_fee: number;
  created_at: string;
  start_date?: string | null;
  end_date?: string | null;
  duration?: string;
  task_reward?: number;
  task_link?: string;
  target_interests?: string[];
  target_platforms?: string[];
  target_states?: string[];
  metadata?: CampaignMetadata;
  task_metadata?: CampaignMetadata;
  submissions_count?: number;
  pending_review_count?: number;
  approved_count?: number;
  rejected_count?: number;
  disputed_count?: number;
};

type CampaignMetadata = {
  contentType?: string;
  contentLink?: string;
  assetName?: string;
  assetDataUrl?: string;
  assetMimeType?: string;
  contentCaption?: string;
  selectedPricingLabel?: string;
  selectedPricingPlatforms?: string[];
  selectedInterests?: string[];
  targetLocation?: { summary?: string };
  objective?: string;
  rejectionReason?: string;
};

type SubmittedContent = {
  metadata: CampaignMetadata;
  contentType: string;
  contentLink: string;
  validContentLink: string;
  isImageLink: boolean;
  assetName: string;
  assetDataUrl: string;
  assetMimeType: string;
  contentCaption: string;
  isImageAsset: boolean;
  instructions: string[];
};

const FILTERS = [
  { value: "pending_review", label: "Pending Review" },
  { value: "live", label: "Live" },
  { value: "paused", label: "Paused" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
];

const statusColors: Record<string, { bg: string; color: string }> = {
  pending_review: { bg: "#fff8e1", color: "#b77900" },
  live: { bg: "#e8f5e9", color: "#2e7d32" },
  paused: { bg: "#eef2ff", color: "#3f51b5" },
  rejected: { bg: "#fce4ec", color: "#c62828" },
  closed: { bg: "#f3f4f6", color: "#4b5563" },
  expired: { bg: "#f3f4f6", color: "#6b7280" },
};

function formatTimeLeft(endDate: string | null | undefined, now: number) {
  if (!endDate) return "Timer unavailable";
  const remaining = new Date(endDate).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "Expired";

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return days > 0
    ? `${days}d ${hours}h ${minutes}m left`
    : `${hours}h ${minutes}m ${seconds}s left`;
}

function list(values: string[] | undefined, fallback = "None") {
  return values?.length ? values.join(", ") : fallback;
}

function location(campaign: Campaign) {
  return campaign.task_metadata?.targetLocation?.summary || list(campaign.target_states, "Nationwide");
}

function interests(campaign: Campaign) {
  return list(campaign.task_metadata?.selectedInterests?.length ? campaign.task_metadata.selectedInterests : campaign.target_interests, "Broad audience");
}

function platforms(campaign: Campaign) {
  return campaign.task_metadata?.selectedPricingLabel || list(campaign.task_metadata?.selectedPricingPlatforms?.length ? campaign.task_metadata.selectedPricingPlatforms : campaign.target_platforms, "All platforms");
}

function normalizeUrl(value: string) {
  if (!value.trim()) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function isImageUrl(value: string) {
  return /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(value);
}

function getSubmittedContent(campaign: Campaign): SubmittedContent {
  const metadata = campaign.task_metadata ?? campaign.metadata ?? {};
  const contentLink = metadata.contentLink || campaign.task_link || "";
  const validContentLink = contentLink ? normalizeUrl(contentLink) : "";
  const assetDataUrl = typeof metadata.assetDataUrl === "string" ? metadata.assetDataUrl : "";
  const assetMimeType = typeof metadata.assetMimeType === "string" ? metadata.assetMimeType : "";

  return {
    metadata,
    contentType: metadata.contentType || campaign.mission_category,
    contentLink,
    validContentLink,
    isImageLink: Boolean(validContentLink && isImageUrl(validContentLink)),
    assetName: metadata.assetName || "",
    assetDataUrl,
    assetMimeType,
    contentCaption: typeof metadata.contentCaption === "string" ? metadata.contentCaption.trim() : "",
    isImageAsset: assetDataUrl.startsWith("data:image/"),
    instructions: (campaign.description || "").split("\n").map((line) => line.trim()).filter(Boolean),
  };
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [status, setStatus] = useState("pending_review");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<Campaign | null>(null);
  const [reason, setReason] = useState("Campaign needs edits before it can go live.");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(`/api/admin/campaigns${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load campaigns");
      setCampaigns(data.campaigns ?? []);
    } catch (error) {
      setCampaigns([]);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load campaigns" });
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void fetchCampaigns(); }, [fetchCampaigns]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const counts = useMemo(() => ({
    pending: campaigns.filter((campaign) => campaign.status === "pending_review").length,
    live: campaigns.filter((campaign) => campaign.status === "live").length,
    rejected: campaigns.filter((campaign) => campaign.status === "rejected").length,
  }), [campaigns]);

  async function campaignAction(campaign: Campaign, action: "approve" | "pause" | "resume" | "reject" | "close", actionReason?: string) {
    setActionLoading(campaign.task_id);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id, taskId: campaign.task_id, action, reason: actionReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Campaign action failed");
      setRejecting(null);
      const labels = { approve: "approved and launched", pause: "paused", resume: "resumed", reject: "rejected", close: "closed" };
      setNotice({ type: "success", message: `Campaign ${labels[action]} successfully.` });
      await fetchCampaigns();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Campaign action failed" });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="adminPage">
      <section className="adminPageHeader">
        <div>
          <p className="adminEyebrow">Business campaign review</p>
          <h1>Business Campaign Review</h1>
          <p>Approve campaigns before they go live, or reject and send the business a clear reason.</p>
        </div>
      </section>

      <div className="adminFilterBar" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            onClick={() => setStatus(filter.value)}
            style={{
              border: status === filter.value ? "1px solid #111" : "1px solid #e5e5e5",
              background: status === filter.value ? "#111" : "#fff",
              color: status === filter.value ? "#fff" : "#555",
              borderRadius: 999,
              padding: "9px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className={`adminResult${notice.type === "error" ? " error" : ""}`}>
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)}>x</button>
        </div>
      )}

      <div className="adminGrid" style={{ marginBottom: 20 }}>
        <div className="adminStatCard" style={{ "--accent": "#F5A623" } as React.CSSProperties}>
          <span>Pending in View</span>
          <strong>{counts.pending}</strong>
          <small>Need admin decision</small>
        </div>
        <div className="adminStatCard" style={{ "--accent": "#22C55E" } as React.CSSProperties}>
          <span>Live in View</span>
          <strong>{counts.live}</strong>
          <small>Visible to contributors</small>
        </div>
        <div className="adminStatCard" style={{ "--accent": "#EF4444" } as React.CSSProperties}>
          <span>Rejected in View</span>
          <strong>{counts.rejected}</strong>
          <small>Returned to businesses</small>
        </div>
      </div>

      {loading ? (
        <div className="adminPanel">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="adminPanel">No campaigns found for this filter.</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {campaigns.map((campaign) => {
            const colors = statusColors[campaign.status] ?? statusColors.closed;
            const submittedContent = getSubmittedContent(campaign);
            return (
              <article key={`${campaign.id ?? "task"}-${campaign.task_id}`} className="adminPanel" style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: colors.bg, color: colors.color, fontSize: 12, fontWeight: 800 }}>
                      {campaign.status.replace("_", " ")}
                    </span>
                    <h2 style={{ margin: "10px 0 4px", fontSize: 19, color: "#111" }}>{campaign.title}</h2>
                    <p style={{ margin: 0, color: "#5f6876", fontSize: 13 }}>{campaign.business_name || "Business"} · {campaign.business_email || "No email"} · Task #{campaign.task_id}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ display: "block", color: "#111" }}>{Number(campaign.total_budget).toLocaleString()} QLT</strong>
                    <span style={{ color: "#5f6876", fontSize: 12 }}>{Number(campaign.task_reward ?? 0).toLocaleString()} QLT per contributor</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <Info label="Goal" value={campaign.campaign_goal} />
                  <Info label="Category" value={campaign.mission_category} />
                  <Info label="Location" value={location(campaign)} />
                  <Info label="Interests" value={interests(campaign)} />
                  <Info label="Platforms" value={platforms(campaign)} />
                  <Info label="Campaign Window" value={campaign.duration || "Not set"} />
                  <Info
                    label="Time Left"
                    value={campaign.status === "pending_review"
                      ? "Starts after admin approval"
                      : formatTimeLeft(campaign.end_date, now)}
                  />
                  <Info label="Slots" value={`${campaign.approved_slots}/${campaign.total_slots} approved`} />
                  <Info label="Proof Queue" value={`${campaign.pending_review_count ?? 0} pending · ${campaign.disputed_count ?? 0} disputed`} />
                </div>

                <SubmittedContentPreview content={submittedContent} taskId={campaign.task_id} />

                {campaign.status === "rejected" && campaign.task_metadata?.rejectionReason ? (
                  <div style={{ background: "#fff4f4", border: "1px solid #ffd3d3", borderRadius: 10, padding: 12, color: "#9b1c1c", fontSize: 13, lineHeight: 1.45 }}>
                    <strong style={{ display: "block", marginBottom: 4 }}>Reason sent to business</strong>
                    {campaign.task_metadata.rejectionReason}
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {campaign.status === "pending_review" && (
                    <>
                      <button type="button" onClick={() => campaignAction(campaign, "approve", "Approved by admin")} disabled={actionLoading === campaign.task_id} style={primaryButton("#1AEF22", "#000")}>Approve & Launch</button>
                      <button type="button" onClick={() => setRejecting(campaign)} disabled={actionLoading === campaign.task_id} style={primaryButton("#fce4ec", "#c62828")}>Reject</button>
                    </>
                  )}
                  {campaign.status === "live" && (
                    <button type="button" onClick={() => campaignAction(campaign, "pause", "Paused by admin")} disabled={actionLoading === campaign.task_id} style={primaryButton("#fff8e1", "#b77900")}>Pause</button>
                  )}
                  {campaign.status === "paused" && (
                    <button type="button" onClick={() => campaignAction(campaign, "resume", "Resumed by admin")} disabled={actionLoading === campaign.task_id} style={primaryButton("#1AEF22", "#000")}>Resume</button>
                  )}
                  {["live", "paused"].includes(campaign.status) && (
                    <button type="button" onClick={() => campaignAction(campaign, "close", "Closed by admin")} disabled={actionLoading === campaign.task_id} style={primaryButton("#f5f5f5", "#555")}>Close</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {rejecting && (
        <div className="adminModalBackdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={(event) => { if (event.target === event.currentTarget) setRejecting(null); }}>
          <div className="adminModalCard" style={{ width: "min(460px, calc(100vw - 32px))", background: "#fff", borderRadius: 16, padding: 22 }}>
            <h2 style={{ margin: "0 0 6px", color: "#111" }}>Reject business campaign</h2>
            <p style={{ margin: "0 0 16px", color: "#5f6876", fontSize: 13 }}>{rejecting.title}</p>
            <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#4b5563", textTransform: "uppercase", marginBottom: 6 }}>Message to business</label>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tell the business exactly what to fix before resubmitting." style={{ width: "100%", minHeight: 120, border: "1px solid #ddd", borderRadius: 10, padding: 12, resize: "vertical" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setRejecting(null)} style={primaryButton("#f5f5f5", "#555")}>Cancel</button>
              <button type="button" onClick={() => campaignAction(rejecting, "reject", reason)} disabled={actionLoading === rejecting.task_id || !reason.trim()} style={primaryButton("#c62828", "#fff")}>Reject Campaign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
      <span style={{ display: "block", color: "#4b5563", fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 5 }}>{label}</span>
      <strong style={{ color: "#222", fontSize: 13, lineHeight: 1.4 }}>{value || "Not set"}</strong>
    </div>
  );
}

function SubmittedContentPreview({ content, taskId }: { content: SubmittedContent; taskId: number }) {
  const hasVisualPreview = content.isImageAsset || content.isImageLink;
  const hasSubmittedFile = Boolean(content.assetName || content.assetDataUrl);
  const hasReviewEvidence = Boolean(content.validContentLink || hasSubmittedFile || content.instructions.length || content.metadata.objective || content.contentCaption);

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, border: "1px solid #d9eadb", borderRadius: 12, background: "#fbfffb", padding: 14 }}>
      <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
        <span style={{ color: "#166534", fontSize: 11, fontWeight: 900, letterSpacing: 0, textTransform: "uppercase" }}>Content preview for review</span>

        {hasVisualPreview ? (
          <a href={content.assetDataUrl || content.validContentLink} target="_blank" rel="noreferrer" style={{ display: "block", border: "1px solid #d8e7d8", borderRadius: 10, background: "#fff", padding: 8 }}>
            <img
              src={content.assetDataUrl || content.validContentLink}
              alt={content.assetName || "Submitted campaign content"}
              style={{ display: "block", width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 7, background: "#f8faf8" }}
            />
          </a>
        ) : (
          <div style={{ minHeight: 160, display: "grid", placeItems: "center", alignContent: "center", gap: 8, border: "1px dashed #cfe3d1", borderRadius: 10, background: "#fff", padding: 18, textAlign: "center" }}>
            <strong style={{ color: "#111", fontSize: 15 }}>{hasSubmittedFile ? "File submitted" : content.validContentLink ? "Link submitted" : "No visual preview"}</strong>
            <span style={{ color: "#667085", fontSize: 13, lineHeight: 1.45 }}>
              {hasSubmittedFile ? content.assetName : content.validContentLink ? "Open the submitted content link to inspect it." : "The business did not attach a previewable image or file."}
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {content.validContentLink ? (
            <a href={content.validContentLink} target="_blank" rel="noreferrer" style={linkButtonStyle}>
              Open submitted link
            </a>
          ) : null}
          {content.assetDataUrl ? (
            <a href={content.assetDataUrl} download={content.assetName || "campaign-asset"} style={linkButtonStyle}>
              Download submitted {content.assetMimeType.startsWith("image/") ? "image" : "file"}
            </a>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <div>
          <span style={{ display: "block", color: "#6b7280", fontSize: 11, fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>Submitted by business</span>
          <strong style={{ color: "#111", fontSize: 16 }}>{content.contentType}</strong>
        </div>

        {content.metadata.objective ? (
          <p style={{ margin: 0, color: "#222", lineHeight: 1.5, fontWeight: 700 }}>{content.metadata.objective}</p>
        ) : null}

        {content.contentCaption ? (
          <div style={{ border: "1px solid #f5d28d", borderRadius: 10, background: "#fff8e8", padding: 11 }}>
            <span style={{ display: "block", color: "#8a5a00", fontSize: 11, fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>Caption for contributors</span>
            <p style={{ margin: 0, color: "#2f250f", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{content.contentCaption}</p>
          </div>
        ) : null}

        {content.assetName ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", padding: 11 }}>
            <span style={{ display: "block", color: "#6b7280", fontSize: 11, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>Uploaded asset</span>
            <strong style={{ color: "#222", fontSize: 13, overflowWrap: "anywhere" }}>{content.assetName}</strong>
          </div>
        ) : null}

        {content.validContentLink ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", padding: 11 }}>
            <span style={{ display: "block", color: "#6b7280", fontSize: 11, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>Submitted URL</span>
            <a href={content.validContentLink} target="_blank" rel="noreferrer" style={{ color: "#0f7a17", fontSize: 13, fontWeight: 800, overflowWrap: "anywhere" }}>{content.contentLink}</a>
          </div>
        ) : null}

        {content.instructions.length ? (
          <div style={{ display: "grid", gap: 7 }}>
            <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>Business instructions</span>
            {content.instructions.map((line, index) => (
              <p key={`${taskId}-instruction-${index}`} style={{ margin: 0, color: "#444", fontSize: 13, lineHeight: 1.45, overflowWrap: "anywhere" }}>{line}</p>
            ))}
          </div>
        ) : null}

        {!hasReviewEvidence ? (
          <p style={{ margin: 0, color: "#9b1c1c", fontSize: 13, fontWeight: 800 }}>No submitted content was found for this campaign. Reject it and ask the business to attach the content before approval.</p>
        ) : null}
      </div>
    </section>
  );
}

function primaryButton(background: string, color: string): CSSProperties {
  return {
    border: 0,
    borderRadius: 9,
    padding: "9px 13px",
    background,
    color,
    fontWeight: 800,
    cursor: "pointer",
  };
}

const linkButtonStyle: CSSProperties = {
  width: "fit-content",
  border: "1px solid #b7dfbc",
  borderRadius: 9,
  background: "#f0fdf4",
  color: "#166534",
  padding: "8px 10px",
  fontSize: 13,
  fontWeight: 900,
  textDecoration: "none",
};
