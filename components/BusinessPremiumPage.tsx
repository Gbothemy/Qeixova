"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BusinessBottomNav from "@/components/BusinessBottomNav";
import BusinessLoading from "@/components/BusinessLoading";
import BusinessSidebar from "@/components/BusinessSidebar";

type Membership = { active: boolean; permanent?: boolean; endsAt: string | null; monthlyPrice: number };

export default function BusinessPremiumPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/business/me", { cache: "no-store" }),
      fetch("/api/business/premium", { cache: "no-store" }),
    ]).then(async ([businessResponse, premiumResponse]) => {
      if (!businessResponse.ok || !premiumResponse.ok) { router.replace("/business/login"); return; }
      const [businessData, premiumData] = await Promise.all([businessResponse.json(), premiumResponse.json()]);
      if (!active) return;
      setBusinessName(businessData.business?.name || "Business");
      setMembership(premiumData);
    }).catch(() => { if (active) setError("Business Premium details could not load. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const subscribe = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/business/premium", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not start Business Premium checkout.");
      if (typeof data.authorizationUrl !== "string" || !data.authorizationUrl.startsWith("https://")) throw new Error("The payment provider did not return a valid checkout link.");
      window.location.assign(data.authorizationUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setBusy(false);
    }
  };

  if (loading || !membership) return <BusinessLoading title="Loading Business Premium" detail="Checking your membership and account access." />;

  return <main className="businessPremiumPage"><BusinessSidebar name={businessName}/><div className="businessPremiumMain">
    <Link href="/business/creator" className="premiumBack">← <span>Creator feed</span></Link>
    <header className="premiumHeading"><span>QEIXOVA BUSINESS MEMBERSHIP</span><h1>Business Premium</h1><p>Give {businessName} more ways to share updates with the Qeixova community.</p></header>
    {error ? <p className="premiumError" role="alert">{error}</p> : null}
    <section className="premiumPlan"><div className="premiumPlanCopy"><span className="premiumPlanEyebrow">BUSINESS CREATOR PLAN</span><h2>{membership.active ? "Your membership is active" : "Grow your business in the community"}</h2><p>Publish updates to the same Creator feed contributors already use. Start with short posts for free and upgrade when you need more room to tell your story.</p><div className="premiumPrice"><strong>₦{Number(membership.monthlyPrice).toLocaleString("en-NG")}</strong><span>/ month</span></div><button type="button" onClick={() => void subscribe()} disabled={busy || membership.active}>{membership.active ? "Premium active" : busy ? "Opening secure checkout…" : "Activate Business Premium"}</button>{membership.active ? <p className="premiumStatus">{membership.permanent ? "Your account has permanent access." : membership.endsAt ? `Your membership is active through ${new Date(membership.endsAt).toLocaleDateString([], { dateStyle: "long" })}.` : "Your membership is active."}</p> : <small>Secure payment powered by Flutterwave. Cancel anytime through your billing settings.</small>}</div><div className="premiumBenefits"><h3>Included with Premium</h3><ul><li><span>✓</span><div><strong>Longer updates</strong><small>Post up to 1,200 characters.</small></div></li><li><span>✓</span><div><strong>Photo posts</strong><small>Share product, team, and event images.</small></div></li><li><span>✓</span><div><strong>Video posts</strong><small>Show short clips in the shared feed.</small></div></li><li><span>✓</span><div><strong>One shared community</strong><small>Your posts appear alongside contributor posts.</small></div></li></ul></div></section>
    <p className="premiumFooter">Your current free access includes short text updates up to 280 characters.</p>
  </div><BusinessBottomNav/><style jsx>{`
    .businessPremiumPage{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh;background:var(--bg);color:var(--text)}.businessPremiumMain{width:min(100%,1100px);margin:0 auto;padding:28px 28px 110px}.premiumBack{display:inline-flex;align-items:center;gap:8px;margin-bottom:24px;color:var(--text);font-size:20px;font-weight:750;text-decoration:none}.premiumBack span{font-size:12px;font-weight:650}.premiumHeading{margin-bottom:24px}.premiumHeading>span,.premiumPlanEyebrow{color:#328456;font-size:10px;font-weight:850;letter-spacing:.13em}.premiumHeading h1{margin-top:6px;font-size:clamp(27px,4vw,36px)}.premiumHeading p{margin-top:8px;color:var(--muted);font-size:13px;line-height:1.55}.premiumPlan{display:grid;grid-template-columns:1.1fr .9fr;overflow:hidden;border:1px solid #c7e1ce;border-radius:22px;background:var(--card-bg);box-shadow:0 12px 36px #21472b0b}.premiumPlanCopy{padding:clamp(22px,4vw,40px);background:linear-gradient(145deg,#eff8f1,var(--card-bg))}.premiumPlanCopy h2{max-width:450px;margin-top:10px;font-size:clamp(21px,3vw,29px);line-height:1.2}.premiumPlanCopy>p{max-width:490px;margin-top:11px;color:var(--muted);font-size:13px;line-height:1.65}.premiumPrice{display:flex;align-items:baseline;gap:6px;margin:24px 0 15px}.premiumPrice strong{font-size:32px}.premiumPrice span{color:var(--muted);font-size:13px}.premiumPlanCopy>button{width:min(100%,400px);min-height:50px;border:0;border-radius:999px;background:#2d8c50;color:#fff;font:inherit;font-size:13px;font-weight:850;cursor:pointer}.premiumPlanCopy>button:disabled{opacity:.7;cursor:default}.premiumPlanCopy>small,.premiumStatus{display:block;margin-top:12px;color:var(--muted);font-size:10px;line-height:1.5}.premiumBenefits{padding:clamp(22px,4vw,38px)}.premiumBenefits h3{margin-bottom:15px;font-size:17px}.premiumBenefits ul{display:grid;gap:15px;margin:0;padding:0;list-style:none}.premiumBenefits li{display:flex;gap:11px;align-items:flex-start}.premiumBenefits li>span{display:grid;place-items:center;flex:0 0 24px;width:24px;height:24px;border-radius:50%;background:#e4f2e8;color:#287847;font-size:13px;font-weight:900}.premiumBenefits li div{display:grid;gap:4px}.premiumBenefits strong{font-size:12px}.premiumBenefits small{color:var(--muted);font-size:11px;line-height:1.45}.premiumFooter{margin-top:14px;color:var(--muted);font-size:11px}.premiumError{margin-bottom:14px;padding:12px;border-radius:10px;background:#fff0f0;color:#a63333;font-size:12px}
    @media(max-width:760px){.businessPremiumPage{display:block}.businessPremiumMain{padding:18px 14px 105px}.premiumBack{margin-bottom:19px}.premiumPlan{grid-template-columns:1fr}.premiumPlanCopy{padding:22px}.premiumBenefits{padding:22px;border-top:1px solid var(--border)}}
  `}</style></main>;
}
