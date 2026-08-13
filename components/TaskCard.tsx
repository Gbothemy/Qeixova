"use client";

import type { CSSProperties } from "react";

export type CampaignMetadata = {
  contentType?: string;
  assetName?: string;
  assetDataUrl?: string;
  assetMimeType?: string;
  contentLink?: string;
  contentCaption?: string;
  selectedPricingLabel?: string | null;
  selectedPricingOptions?: Array<{
    id: string;
    label: string;
    platform: string;
    rewardQlt: number;
    actionHint?: string;
  }>;
  selectedPricingPlatforms?: string[];
  targetLocation?: {
    mode?: string;
    country?: string;
    state?: string;
    city?: string;
    address?: string;
    summary?: string;
  };
  objective?: string;
  audience?: string[];
  selectedInterests?: string[];
  pricing?: {
    rewardPerContributorQlt?: number;
    totalCampaignCostQlt?: number;
  };
};

export interface Task {
  id: number;
  title: string;
  category: string;
  reward: number;
  duration: string;
  icon: string;
  color: string;
  instructions?: string;
  steps?: string[];
  proof_type?: string;
  proof_label?: string;
  total_budget?: number;
  budget_used?: number;
  target_completion_count?: number;
  completed?: boolean;
  completion_status?: string;
  retry_allowed?: boolean;
  attempt_count?: number;
  attempts_remaining?: number;
  mission_type?: string;
  xp_reward?: number;
  difficulty?: string;
  min_level?: number;
  lockedByLevel?: boolean;
  lockedByType?: boolean;
  matchScore?: number;
  campaign_goal?: string;
  campaign_status?: string;
  campaign_metadata?: CampaignMetadata;
  campaign_pricing?: Record<string, unknown>;
  business_name?: string;
  target_interests?: string[];
  target_platforms?: string[];
  target_states?: string[];
  task_link?: string;
}

interface TaskCardProps {
  task: Task;
  onStart: (task: Task) => void;
}

const MISSION_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  engagement: { label: "Engagement", color: "#4a9eff", bg: "rgba(74,158,255,0.12)" },
  participation: { label: "Participation", color: "#F5A623", bg: "rgba(245,166,35,0.12)" },
  premium: { label: "Premium", color: "#c084fc", bg: "rgba(192,132,252,0.12)" },
};

function joinList(values?: string[], fallback = "Not specified") {
  return values?.filter(Boolean).join(", ") || fallback;
}

export default function TaskCard({ task, onStart }: TaskCardProps) {
  const locked = task.lockedByLevel || task.lockedByType;
  const badge = MISSION_BADGE[task.mission_type ?? "engagement"] ?? MISSION_BADGE.engagement;
  const metadata = task.campaign_metadata ?? {};
  const platforms = metadata.selectedPricingPlatforms?.length ? metadata.selectedPricingPlatforms : task.target_platforms;
  const location = metadata.targetLocation?.summary || joinList(task.target_states, "Nationwide");
  const interests = metadata.selectedInterests?.length ? metadata.selectedInterests : task.target_interests;
  const matchScore = typeof task.matchScore === "number" ? Math.max(0, Math.min(100, task.matchScore)) : 100;
  const budgetPct = task.total_budget ? Math.min(100, ((task.budget_used ?? 0) / task.total_budget) * 100) : 0;
  const remainingSlots = task.target_completion_count
    ? Math.max(0, task.target_completion_count - Math.floor((task.budget_used ?? 0) / Math.max(1, task.reward)))
    : null;
  const statusLabel = task.completed
    ? task.completion_status === "pending" ? "Pending review" : "Submitted"
    : task.retry_allowed ? "Retry available"
    : locked ? `Level ${task.min_level ?? 1} required` : "Open";

  return (
    <article className={`contributorMissionCard ${task.completed ? "completed" : ""} ${locked ? "locked" : ""}`}>
      <div className="missionAccent" style={{ "--mission-color": badge.color } as CSSProperties} />

      <div className="missionHeader">
        <div className="missionIdentity">
          <div className="missionMark" style={{ "--mission-color": badge.color, "--mission-bg": badge.bg } as CSSProperties}>
            <span>{(task.category || "M").slice(0, 1).toUpperCase()}</span>
          </div>
          <div>
            <div className="missionTopline">
              <span style={{ color: badge.color, background: badge.bg }}>{badge.label}</span>
              <span>{statusLabel}</span>
              {task.business_name && <span>{task.business_name}</span>}
            </div>
            <h3>{task.title}</h3>
          </div>
        </div>

        <div className="missionReward">
          <span>Reward</span>
          <strong>+{task.reward.toLocaleString()}</strong>
          <small>QLT</small>
        </div>
      </div>

      <div className="missionBody">
        <p>{metadata.objective || task.instructions || "Review the mission details and complete the requested contributor action."}</p>

        <div className="missionDetailGrid">
          <span><strong>Goal</strong>{task.campaign_goal || task.category}</span>
          <span><strong>Channel</strong>{metadata.selectedPricingLabel || joinList(platforms)}</span>
          <span><strong>Location</strong>{location}</span>
          <span><strong>Interest</strong>{joinList(interests, "Broad audience")}</span>
        </div>

        {task.total_budget && task.total_budget > 0 && (
          <div className="missionBudget">
            <div><span style={{ width: `${budgetPct}%` }} /></div>
            <small>{remainingSlots === null ? "Campaign budget active" : `${remainingSlots.toLocaleString()} participation slots remaining`}</small>
          </div>
        )}
      </div>

      <div className="missionFooter">
        <div className="missionMeta">
          <span><strong>{matchScore}%</strong> match</span>
          <span><strong>{task.duration}</strong> duration</span>
          <span><strong>{task.proof_type || "proof"}</strong> proof</span>
        </div>
        {task.completed ? (
          <span className="missionDone">{task.completion_status === "pending" ? "Pending review" : "Submitted"}</span>
        ) : locked ? (
          <span className="missionLocked">Level {task.min_level} required</span>
        ) : (
          <button type="button" onClick={() => onStart(task)}>{task.retry_allowed ? "Retry mission" : "View mission"}</button>
        )}
      </div>

      <style jsx>{`
        .contributorMissionCard {
          position: relative;
          width: 100%;
          min-width: 0;
          display: grid;
          gap: 14px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.006)),
            var(--card-bg);
          padding: 16px 16px 14px;
          overflow: hidden;
          box-shadow: 0 12px 30px rgba(0,0,0,.22);
          color: var(--text);
        }
        .contributorMissionCard.completed,
        .contributorMissionCard.locked {
          opacity: .68;
        }
        .missionAccent {
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: var(--mission-color);
        }
        .missionHeader {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
        }
        .missionIdentity {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 12px;
          min-width: 0;
        }
        .missionMark {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--mission-color) 28%, transparent);
          border-radius: 12px;
          background: var(--mission-bg);
          color: var(--mission-color);
          font-weight: 950;
          flex-shrink: 0;
        }
        .missionBody {
          min-width: 0;
        }
        .missionTopline {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 7px;
        }
        .missionTopline span {
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--card-bg);
          color: var(--muted);
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          white-space: nowrap;
        }
        h3 {
          margin: 0;
          color: var(--text);
          font-size: 17px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }
        p {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .missionReward {
          min-width: 106px;
          border: 1px solid var(--reward-border, rgba(26,239,34,.18));
          border-radius: 12px;
          background: var(--reward-bg, rgba(26,239,34,.06));
          padding: 10px 12px;
          text-align: right;
        }
        .missionReward span,
        .missionReward small {
          display: block;
          color: var(--muted);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .missionReward strong {
          display: block;
          color: var(--accent);
          font-size: 19px;
          line-height: 1.1;
          margin-top: 3px;
        }
        .missionDetailGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }
        .missionDetailGrid span {
          min-width: 0;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--card-bg);
          color: var(--muted);
          padding: 9px;
          font-size: 11px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .missionDetailGrid span:last-child {
          grid-column: 1 / -1;
          min-height: 0;
          max-height: 66px;
          overflow: hidden;
        }
        .missionDetailGrid strong {
          display: block;
          color: var(--muted);
          font-size: 10px;
          text-transform: uppercase;
          margin-bottom: 3px;
        }
        .missionBudget {
          display: grid;
          gap: 6px;
          margin-top: 12px;
        }
        .missionBudget div {
          height: 5px;
          border-radius: 999px;
          background: var(--border);
          overflow: hidden;
        }
        .missionBudget div span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
        }
        .missionBudget small,
        .missionMeta span {
          color: var(--muted);
          font-size: 11px;
        }
        .missionFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-top: 1px solid var(--border);
          padding-top: 12px;
        }
        .missionMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }
        .missionMeta span {
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--card-bg);
          padding: 5px 8px;
        }
        .missionMeta strong {
          color: var(--text);
        }
        .missionFooter button,
        .missionDone,
        .missionLocked {
          border: 0;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }
        .missionFooter button {
          background: var(--accent-2);
          color: #000;
          cursor: pointer;
        }
        .missionDone {
          background: var(--mission-done-bg, rgba(245,166,35,.1));
          color: var(--accent-2);
        }
        .missionLocked {
          background: var(--mission-locked-bg, rgba(255,255,255,.06));
          color: var(--muted);
        }
        @media (max-width: 720px) {
          .missionHeader {
            grid-template-columns: 1fr;
          }
          .missionReward {
            width: 100%;
            text-align: left;
          }
          .missionFooter {
            align-items: stretch;
            flex-direction: column;
          }
          .missionFooter button,
          .missionDone,
          .missionLocked {
            width: 100%;
            text-align: center;
          }
          .missionDetailGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .missionDetailGrid span:nth-child(3),
          .missionDetailGrid span:last-child {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 420px) {
          .missionDetailGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </article>
  );
}
