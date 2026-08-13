"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import BusinessLoading from "@/components/BusinessLoading";
import BusinessSidebar from "@/components/BusinessSidebar";

interface Stats {
  tasks: { total: number; active: number };
  completions: { total: number; pending: number; approved: number; rejected: number };
}

function MetricCard({ label, value, sub, icon, accent }: { label: string; value: number; sub: string; icon: string; accent: string }) {
  return (
    <article className="adsPanel businessMetricCard" style={{ "--metric-accent": accent } as CSSProperties}>
      <div>
        <div>
          <p>{label}</p>
          <strong>{value.toLocaleString()}</strong>
        </div>
        <span>
          <Image src={icon} alt="" width={18} height={18} />
        </span>
      </div>
      <small>{sub}</small>
    </article>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function BusinessDashboard() {
  const router = useRouter();
  const [business, setBusiness] = useState<{ name: string; email: string; industry: string; balance: number } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

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
      })
      .catch(() => router.push("/business/login"));
    fetch("/api/business/dashboard").then((res) => (res.ok ? res.json() : null)).then((data) => { if (data) setStats(data); });
  }, [router]);

  if (!business) {
    return (
      <BusinessLoading
        title="Loading business dashboard"
        detail="Collecting campaign, submission, and wallet signals for your workspace."
      />
    );
  }

  const cards = [
    { label: "Campaigns", value: stats?.tasks.total ?? 0, sub: `${stats?.tasks.active ?? 0} active campaigns`, icon: "/icon-task.svg", accent: "#4a9eff" },
    { label: "Submissions", value: stats?.completions.total ?? 0, sub: `${stats?.completions.pending ?? 0} awaiting review`, icon: "/icon-survey.svg", accent: "#F5A623" },
    { label: "Approved", value: stats?.completions.approved ?? 0, sub: "Verified contributor actions", icon: "/icon-check-circle.svg", accent: "#1AEF22" },
    { label: "Rejected", value: stats?.completions.rejected ?? 0, sub: "Did not qualify", icon: "/icon-alert.svg", accent: "#e53e3e" },
  ];
  const businessDisplayName = business.name?.trim() || "Business";

  return (
    <>
      <BusinessSidebar name={business.name} />
      <main className="page-body business-page-pro">
        <div className="businessWorkspace">
          <section className="adsPanel businessHeroPanel businessDashboardHero">
            <div>
              <div className="businessGreetingLine">
                <span />
                <p>{getGreeting()}</p>
              </div>
              <p className="businessEyebrow">Business Manager</p>
              <h1 className="businessPageTitle">Welcome back, {businessDisplayName}</h1>
              <p className="businessIdentityLine">{business.name} / {business.industry || "Business"} / {business.email}</p>
            </div>
            <div className="businessBalancePanel">
              <span>Available balance</span>
              <strong>{Number(business.balance ?? 0).toLocaleString()} QLT</strong>
              <Link href="/business/wallet">Add funds</Link>
            </div>
          </section>

          <section className="businessMetricGrid">
            {cards.map((card) => <MetricCard key={card.label} {...card} />)}
          </section>

          <section className="adsPanel businessShortcutPanel">
            <div className="businessSectionHead">
              <div>
                <p className="adsSectionTitle">Campaign setup shortcuts</p>
                <p className="adsMuted">Pick a common business objective and jump into the guided campaign builder.</p>
              </div>
              <Link href="/business/tasks/new" className="businessPrimaryLink">Create</Link>
            </div>
            <div className="businessShortcutGrid">
              {[
                ["Content Distribution", "Flyers, posts, announcements", "/icon-human-distribution.svg"],
                ["Business Awareness", "Products, services, offers", "/icon-local-business.svg"],
                ["Music Promotion", "Songs, snippets, fan buzz", "/icon-music.svg"],
                ["Creator Campaigns", "Reels, pages, livestreams", "/icon-creator.svg"],
              ].map(([title, sub, icon]) => (
                <Link key={title} href="/business/tasks/new" className="adsPanel businessShortcutCard">
                  <Image src={icon} alt="" width={24} height={24} />
                  <strong>{title}</strong>
                  <span>{sub}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
