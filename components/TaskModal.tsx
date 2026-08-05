"use client";

import { useRef, useState } from "react";
import type { CampaignMetadata } from "./TaskCard";
import { getBusinessPlatformRewardQlt } from "@/lib/campaignPlatformPricing";

const MAX_PROOF_IMAGE_BYTES = 2.5 * 1024 * 1024;

export interface FullTask {
  id: number;
  title: string;
  category: string;
  reward: number;
  duration: string;
  icon: string;
  color: string;
  instructions: string;
  steps: string[];
  proof_type: "screenshot" | "url" | "text" | "none";
  proof_label: string;
  max_screenshots: number;
  total_budget: number;
  budget_used: number;
  target_completion_count?: number;
  task_link: string;
  completed: boolean;
  completion_status?: string;
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
}

interface Props {
  task: FullTask;
  onClose: () => void;
  onComplete: (id: number, proofValue: string) => Promise<{ ok: boolean; error?: string }>;
}

function StepText({ text }: { text: string }) {
  const urlRe = /(https?:\/\/[^\s]+|(?:www\.|(?:youtube|facebook|tiktok|instagram|x|twitter)\.com)[^\s]*)/gi;
  const parts = text.split(urlRe);
  return (
    <span>
      {parts.map((part, i) => {
        const isUrl = urlRe.test(part) || /^(www\.|(?:youtube|facebook|tiktok|instagram|x|twitter)\.com)/.test(part);
        if (!isUrl) return <span key={i}>{part}</span>;
        const href = part.startsWith("http") ? part : `https://${part}`;
        return <a key={i} href={href} target="_blank" rel="noopener noreferrer">{part}</a>;
      })}
    </span>
  );
}

function list(values?: string[], fallback = "Not specified") {
  return values?.filter(Boolean).join(", ") || fallback;
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <article
      className="detailCard"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(112px, .42fr) minmax(0, 1fr)",
        gap: 12,
        alignItems: "start",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--card-bg)",
        padding: 12,
        minWidth: 0,
      }}
    >
      <span
        className="detailLabel"
        style={{
          color: "var(--muted)",
          fontSize: 10,
          fontWeight: 900,
          textTransform: "uppercase",
          lineHeight: 1.35,
        }}
      >
        {label}
      </span>
      <strong
        className="detailValue"
        style={{
          color: "var(--text)",
          fontSize: 13,
          lineHeight: 1.45,
          overflowWrap: "anywhere",
        }}
      >
        {value || "Not specified"}
      </strong>
    </article>
  );
}

function isFinalProofStep(step: string) {
  return /^submit\b/i.test(step.trim()) && /(proof|screenshot|response|feedback)/i.test(step);
}

function orderContributorSteps(steps: string[]) {
  const seen = new Set<string>();
  const uniqueSteps = steps
    .map((step) => step.trim())
    .filter((step) => {
      if (!step) return false;
      const key = step.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const finalProofSteps = uniqueSteps.filter(isFinalProofStep);
  const actionSteps = uniqueSteps.filter((step) => !isFinalProofStep(step));
  return [...actionSteps, ...finalProofSteps];
}

function splitRewardAcrossPlatforms(totalReward: number, platformCount: number) {
  const total = Math.max(0, Math.round(Number(totalReward) || 0));
  const count = Math.max(1, platformCount);
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export default function TaskModal({ task, onClose, onComplete }: Props) {
  const [phase, setPhase] = useState<"details" | "proof" | "success">("details");
  const [proofValue, setProofValue] = useState("");
  const [screenshots, setScreenshots] = useState<{ dataUrl: string; name: string }[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const metadata = task.campaign_metadata ?? {};
  const maxShots = task.max_screenshots ?? 1;
  const platforms = metadata.selectedPricingPlatforms?.length ? metadata.selectedPricingPlatforms : task.target_platforms;
  const platformOptions = metadata.selectedPricingOptions?.length
    ? metadata.selectedPricingOptions.map((option) => ({
      id: option.id,
      label: option.label || option.platform,
      platform: option.platform || option.label,
      rewardQlt: Math.max(0, Math.round(Number(option.rewardQlt) || 0)),
    }))
    : (platforms ?? []).filter(Boolean).map((platform, index, arr) => ({
      id: `platform-${index}`,
      label: platform,
      platform,
      rewardQlt: getBusinessPlatformRewardQlt(platform) ?? splitRewardAcrossPlatforms(Number(task.reward), arr.length)[index],
    }));
  const activePlatformIds = selectedPlatformIds.filter((id) => platformOptions.some((option) => option.id === id));
  const selectedPlatformOptions = platformOptions.filter((option) => activePlatformIds.includes(option.id));
  const selectedReward = selectedPlatformOptions.length > 0
    ? selectedPlatformOptions.reduce((total, option) => total + option.rewardQlt, 0)
    : 0;
  const displayedSubmitReward = platformOptions.length > 0 ? selectedReward : task.reward;
  const requiredScreenshotCount = platformOptions.length > 0 ? Math.max(1, activePlatformIds.length) : maxShots;
  const visibleScreenshots = screenshots.slice(0, requiredScreenshotCount);
  const location = metadata.targetLocation?.summary || list(task.target_states, "Nationwide");
  const rawCampaignLink = metadata.contentLink || task.task_link;
  const campaignLink = /^https?:\/\//i.test(rawCampaignLink || "") ? rawCampaignLink : "";
  const contentCaption = typeof metadata.contentCaption === "string" ? metadata.contentCaption.trim() : "";
  const assetDataUrl = typeof metadata.assetDataUrl === "string" ? metadata.assetDataUrl : "";
  const assetMimeType = typeof metadata.assetMimeType === "string" ? metadata.assetMimeType : "";
  const isImageAsset = assetDataUrl.startsWith("data:image/");
  const actionSteps = orderContributorSteps(task.steps?.length ? task.steps : task.instructions.split("\n").filter(Boolean));
  const matchScore = typeof task.matchScore === "number" ? Math.max(0, Math.min(100, task.matchScore)) : 100;
  const remainingSlots = task.target_completion_count
    ? Math.max(0, task.target_completion_count - Math.floor((task.budget_used ?? 0) / Math.max(1, task.reward)))
    : null;
  const compactDetailStyle = `
    @media (max-width: 520px) {
      .detailCard {
        grid-template-columns: 1fr !important;
        gap: 5px !important;
      }
    }
  `;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    files.forEach((file) => {
      if (file.size > MAX_PROOF_IMAGE_BYTES) {
        setError("Upload screenshots under 2.5MB each so admin can preview them.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshots((prev) => prev.length >= requiredScreenshotCount ? prev : [...prev, { dataUrl: reader.result as string, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  const handlePlatformToggle = (optionId: string, checked: boolean) => {
    const next = checked ? selectedPlatformIds.filter((id) => id !== optionId) : [...selectedPlatformIds, optionId];
    setSelectedPlatformIds(next);
    if (next.length > 0 && error === "Select at least one platform you completed this mission on.") {
      setError("");
    }
  };

  const handleSubmit = async () => {
    let finalProof = proofValue.trim();
    if (platformOptions.length > 0 && activePlatformIds.length < 1) {
      setError("Select at least one platform you completed this mission on.");
      return;
    }
    const selectedPlatformPayload = selectedPlatformOptions.map((option) => ({
      id: option.id,
      label: option.label,
      platform: option.platform,
      rewardQlt: option.rewardQlt,
    }));
    if (task.proof_type === "screenshot") {
      if (screenshots.length < requiredScreenshotCount) {
        setError(`Please upload ${requiredScreenshotCount} screenshot${requiredScreenshotCount > 1 ? "s" : ""} before submitting.`);
        return;
      }
      finalProof = JSON.stringify({
        type: "screenshots",
        selectedPlatforms: selectedPlatformPayload,
        rewardQlt: displayedSubmitReward,
        screenshots: screenshots.slice(0, requiredScreenshotCount).map((shot) => ({
          name: shot.name,
          dataUrl: shot.dataUrl,
        })),
      });
    } else if (task.proof_type !== "none" && !finalProof) {
      setError("Please provide proof of completion before submitting.");
      return;
    } else {
      finalProof = JSON.stringify({
        type: task.proof_type,
        value: finalProof,
        selectedPlatforms: selectedPlatformPayload,
        rewardQlt: displayedSubmitReward,
      });
    }

    setError("");
    setSubmitting(true);
    const result = await onComplete(task.id, finalProof);
    setSubmitting(false);
    if (result.ok) setPhase("success");
    else setError(result.error || "Submission failed. Please try again.");
  };

  return (
    <div
      className="missionModalBackdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(0,0,0,.72)",
        backdropFilter: "blur(6px)",
      }}
    >
      <section
        className="missionModalSheet"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(100%, 860px)",
          maxHeight: "92vh",
          overflowY: "auto",
          border: "1px solid var(--border)",
          borderRadius: 18,
          background: "var(--card-bg)",
          color: "var(--text)",
          boxShadow: "0 30px 90px rgba(0,0,0,.45)",
        }}
      >
        <div className="modalHandle" />

        {phase === "success" && (
          <div className="modalSuccess">
            <div className="successMark">OK</div>
            <span>Submission received</span>
            <h2>Proof sent for review</h2>
            <p>Your completion for <strong>{task.title}</strong> is now pending verification. Approved work will release {task.reward.toLocaleString()} QLT to your wallet.</p>
            <div className="pendingReward">
              <span>Pending reward</span>
              <strong>+{displayedSubmitReward.toLocaleString()} QLT</strong>
            </div>
            <button type="button" onClick={onClose}>Back to missions</button>
          </div>
        )}

        {phase === "details" && (
          <div className="modalContent">
            <header className="missionBriefHeader">
              <div>
                <span>{task.business_name || "Qeixova business campaign"}</span>
                <h2>{task.title}</h2>
                <p>{metadata.objective || task.instructions || "Complete the mission exactly as described by the business owner."}</p>
              </div>
              <button type="button" onClick={onClose}>Close</button>
            </header>

            {(campaignLink || metadata.assetName) && (
              <section className="missionSection">
                <div className="sectionHead">
                  <span>Campaign content</span>
                  <strong>{metadata.assetName ? "Uploaded campaign asset" : "Campaign link"}</strong>
                </div>
                {campaignLink && (
                  <div className="campaignLinkBlock">
                    <span>Submitted link</span>
                    <a className="campaignLink" href={campaignLink} target="_blank" rel="noopener noreferrer">{campaignLink}</a>
                  </div>
                )}
                {contentCaption ? (
                  <div className="campaignCaptionBlock">
                    <span>Caption to post with content</span>
                    <p>{contentCaption}</p>
                  </div>
                ) : null}
                {assetDataUrl ? (
                  <div className="downloadAssetNote">
                    {isImageAsset && <img className="assetPreviewImage" src={assetDataUrl} alt="Campaign asset" />}
                    <p>{isImageAsset ? "Use this uploaded campaign image for the mission. Download it if your platform cannot import it directly from the preview." : "Download the uploaded campaign file, then use it on the required platform for this mission."}</p>
                    <a className="assetDownloadButton" href={assetDataUrl} download={metadata.assetName || "campaign-asset"}>{assetMimeType.startsWith("image/") ? "Download image" : "Download file"}</a>
                  </div>
                ) : metadata.assetName ? (
                  <div className="downloadAssetNote">
                    <p>This campaign was created before stored asset previews were enabled. Ask the business to re-upload the campaign content if the file is required.</p>
                  </div>
                ) : null}
              </section>
            )}

            <div className="rewardBanner">
              <div>
                <span>Approved reward</span>
                <strong>{task.reward.toLocaleString()} QLT</strong>
              </div>
              <div>
                <span>Estimated time</span>
                <strong>{task.duration}</strong>
              </div>
              <div>
                <span>Profile match</span>
                <strong>{matchScore}%</strong>
              </div>
            </div>

            <section className="missionSection">
              <div className="sectionHead">
                <span>Business mission details</span>
                <strong>{task.campaign_goal || task.category}</strong>
              </div>
              <div className="detailGrid">
                <Detail label="Campaign type" value={metadata.contentType || task.category} />
                <Detail label="Package / platform" value={metadata.selectedPricingLabel || list(platforms)} />
                <Detail label="Target location" value={location} />
                <Detail label="Target interests" value={list(metadata.selectedInterests || task.target_interests, "Broad audience")} />
                <Detail label="Participation slots" value={remainingSlots === null ? "Open campaign" : `${remainingSlots.toLocaleString()} remaining`} />
                <Detail label="Proof required" value={task.proof_label || task.proof_type} />
              </div>
            </section>

            <section className="missionSection">
              <div className="sectionHead">
                <span>Contributor actions</span>
                <strong>{actionSteps.length} step{actionSteps.length === 1 ? "" : "s"}</strong>
              </div>
              <ol className="stepList">
                {actionSteps.map((step, index) => (
                  <li key={`${step}-${index}`}>
                    <span>{index + 1}</span>
                    <p><StepText text={step} /></p>
                  </li>
                ))}
              </ol>
            </section>

            <button type="button" className="primaryAction" onClick={() => setPhase("proof")}>Start proof submission</button>
          </div>
        )}

        {phase === "proof" && (
          <div className="modalContent">
            <header className="proofHeader">
              <button type="button" onClick={() => setPhase("details")}>Back</button>
              <div>
                <span>Submit proof</span>
                <h2>{task.title}</h2>
              </div>
            </header>

            <section className="missionSection">
              <div className="sectionHead">
                <span>Proof rule</span>
                <strong>{task.proof_label}</strong>
              </div>

              {platformOptions.length > 0 && (
                <div className="platformChoicePanel">
                  <div className="platformChoiceHead">
                    <div>
                      <span>Choose platform</span>
                      <strong>{activePlatformIds.length}/{platformOptions.length} selected</strong>
                    </div>
                    <em>{displayedSubmitReward.toLocaleString()} QLT</em>
                  </div>
                  <div className="platformChoiceGrid">
                    {platformOptions.map((option) => {
                      const checked = activePlatformIds.includes(option.id);
                      return (
                        <label key={option.id} className={checked ? "platformChoice active" : "platformChoice"}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handlePlatformToggle(option.id, checked)}
                          />
                          <span>{option.platform}</span>
                          <strong>{option.rewardQlt.toLocaleString()} QLT</strong>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {task.proof_type === "screenshot" && (
                <div className="proofUpload">
                  <input ref={fileRef} type="file" accept="image/*" multiple={requiredScreenshotCount > 1} onChange={handleFileChange} />
                  <button type="button" onClick={() => fileRef.current?.click()}>
                    Upload screenshot{requiredScreenshotCount > 1 ? "s" : ""}
                  </button>
                  <small>{Math.min(screenshots.length, requiredScreenshotCount)}/{requiredScreenshotCount} uploaded</small>
                  {visibleScreenshots.length > 0 && (
                    <div className="screenshotGrid">
                      {visibleScreenshots.map((shot, index) => (
                        <div key={`${shot.name}-${index}`}>
                          <img src={shot.dataUrl} alt={`Proof ${index + 1}`} />
                          <button type="button" onClick={() => setScreenshots((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {task.proof_type === "url" && (
                <input className="proofInput" type="url" value={proofValue} onChange={(event) => setProofValue(event.target.value)} placeholder="Paste proof link" />
              )}

              {task.proof_type === "text" && (
                <textarea className="proofInput" value={proofValue} onChange={(event) => setProofValue(event.target.value)} placeholder="Write your proof or feedback" rows={5} />
              )}

              {task.proof_type === "none" && <p className="contentNote">No additional proof is required for this mission.</p>}
            </section>

            {error && <p className="errorBox">{error}</p>}

            <button type="button" className="primaryAction" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : `Submit for ${displayedSubmitReward.toLocaleString()} QLT`}
            </button>
          </div>
        )}
      </section>

      <style jsx>{`
        ${compactDetailStyle}
        .missionModalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0,0,0,.72);
          backdrop-filter: blur(6px);
        }
        .missionModalSheet {
          width: min(100%, 860px);
          max-height: 92vh;
          overflow-y: auto;
          border: 1px solid var(--border);
          border-radius: 18px;
          background: var(--card-bg);
          color: var(--text);
          box-shadow: 0 30px 90px rgba(0,0,0,.45);
        }
        .modalHandle {
          width: 46px;
          height: 4px;
          border-radius: 999px;
          background: var(--border);
          margin: 12px auto 0;
        }
        .modalContent,
        .modalSuccess {
          display: grid;
          gap: 16px;
          padding: 24px;
        }
        .missionBriefHeader {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
        }
        .missionBriefHeader span,
        .proofHeader span,
        .sectionHead span,
        .modalSuccess span,
        .rewardBanner span,
        .pendingReward span {
          color: var(--accent-2);
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .06em;
        }
        h2 {
          margin: 5px 0 0;
          color: var(--text);
          font-size: 26px;
          line-height: 1.12;
          letter-spacing: 0;
        }
        p {
          color: var(--muted);
          line-height: 1.6;
        }
        .missionBriefHeader p {
          margin-top: 8px;
        }
        .missionBriefHeader button,
        .proofHeader button {
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--card-bg);
          color: var(--text);
          padding: 9px 12px;
          font-weight: 850;
          cursor: pointer;
        }
        .rewardBanner,
        .pendingReward {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          border: 1px solid rgba(26,239,34,.18);
          border-radius: 14px;
          background: rgba(26,239,34,.06);
          padding: 14px;
        }
        .rewardBanner strong,
        .pendingReward strong {
          display: block;
          margin-top: 5px;
          color: var(--accent);
          font-size: 22px;
        }
        .missionSection {
          display: grid;
          gap: 12px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--card-bg);
          padding: 15px;
        }
        .sectionHead {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }
        .sectionHead strong {
          color: var(--text);
          font-size: 13px;
          text-align: right;
        }
        .detailGrid {
          display: grid;
          gap: 8px;
        }
        .detailCard {
          display: grid;
          grid-template-columns: minmax(112px, .42fr) minmax(0, 1fr);
          gap: 12px;
          align-items: start;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--card-bg);
          padding: 12px;
          min-width: 0;
        }
        .detailLabel {
          color: var(--muted);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          line-height: 1.35;
        }
        .detailValue {
          color: var(--text);
          font-size: 13px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .campaignLink {
          color: var(--accent);
          font-weight: 850;
          overflow-wrap: anywhere;
        }
        .campaignLinkBlock {
          display: grid;
          gap: 5px;
          border: 1px solid rgba(26,239,34,.18);
          border-radius: 12px;
          background: rgba(26,239,34,.06);
          padding: 12px;
        }
        .campaignLinkBlock span {
          color: var(--muted);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .campaignCaptionBlock {
          display: grid;
          gap: 7px;
          border: 1px solid rgba(245,166,35,.28);
          border-radius: 12px;
          background: rgba(245,166,35,.08);
          padding: 12px;
        }
        .campaignCaptionBlock span {
          color: var(--accent-2);
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .campaignCaptionBlock p {
          margin: 0;
          color: var(--text);
          font-size: 13px;
          line-height: 1.55;
          white-space: pre-wrap;
        }
        .contentNote {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
        }
        .downloadAssetNote {
          display: grid;
          gap: 6px;
          border: 1px solid rgba(245,166,35,.25);
          border-radius: 12px;
          background: rgba(245,166,35,.06);
          padding: 12px;
        }
        .downloadAssetNote strong {
          color: var(--text);
          font-size: 13px;
          overflow-wrap: anywhere;
        }
        .downloadAssetNote p {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
        }
        .assetPreviewImage {
          width: 100%;
          max-height: 320px;
          object-fit: contain;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--card-bg);
        }
        .assetDownloadButton {
          display: inline-flex;
          width: fit-content;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--accent-2), var(--accent-2));
          color: var(--button-text, #000);
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 950;
          text-decoration: none;
        }
        .stepList {
          display: grid;
          gap: 10px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .stepList li {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
        }
        .stepList li > span {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: var(--accent-2);
          color: var(--step-number-text, var(--button-text, #000));
          font-size: 12px;
          font-weight: 950;
        }
        .stepList p {
          margin: 2px 0 0;
          color: var(--muted);
          font-size: 13px;
        }
        .stepList a {
          color: var(--accent);
          font-weight: 850;
          word-break: break-all;
        }
        .primaryAction {
          width: 100%;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(135deg, var(--accent-2), var(--accent-2));
          color: var(--button-text, #000);
          padding: 15px;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(245,166,35,.18);
        }
        .primaryAction:disabled {
          opacity: .6;
          cursor: not-allowed;
        }
        .proofHeader {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .platformChoicePanel {
          display: grid;
          gap: 10px;
          border: 1px solid rgba(26,239,34,.12);
          border-radius: 12px;
          background: rgba(26,239,34,.06);
          padding: 12px;
        }
        .platformChoiceHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .platformChoiceHead div {
          display: grid;
          gap: 3px;
        }
        .platformChoiceHead span {
          color: var(--accent-2);
          font-size: 10px;
          font-weight: 950;
          text-transform: uppercase;
        }
        .platformChoiceHead strong {
          color: var(--text);
          font-size: 13px;
        }
        .platformChoiceHead em {
          color: var(--accent);
          font-size: 13px;
          font-style: normal;
          font-weight: 950;
          white-space: nowrap;
          /* no-op refresh - header vars */
        }
        .platformChoiceGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .platformChoice {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 4px 8px;
          align-items: center;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--card-bg);
          padding: 10px;
          cursor: pointer;
        }
        .platformChoice.active {
          border-color: rgba(26,239,34,.45);
          background: rgba(26,239,34,.1);
        }
        .platformChoice input {
          width: 16px;
          height: 16px;
          accent-color: var(--accent);
        }
        .platformChoice span {
          color: #f5f5f5;
          font-size: 12px;
          font-weight: 850;
          overflow-wrap: anywhere;
        }
        .platformChoice strong {
          grid-column: 2;
          color: var(--accent);
          font-size: 11px;
        }
        .proofUpload {
          display: grid;
          gap: 10px;
        }
        .proofUpload input {
          display: none;
        }
        .proofUpload > button {
          border: 1px dashed rgba(245,166,35,.42);
          border-radius: 12px;
          background: rgba(245,166,35,.08);
          color: var(--accent-2);
          padding: 18px;
          font-weight: 950;
          cursor: pointer;
        }
        .proofUpload small {
          color: var(--muted);
          font-size: 12px;
        }
        .screenshotGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .screenshotGrid div {
          display: grid;
          gap: 6px;
        }
        .screenshotGrid img {
          width: 100%;
          height: 130px;
          object-fit: cover;
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .screenshotGrid button {
          border: 0;
          border-radius: 9px;
          background: var(--danger-light);
          color: var(--danger);
          padding: 8px;
          font-weight: 850;
          cursor: pointer;
        }
        .proofInput {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--card-bg);
          color: var(--text);
          padding: 13px 14px;
          font: inherit;
          outline: none;
        }
        textarea.proofInput {
          resize: vertical;
        }
        .errorBox {
          margin: 0;
          border: 1px solid var(--danger-light-border);
          border-radius: 12px;
          background: var(--danger-light);
          color: var(--danger);
          padding: 12px;
          font-weight: 850;
        }
        .modalSuccess {
          justify-items: center;
          text-align: center;
          padding: 34px 22px;
        }
        .successMark {
          width: 64px;
          height: 64px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(26,239,34,.3);
          border-radius: 18px;
          background: rgba(26,239,34,.1);
          color: var(--accent);
          font-weight: 950;
        }
        .pendingReward {
          width: 100%;
          grid-template-columns: 1fr;
        }
        .modalSuccess button {
          border: 0;
          border-radius: 13px;
          background: linear-gradient(135deg, var(--accent-2), #d89420);
          color: #000;
          padding: 14px 18px;
          font-weight: 950;
          cursor: pointer;
        }
        @media (max-width: 640px) {
          .missionModalBackdrop {
            align-items: flex-end;
            padding: 0;
          }
          .missionModalSheet {
            border-radius: 20px 20px 0 0;
          }
          .modalContent,
          .modalSuccess {
            padding: 20px 16px 28px;
          }
          .missionBriefHeader,
          .rewardBanner,
          .platformChoiceGrid,
          .screenshotGrid {
            grid-template-columns: 1fr;
          }
          .detailCard {
            grid-template-columns: 1fr;
            gap: 5px;
          }
          .missionBriefHeader button {
            justify-self: start;
          }
          .sectionHead {
            display: grid;
          }
          .sectionHead strong {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}
