"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import ContributorLoading from "@/components/ContributorLoading";

type AccountProfile = {
  balance: number;
  tasks_today: number;
  tasks_completed: number;
  total_earned: number;
  total_withdrawn: number;
  total_earned_qlt: number;
  bonus_earned_qlt: number;
  referral_count: number;
  referral_code: string;
  approved_count: number;
  rejected_count: number;
  trust_level: string;
};

const number = (value: unknown) => Number(value || 0).toLocaleString();
const qlt = (value: unknown) => `${number(value)} QLT`;

export default function AccountEarningsPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/profile", { cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Account details could not be loaded.");
        if (active && data.profile) setProfile(data.profile);
        else if (active) throw new Error("Account details could not be loaded.");
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Account details could not be loaded."); });
    return () => { active = false; };
  }, []);

  const copyCode = async () => {
    if (!profile?.referral_code) return;
    try {
      await navigator.clipboard.writeText(profile.referral_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setError("Could not copy the referral code. Please copy it manually."); }
  };

  const shareInvite = async () => {
    if (!profile?.referral_code) return;
    const url = `${window.location.origin}/register?ref=${encodeURIComponent(profile.referral_code)}`;
    try {
      if (navigator.share) await navigator.share({ title: "Join Qeixova", text: "Earn QLT by completing missions!", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* The user may dismiss the native share sheet. */ }
  };

  if (!profile && !error) return <ContributorLoading label="Loading account" detail="Preparing your earnings, mission progress, and referrals." />;

  const reviewed = Number(profile?.approved_count || 0) + Number(profile?.rejected_count || 0);
  const successRate = reviewed ? Math.round(Number(profile?.approved_count || 0) / reviewed * 100) : 0;
  const stats = [
    { label: "Tasks Today", value: number(profile?.tasks_today), icon: "/icon-task.svg" },
    { label: "Approved Tasks", value: number(profile?.tasks_completed), icon: "/icon-task.svg" },
    { label: "Mission QLT", value: qlt(profile?.total_earned_qlt), icon: "/icon-wallet.svg" },
    { label: "Bonus QLT", value: qlt(profile?.bonus_earned_qlt), icon: "/icon-wallet.svg" },
    { label: "Total Earned", value: qlt(profile?.total_earned), icon: "/icon-wallet.svg" },
    { label: "Withdrawn", value: qlt(profile?.total_withdrawn), icon: "/icon-wallet.svg" },
    { label: "Balance", value: qlt(profile?.balance), icon: "/icon-wallet.svg" },
    { label: "Referrals", value: number(profile?.referral_count), icon: "/icon-profile.svg" },
  ];

  return (
    <main className="page-body accountEarningsPage">
      <header className="accountPageHeader">
        <Link href="/creator" aria-label="Back to Home" className="accountBack"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg></Link>
        <div><p>YOUR ACCOUNT</p><h1>Account &amp; earnings</h1></div>
      </header>

      {error ? <div className="accountLoadError" role="alert">{error}<button type="button" onClick={() => window.location.reload()}>Try again</button></div> : null}
      {profile ? <div className="accountPageContent">
        <section className="accountOverviewCard">
          <header className="accountSectionHeading">
            <div><h2>Account overview</h2><p>Your QLT balance, mission progress, and referrals</p></div>
            <Link href="/wallet" className="walletDetailsLink">Wallet details <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M7 5h8v8" /></svg></Link>
          </header>
          <div className="accountMetricGrid">
            {stats.map(item => <article key={item.label} className={`accountMetric${item.label === "Balance" ? " balanceMetric" : ""}`}>
              <div className="accountMetricLabel"><Image src={item.icon} alt="" width={17} height={17} /><span>{item.label}</span></div>
              <strong>{item.value}</strong>
            </article>)}
          </div>
        </section>

        <section className="accountReviewCard">
          <div className="accountSubheading"><div><h2>Task review</h2><p>Your submitted mission results</p></div><span className="reviewRate">{successRate}%<small>success</small></span></div>
          <div className="reviewMetrics">
            <div><strong>{number(profile.approved_count)}</strong><span>Approved</span></div>
            <div><strong>{number(profile.rejected_count)}</strong><span>Rejected</span></div>
            <div><strong>{number(reviewed)}</strong><span>Reviewed</span></div>
          </div>
          {profile.trust_level === "new" && profile.approved_count < 5 ? <p className="accountHint">Complete {5 - profile.approved_count} more approved task{5 - profile.approved_count !== 1 ? "s" : ""} to become a Trusted User.</p> : null}
          {profile.trust_level === "flagged" ? <p className="accountWarning">Your account has been flagged due to a high rejection rate. Review mission requirements carefully.</p> : null}
        </section>

        <section className="accountReferralCard">
          <div className="referralCopy"><span className="accountEyebrow">INVITE YOUR COMMUNITY</span><h2>Refer &amp; earn 2,500 QLT + 10%</h2>
            <p>Code <strong>{profile.referral_code || "Not available"}</strong> · {number(profile.referral_count)} {profile.referral_count === 1 ? "person" : "people"} joined</p>
            <small>Earn 10% of your referrals’ earnings.</small>
          </div>
          <div className="referralActions"><button type="button" onClick={() => void copyCode()}>{copied ? "Copied" : "Copy code"}</button><button type="button" onClick={() => void shareInvite()}>Share invite</button></div>
        </section>
      </div> : null}

      <style jsx>{`
        .accountEarningsPage{min-height:100vh;padding:22px 18px 100px;background:var(--bg);color:var(--text)}
        .accountPageHeader{display:flex;align-items:center;gap:14px;width:min(100%,760px);margin:0 auto 18px;padding:6px 2px 17px;border-bottom:1px solid var(--border)}
        .accountPageHeader .accountBack,.accountPageHeader .accountBack:link,.accountPageHeader .accountBack:visited{display:grid;flex:0 0 42px;place-items:center;width:42px;height:42px;border:1px solid var(--border);border-radius:50%;background:var(--bg);color:var(--text);font-size:0;text-decoration:none!important;transition:background .15s,border-color .15s,transform .15s}
        .accountPageHeader .accountBack:hover{background:color-mix(in srgb,var(--text) 6%,var(--bg));border-color:#3a9b5c;transform:translateX(-2px)}
        .accountBack svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .accountPageHeader .accountBack:focus-visible{outline:3px solid #3a9b5c;outline-offset:3px}
        .accountPageHeader p{color:#32834e;font-size:10px;font-weight:850;letter-spacing:.14em}
        .accountPageHeader h1{margin-top:3px;font-size:22px;letter-spacing:-.035em}
        .accountPageContent{display:grid;gap:14px;width:min(100%,760px);margin:0 auto}
        .accountOverviewCard,.accountReviewCard{padding:17px;border:1px solid var(--border);border-radius:16px;background:var(--bg)}
        .accountSectionHeading,.accountSubheading{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .accountSectionHeading{margin:0 0 14px}.accountSectionHeading h2,.accountSubheading h2{font-size:17px;letter-spacing:-.02em}
        .accountSectionHeading p,.accountSubheading p{margin-top:3px;color:var(--muted);font-size:11px;line-height:1.4}
        .accountSectionHeading .walletDetailsLink,.accountSectionHeading .walletDetailsLink:link,.accountSectionHeading .walletDetailsLink:visited{display:inline-flex;align-items:center;justify-content:center;gap:7px;flex:0 0 auto;min-height:38px;padding:0 13px;border:1px solid #b9d9c2;border-radius:999px;background:#f3faf5;color:#28784d;font-size:11px;font-weight:750;text-decoration:none!important;white-space:nowrap;transition:background .15s,border-color .15s,transform .15s}
        .accountSectionHeading .walletDetailsLink:hover{border-color:#6db281;background:#e7f5eb;transform:translateY(-1px)}
        .walletDetailsLink svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .walletDetailsLink:focus-visible{outline:3px solid #3a9b5c;outline-offset:2px}
        .accountMetricGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
        .accountMetric{min-width:0;min-height:86px;padding:13px 14px;border:1px solid var(--border);border-radius:14px;background:color-mix(in srgb,var(--bg) 96%,#81c995)}
        .accountMetric.balanceMetric{border-color:#c5e2ce;background:linear-gradient(135deg,#eff9f2,#fff)}
        .accountMetricLabel{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:10px}.accountMetricLabel img{opacity:.75}
        .accountMetric>strong{display:block;margin-top:10px;color:var(--text);font-size:17px;letter-spacing:-.02em}.balanceMetric>strong{color:#21834d;font-size:20px}
        .accountReviewCard{padding:16px}.reviewRate{display:grid;justify-items:end;color:#298552;font-size:19px;font-weight:850}.reviewRate small{color:var(--muted);font-size:9px;font-weight:550}
        .reviewMetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:13px}.reviewMetrics>div{display:grid;justify-items:center;gap:4px;padding:12px 7px;border-radius:11px;background:color-mix(in srgb,var(--bg) 92%,#83c998)}
        .reviewMetrics>div:nth-child(2){background:color-mix(in srgb,var(--bg) 92%,#df8e86)}.reviewMetrics strong{color:#24804b;font-size:19px}.reviewMetrics>div:nth-child(2) strong{color:#c54c4c}.reviewMetrics span{color:var(--muted);font-size:10px}
        .accountHint,.accountWarning{margin:11px 0 0;padding:10px 11px;border-radius:10px;background:color-mix(in srgb,var(--bg) 88%,#89c99d);color:#477558;font-size:11px;line-height:1.45}.accountWarning{background:color-mix(in srgb,var(--bg) 88%,#e99a90);color:#a6453d}
        .accountReferralCard{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px;border:1px solid #e6d6b6;border-radius:16px;background:linear-gradient(115deg,color-mix(in srgb,var(--bg) 90%,#f3dba9),var(--bg))}
        .accountEyebrow{color:#a56b1d;font-size:9px;font-weight:850;letter-spacing:.13em}.referralCopy h2{margin-top:5px;color:var(--text);font-size:15px}.referralCopy p{margin-top:8px;color:var(--muted);font-size:11px}.referralCopy p strong{color:var(--text);letter-spacing:.04em}.referralCopy small{display:block;margin-top:4px;color:var(--muted);font-size:10px}
        .referralActions{display:flex;flex-shrink:0;gap:7px}.referralActions button{padding:9px 12px;border:1px solid #d8c49c;border-radius:10px;background:var(--bg);color:#855914;font-size:11px;font-weight:750;cursor:pointer}.referralActions button+button{border-color:#32834e;background:#32834e;color:#fff}
        .accountLoadError{display:flex;align-items:center;justify-content:space-between;gap:12px;width:min(100%,760px);margin:18px auto;padding:14px;border:1px solid #e4aaa3;border-radius:12px;color:var(--text)}.accountLoadError button{border:0;background:none;color:#32834e;font-weight:750;cursor:pointer}
        @media(max-width:520px){.accountEarningsPage{padding:14px 10px 96px}.accountPageHeader{margin-bottom:13px}.accountPageHeader h1{font-size:19px}.accountOverviewCard,.accountReviewCard{padding:13px}.accountMetric{min-height:82px;padding:11px}.accountMetric>strong{font-size:15px}.balanceMetric>strong{font-size:18px}.accountSectionHeading{align-items:flex-start}.accountSectionHeading h2{font-size:16px}.accountSectionHeading p{max-width:210px}.accountSectionHeading .walletDetailsLink{padding:0 10px;font-size:10px}.accountReferralCard{align-items:flex-start;flex-direction:column}.referralActions{width:100%}.referralActions button{flex:1}}
        :global([data-theme="dark"]) .accountMetric.balanceMetric{background:linear-gradient(135deg,#14251a,#111)}
        :global([data-theme="dark"]) .accountReferralCard{border-color:#594a2d;background:linear-gradient(115deg,#211c12,#111)}
        :global([data-theme="dark"]) .accountMetric{background:#151a17}
        :global([data-theme="dark"]) .reviewMetrics>div{background:#18231b}
        :global([data-theme="dark"]) .reviewMetrics>div:nth-child(2){background:#291817}
        :global([data-theme="dark"]) .accountSectionHeading .walletDetailsLink{background:#14251a;border-color:#31553b;color:#8bd89d}
      `}</style>
      <BottomNav />
    </main>
  );
}
