"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

const MISSION_KEY = "qeixova-awareness-verification";
const SELECTED_KEY = "qeixova-my-missions-v2";
const STARTED_KEY = "qeixova-started-missions-v2";

type Mission = { id: number; mission_key?: string; completed?: boolean; completion_status?: string };
type Anchor = { top: number; left: number; width: number; height: number } | null;
type PopupPosition = { top: number; left: number; width: number; placement: "above" | "below" | "left" | "right" } | null;

function readIds(key: string): number[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];
  } catch { return []; }
}

function findVisibleTarget(selector: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).reverse().find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }) ?? null;
}

export default function GuidedWelcomeMission() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(false);
  const [welcome, setWelcome] = useState<Mission | null>(null);
  const [selected, setSelected] = useState(false);
  const [started, setStarted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [manual, setManual] = useState(false);
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const [submittedLocally, setSubmittedLocally] = useState(false);
  const [anchor, setAnchor] = useState<Anchor>(null);
  const [popupPosition, setPopupPosition] = useState<PopupPosition>(null);
  const [stageRevision, setStageRevision] = useState(0);
  const guideCardRef = useRef<HTMLElement>(null);

  const storageKey = useMemo(() => user ? `qeixova-welcome-guide-dismissed-v1-${user.id}` : "", [user]);
  const syncProgress = useCallback(() => {
    if (!welcome) return;
    setSelected(readIds(SELECTED_KEY).includes(welcome.id));
    setStarted(readIds(STARTED_KEY).includes(welcome.id));
  }, [welcome]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => fetch("/api/tasks", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!alive) return;
        const mission = (data?.tasks as Mission[] | undefined)?.find((task) => task.mission_key === MISSION_KEY) ?? null;
        setWelcome(mission);
        if (mission?.completion_status === "rejected") setSubmittedLocally(false);
      }).catch(() => {});
    void load();
    const timer = window.setInterval(load, 30000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [user, pathname]);

  useEffect(() => {
    if (!user) return;
    setDismissed(window.localStorage.getItem(`qeixova-welcome-guide-dismissed-v1-${user.id}`) === "1");
    setCompletionDismissed(window.localStorage.getItem(`qeixova-welcome-guide-complete-v1-${user.id}`) === "1");
  }, [user]);

  useEffect(() => {
    syncProgress();
    const listener = () => syncProgress();
    window.addEventListener("storage", listener);
    window.addEventListener("qeixova-mission-selection", listener);
    window.addEventListener("qeixova-mission-started", listener);
    const refreshStage = () => setStageRevision((value) => value + 1);
    const markSubmitted = () => { setSubmittedLocally(true); setStageRevision((value) => value + 1); };
    window.addEventListener("qeixova-welcome-guide-refresh", refreshStage);
    window.addEventListener("qeixova-welcome-mission-submitted", markSubmitted);
    return () => {
      window.removeEventListener("storage", listener);
      window.removeEventListener("qeixova-mission-selection", listener);
      window.removeEventListener("qeixova-mission-started", listener);
      window.removeEventListener("qeixova-welcome-guide-refresh", refreshStage);
      window.removeEventListener("qeixova-welcome-mission-submitted", markSubmitted);
    };
  }, [syncProgress, pathname]);

  const isApproved = Boolean(welcome?.completed && welcome.completion_status === "approved");
  const isPendingReview = submittedLocally || Boolean(welcome?.completed && welcome.completion_status === "pending");
  const isActive = Boolean(user && welcome && !authLoading && (manual || (!dismissed && !isApproved)));

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => setStageRevision((value) => value + 1), 650);
    return () => window.clearInterval(timer);
  }, [isActive]);

  const step = useMemo(() => {
    if (!welcome || isApproved) return null;
    if (isPendingReview) return { selector: '[data-tour="my-missions-link"]', title: "Your proof is under review", body: "You can track its status in My Missions. Other matched missions unlock after approval.", href: "/tasks/submit", action: "Open My Missions" };
    if (!pathname.startsWith("/tasks")) return { selector: '[data-tour="missions-link"]', title: "Start with the welcome mission", body: "Open Missions to find your required first mission.", href: "/tasks", action: "Go to Missions" };
    if (!selected) return { selector: '[data-tour="welcome-select"]', title: "Choose the welcome mission", body: "Select “Welcome to Qeixova: Share & Unlock”. You can view its instructions first, then select it to continue.", href: "/tasks", action: "Find the mission" };
    if (!pathname.startsWith("/tasks/submit")) return { selector: '[data-tour="my-missions-link"]', title: "Open My Missions", body: "Your selected welcome mission is now in My Missions. Open it there to begin.", href: "/tasks/submit", action: "Open My Missions" };
    if (!started) return { selector: '[data-tour="welcome-start"]', title: "Start the welcome mission", body: "Open the mission instructions and follow the steps. When you are ready, continue to proof.", href: "/tasks/submit", action: "Find your mission" };
    const continueToProof = typeof document !== "undefined" && findVisibleTarget('[data-tour="welcome-start-proof"]');
    if (continueToProof) return { selector: '[data-tour="welcome-start-proof"]', title: "Continue to proof", body: "Review the welcome instructions, then continue to the proof form when you have shared the campaign image.", href: "/tasks/submit", action: "Continue to proof" };
    const platformChoice = typeof document !== "undefined" && findVisibleTarget('[data-tour="welcome-platform-choice"]');
    if (platformChoice && platformChoice.dataset.selected !== "true") return { selector: '[data-tour="welcome-platform-choice"]', title: "Choose where you shared it", body: "Select every platform you completed this mission on. The proof requirement and reward update to match your choices.", href: "/tasks/submit", action: "Choose platforms" };
    const upload = typeof document !== "undefined" && findVisibleTarget('[data-tour="welcome-proof-upload"]');
    if (upload) {
      const isReady = upload.dataset.ready === "true";
      if (!isReady) return { selector: '[data-tour="welcome-proof-upload"]', title: "Add your proof", body: "Upload the required screenshots for your selected platforms. Each image can be up to 5 MB.", href: "/tasks/submit", action: "Add screenshots" };
      return { selector: '[data-tour="welcome-proof-submit"]', title: "Submit for approval", body: "Your required proof is ready. Submit it for review. Once approved, your regular matched missions unlock.", href: "/tasks/submit", action: "Submit proof" };
    }
    return { selector: '[data-tour="welcome-start"]', title: "Continue your welcome mission", body: "Open the welcome mission to add proof and submit it for approval.", href: "/tasks/submit", action: "Continue mission" };
  }, [welcome, isApproved, isPendingReview, pathname, selected, started, stageRevision]);

  const targetSelector = step?.selector;
  useEffect(() => {
    if (!isActive || !targetSelector) { setAnchor(null); setPopupPosition(null); return; }
    let previous = "";
    let alive = true;
    const position = () => {
      const element = findVisibleTarget(targetSelector);
      const rect = element?.getBoundingClientRect();
      if (!element || !rect || rect.width === 0 || rect.height === 0) { setAnchor(null); return; }
      const signature = `${targetSelector}-${Math.round(rect.top)}-${Math.round(rect.left)}`;
      if (signature !== previous && (rect.top < 12 || rect.bottom > window.innerHeight - 12)) {
        previous = signature;
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
      const nextAnchor = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      setAnchor((current) => current && Math.abs(current.top - nextAnchor.top) < 1 && Math.abs(current.left - nextAnchor.left) < 1 && Math.abs(current.width - nextAnchor.width) < 1 && Math.abs(current.height - nextAnchor.height) < 1 ? current : nextAnchor);

      const margin = 12;
      const popupWidth = Math.min(340, window.innerWidth - margin * 2);
      const popupHeight = guideCardRef.current?.offsetHeight || 168;
      const roomAbove = rect.top - margin;
      const roomBelow = window.innerHeight - rect.bottom - margin;
      let placement: NonNullable<PopupPosition>["placement"] = "below";
      let top = rect.bottom + 10;
      let left = Math.max(margin, Math.min(rect.left, window.innerWidth - popupWidth - margin));

      if (roomBelow >= popupHeight + 10) {
        placement = "below";
      } else if (roomAbove >= popupHeight + 10) {
        placement = "above";
        top = rect.top - popupHeight - 10;
      } else if (window.innerWidth - rect.right >= popupWidth + 22) {
        placement = "right";
        left = rect.right + 10;
        top = Math.max(margin, Math.min(rect.top, window.innerHeight - popupHeight - margin));
      } else if (rect.left >= popupWidth + 22) {
        placement = "left";
        left = rect.left - popupWidth - 10;
        top = Math.max(margin, Math.min(rect.top, window.innerHeight - popupHeight - margin));
      } else {
        placement = roomBelow >= roomAbove ? "below" : "above";
        top = placement === "below"
          ? Math.min(rect.bottom + 10, window.innerHeight - popupHeight - margin)
          : Math.max(margin, rect.top - popupHeight - 10);
      }
      const nextPopup = { top, left, width: popupWidth, placement };
      setPopupPosition((current) => current && Math.abs(current.top - nextPopup.top) < 1 && Math.abs(current.left - nextPopup.left) < 1 && current.width === nextPopup.width && current.placement === nextPopup.placement ? current : nextPopup);
    };
    const timer = window.setInterval(() => { if (alive) position(); }, 350);
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [isActive, targetSelector]);

  const dismiss = () => {
    if (storageKey) window.localStorage.setItem(storageKey, "1");
    setDismissed(true);
    setManual(false);
  };
  const startAgain = () => { if (storageKey) window.localStorage.removeItem(storageKey); setDismissed(false); setManual(true); };
  const goToTarget = () => { if (step) router.push(step.href); };

  if (!user || authLoading || !welcome) return null;

  if (isApproved && !completionDismissed) {
    return <aside className="welcomeGuideComplete" role="status"><span aria-hidden="true">✓</span><div><strong>Welcome mission approved</strong><p>Your regular matched missions are now unlocked. Browse Missions whenever you’re ready.</p></div><button type="button" onClick={() => { window.localStorage.setItem(`qeixova-welcome-guide-complete-v1-${user.id}`, "1"); setCompletionDismissed(true); }} aria-label="Dismiss">×</button><style jsx>{`.welcomeGuideComplete{position:fixed;z-index:12000;right:18px;bottom:20px;width:min(420px,calc(100vw - 36px));display:flex;gap:12px;align-items:flex-start;padding:15px 16px;border:1px solid rgba(26,239,34,.35);border-radius:15px;background:#101411;color:#f5f5f5;box-shadow:0 18px 55px #000a}.welcomeGuideComplete>span{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#1aef22;color:#031003;font-weight:1000}.welcomeGuideComplete strong{font-size:14px}.welcomeGuideComplete p{margin-top:4px;color:#b8c1b8;font-size:12px;line-height:1.45}.welcomeGuideComplete button{margin-left:auto;border:0;background:none;color:#aeb4af;font-size:20px;cursor:pointer}`}</style></aside>;
  }

  if (!isActive || !step) return dismissed ? <><button type="button" className="welcomeGuideRestart" onClick={startAgain}>Welcome mission guide</button><style jsx>{`.welcomeGuideRestart{position:fixed;z-index:11000;right:18px;bottom:20px;border:1px solid rgba(26,239,34,.3);border-radius:999px;background:#101411;color:#1aef22;padding:10px 14px;font-size:11px;font-weight:900;box-shadow:0 8px 28px #0008;cursor:pointer}@media(max-width:600px){.welcomeGuideRestart{right:12px;bottom:78px}}`}</style></> : null;

  return <>
    {anchor && <div className="welcomeGuideSpotlight" style={{ top: anchor.top - 5, left: anchor.left - 5, width: anchor.width + 10, height: anchor.height + 10 }} aria-hidden="true" />}
    <aside ref={guideCardRef} className={`welcomeGuideCard${popupPosition ? ` placement-${popupPosition.placement}` : ""}`} style={popupPosition ? { top: popupPosition.top, left: popupPosition.left, width: popupPosition.width } : { top: 12, left: 12 }} role="status" aria-live="polite">
      <div className="welcomeGuideEyebrow">WELCOME MISSION · STEP-BY-STEP</div>
      <strong>{isPendingReview ? "Your proof is under review" : step.title}</strong>
      <p>{step.body}</p>
      <div className="welcomeGuideActions">
        <button type="button" className="welcomeGuidePrimary" onClick={goToTarget}>{step.action} →</button>
        <button type="button" className="welcomeGuideDismiss" onClick={dismiss}>Dismiss guide</button>
      </div>
    </aside>
    <style jsx>{`
      .welcomeGuideSpotlight{position:fixed;z-index:11998;border:2px solid #1aef22;border-radius:14px;box-shadow:0 0 0 3px rgba(26,239,34,.13),0 0 18px rgba(26,239,34,.24);pointer-events:none;transition:top .18s,left .18s,width .18s,height .18s}
      .welcomeGuideCard{position:fixed;z-index:11999;width:min(340px,calc(100vw - 24px));max-height:min(220px,calc(100vh - 24px));overflow:auto;box-sizing:border-box;padding:14px 15px;border:1px solid #334236;border-radius:14px;background:#101411;color:#f5f5f5;box-shadow:0 12px 34px #0009;transition:top .16s ease,left .16s ease}
      .welcomeGuideCard:after{content:"";position:absolute;width:0;height:0;border:8px solid transparent}
      .welcomeGuideCard.placement-below:after{top:-16px;left:24px;border-bottom-color:#334236}
      .welcomeGuideCard.placement-above:after{bottom:-16px;left:24px;border-top-color:#334236}
      .welcomeGuideCard.placement-right:after{left:-16px;top:20px;border-right-color:#334236}
      .welcomeGuideCard.placement-left:after{right:-16px;top:20px;border-left-color:#334236}
      .welcomeGuideEyebrow{color:#1aef22;font-size:9px;font-weight:950;letter-spacing:1px;margin-bottom:8px}
      .welcomeGuideCard strong{font-size:15px;font-weight:900}.welcomeGuideCard p{margin-top:6px;color:#b9c0ba;font-size:12px;line-height:1.55}
      .welcomeGuideActions{display:flex;align-items:center;gap:12px;margin-top:13px}.welcomeGuidePrimary{border:0;border-radius:9px;background:#1aef22;color:#061006;padding:10px 13px;font-size:11px;font-weight:950;cursor:pointer}.welcomeGuideDismiss{border:0;background:transparent;color:#929a93;font-size:10px;font-weight:800;cursor:pointer}
      .welcomeGuideRestart{position:fixed;z-index:11000;right:18px;bottom:20px;border:1px solid rgba(26,239,34,.3);border-radius:999px;background:#101411;color:#1aef22;padding:10px 14px;font-size:11px;font-weight:900;box-shadow:0 8px 28px #0008;cursor:pointer}
      @media(max-width:600px){.welcomeGuideRestart{right:12px;bottom:78px}}
    `}</style>
  </>;
}
