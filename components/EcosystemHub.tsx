"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Flow = {
  title: string;
  description: string;
  steps: string[];
  status: "Live" | "Ready" | "Planned";
  href: string;
  accent: string;
};

const contributorFlows: Flow[] = [
  { title: "Campaign Discovery", description: "Find work by fit, category, trend, reward, and proof style.", steps: ["Search opportunities", "Filter by category", "Open recommended or trending missions", "Start participation"], status: "Live", href: "/tasks", accent: "#1AEF22" },
  { title: "Campaign Participation", description: "Move from instructions to proof submission and pending approval.", steps: ["Read instructions", "Open campaign link", "Upload proof", "Track approval state"], status: "Live", href: "/tasks", accent: "#F5A623" },
  { title: "Wallet & Payments", description: "See balance, pending rewards, withdrawal methods, and history.", steps: ["Review available QLT", "Track pending rewards", "Choose bank account", "Request withdrawal"], status: "Live", href: "/wallet", accent: "#4a9eff" },
  { title: "Reputation & Profile", description: "Trust score, level, badges, platforms, and participation identity.", steps: ["Maintain trust score", "Complete profile", "Build streaks", "Unlock higher missions"], status: "Live", href: "/profile", accent: "#c084fc" },
  { title: "Referral & Ambassador", description: "Invite growth loops for team earnings and ambassador ranking.", steps: ["Share referral code", "Track invite rewards", "Grow team activity", "Qualify for ambassador access"], status: "Ready", href: "/leaderboard", accent: "#22c55e" },
  { title: "Community & Education", description: "Learn how to submit stronger proof and follow platform updates.", steps: ["Read mission tips", "Watch platform alerts", "Follow community launches", "Ask support when blocked"], status: "Ready", href: "/dashboard", accent: "#fb7185" },
];

const businessFlows: Flow[] = [
  { title: "Proof Verification", description: "Review submitted proof, approve qualified work, reject weak proof.", steps: ["Open campaign details", "Inspect proof", "Approve or reject", "Contributor wallet updates"], status: "Live", href: "/business/tasks", accent: "#1AEF22" },
  { title: "Campaign Analytics", description: "Track participation, approvals, rejection rate, and campaign progress.", steps: ["View campaign stats", "Compare submissions", "Monitor approval quality", "Pause when needed"], status: "Live", href: "/business/tasks", accent: "#4a9eff" },
  { title: "Templates & Launching", description: "Use guided campaign categories for SMEs, creators, music, apps, and local promotion.", steps: ["Pick template type", "Set goal", "Add content", "Launch for review"], status: "Live", href: "/business/tasks/new", accent: "#F5A623" },
  { title: "Funding & Budgeting", description: "Model campaign budget, contributor rewards, and reach before launch.", steps: ["Choose package", "Customize rewards", "Set contributor limit", "Preview spend"], status: "Live", href: "/business/tasks/new", accent: "#22c55e" },
  { title: "Business Insights", description: "Turn campaign outcomes into growth intelligence and next-action suggestions.", steps: ["Find best categories", "Watch high-quality contributors", "Spot region trends", "Repeat winners"], status: "Ready", href: "/business/dashboard", accent: "#c084fc" },
  { title: "Trust Protection", description: "Reduce fraud through proof review, rejection records, trust scores, and audit trails.", steps: ["Review suspicious proof", "Reject duplicates", "Protect budget", "Escalate disputes"], status: "Live", href: "/business/tasks", accent: "#e53e3e" },
];

export default function EcosystemHub({ mode }: { mode: "contributor" | "business" }) {
  const [filter, setFilter] = useState<"All" | "Live" | "Ready" | "Planned">("All");
  const flows = mode === "business" ? businessFlows : contributorFlows;
  const filtered = useMemo(() => flows.filter((flow) => filter === "All" || flow.status === filter), [filter, flows]);
  const title = mode === "business" ? "Business Growth System" : "Participation Growth System";
  const subtitle = mode === "business"
    ? "Campaign operations, verification, analytics, funding, and trust controls."
    : "Discovery, participation, payments, reputation, referrals, and community growth.";
  const homeHref = mode === "business" ? "/business/dashboard" : "/dashboard";

  return (
    <main className={`page-body ecosystemHub ${mode === "business" ? "business-page-pro" : ""}`}>
      <header className="ecosystemHeader">
        <div>
          <p className="eyebrow">Qeixova Ecosystem</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <Link href={homeHref} className="topAction">Dashboard</Link>
      </header>

      <section className="signalGrid">
        {[
          { label: "Active flows", value: flows.filter((flow) => flow.status === "Live").length },
          { label: "Ready modules", value: flows.filter((flow) => flow.status === "Ready").length },
          { label: "System coverage", value: "25+" },
        ].map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </section>

      <div className="filterRow">
        {(["All", "Live", "Ready", "Planned"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item}</button>
        ))}
      </div>

      <section className="flowGrid">
        {filtered.map((flow) => (
          <article key={flow.title} className="flowCard" style={{ borderTopColor: flow.accent }}>
            <div className="flowTop">
              <div className="iconBox" style={{ background: `${flow.accent}18` }}>
                <Image src="/icon-target.svg" alt="" width={22} height={22} />
              </div>
              <span style={{ color: flow.accent, background: `${flow.accent}14` }}>{flow.status}</span>
            </div>
            <h2>{flow.title}</h2>
            <p>{flow.description}</p>
            <ol>
              {flow.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <Link href={flow.href}>Open flow</Link>
          </article>
        ))}
      </section>

      <style jsx>{`
        .ecosystemHub {
          max-width: 1120px;
          margin: 0 auto;
          color: #f5f5f5;
        }
        .ecosystemHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }
        .eyebrow {
          color: ${mode === "business" ? "#F5A623" : "#1AEF22"};
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        h1 {
          color: #fff;
          font-size: clamp(28px, 5vw, 44px);
          line-height: 1.05;
          letter-spacing: 0;
          margin-bottom: 10px;
        }
        header p:not(.eyebrow) {
          color: #aaa;
          line-height: 1.6;
          max-width: 640px;
          font-size: 14px;
        }
        .topAction, .flowCard a {
          text-decoration: none;
          border-radius: 12px;
          font-weight: 900;
          font-size: 13px;
        }
        .topAction {
          color: #000;
          background: ${mode === "business" ? "#F5A623" : "#1AEF22"};
          padding: 11px 16px;
          white-space: nowrap;
        }
        .signalGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 14px;
        }
        .signalGrid div, .flowCard {
          border: 1px solid #1b1b1b;
          background: #0a0a0a;
          border-radius: 16px;
        }
        .signalGrid div {
          padding: 14px;
        }
        .signalGrid strong {
          display: block;
          font-size: 24px;
          color: #f5f5f5;
        }
        .signalGrid span {
          display: block;
          font-size: 11px;
          color: #888;
          margin-top: 3px;
        }
        .filterRow {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 12px;
        }
        .filterRow button {
          border: 1px solid #2a2a2a;
          background: #101010;
          color: #aaa;
          border-radius: 999px;
          padding: 9px 14px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .filterRow button.active {
          color: ${mode === "business" ? "#F5A623" : "#1AEF22"};
          border-color: ${mode === "business" ? "rgba(245,166,35,0.45)" : "rgba(26,239,34,0.45)"};
          background: ${mode === "business" ? "rgba(245,166,35,0.08)" : "rgba(26,239,34,0.08)"};
        }
        .flowGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 12px;
        }
        .flowCard {
          border-top: 3px solid;
          padding: 16px;
          min-height: 320px;
          display: flex;
          flex-direction: column;
        }
        .flowTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
        .iconBox {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: grid;
          place-items: center;
        }
        .flowTop span {
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 900;
        }
        .flowCard h2 {
          font-size: 18px;
          line-height: 1.2;
          margin-bottom: 8px;
        }
        .flowCard p, .flowCard li {
          color: #aaa;
          font-size: 13px;
          line-height: 1.55;
        }
        .flowCard ol {
          margin: 14px 0 18px;
          padding-left: 18px;
          display: grid;
          gap: 6px;
        }
        .flowCard a {
          margin-top: auto;
          color: #000;
          background: ${mode === "business" ? "#F5A623" : "#1AEF22"};
          padding: 11px 13px;
          text-align: center;
        }
        @media (max-width: 720px) {
          .ecosystemHeader {
            display: block;
          }
          .topAction {
            display: inline-flex;
            margin-top: 14px;
          }
          .signalGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
