"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

export default function PremiumPage() {
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingCheckout, setStartingCheckout] = useState(false);

  useEffect(() => {
    const payment = new URLSearchParams(window.location.search).get("payment");
    if (payment === "success") setNotice("Payment confirmed. Your Premium access is active.");
    else if (payment === "pending") setNotice("Payment is still processing. Your Premium access will activate after confirmation.");
    else if (payment && payment !== "failed") setNotice("Checkout was not completed. You can try again when ready.");
    else if (payment === "failed") setNotice("Payment could not be confirmed. Please try again.");

    fetch("/api/premium", { cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (response.ok) { setActive(Boolean(data.active)); setPermanent(Boolean(data.permanent)); setEndsAt(data.endsAt || null); }
        else if (response.status === 401) setNotice("Sign in to subscribe to Premium.");
      })
      .catch(() => setNotice("Premium status could not be loaded. Please refresh and try again."))
      .finally(() => setLoading(false));
  }, []);

  const startSubscription = async () => {
    setStartingCheckout(true);
    setNotice("");
    try {
      const response = await fetch("/api/premium", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not start Premium checkout.");
      if (typeof data.authorizationUrl !== "string" || !/^https?:\/\//i.test(data.authorizationUrl)) throw new Error("The secure checkout link was not returned.");
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not start Premium checkout.");
      setStartingCheckout(false);
    }
  };

  return (
    <main className="page-body premiumPage">
      <header className="premiumHeader">
        <Link href="/creator" aria-label="Back to Home">←</Link>
        <div><span>QEXIOVA MEMBERSHIP</span><h1>Premium</h1></div>
      </header>
      <section className="premiumOffer">
        <div className="premiumMark" aria-hidden="true">✦</div>
        <p className="premiumEyebrow">PREMIUM MEMBERSHIP</p>
        <h2>More from your Qeixova journey</h2>
        <p className="premiumDescription">Unlock access to Premium missions and take part in more opportunities across the community.</p>
        <div className="premiumPrice"><span>₦</span>5,700</div>
        <p className="premiumPriceNote">One month of Premium access</p>
        <button type="button" className="premiumSubscribe" disabled={loading || active || startingCheckout} onClick={() => void startSubscription()}>{active ? "Premium active" : startingCheckout ? "Opening secure checkout…" : loading ? "Loading…" : "Subscribe for ₦5,700 / month"}</button>
        {active && permanent ? <p className="premiumSecure">Your account has permanent Premium access.</p> : active && endsAt ? <p className="premiumSecure">Your current access runs through {new Date(endsAt).toLocaleDateString([], { dateStyle: "medium" })}.</p> : null}
        {notice ? <p className="premiumNotice" role="status">{notice}</p> : !active ? <p className="premiumSecure">Secure payment powered by Flutterwave.</p> : null}
      </section>
      <section className="premiumBenefits" aria-labelledby="premium-benefits-title">
        <div className="benefitsHeading"><div><span>MEMBER BENEFITS</span><h2 id="premium-benefits-title">More ways to create and grow</h2></div><span className="benefitCount">7 benefits</span></div>
        <div className="benefitGrid">
          <article className="benefitCard"><span className="benefitIcon" aria-hidden="true">▧</span><div><h3>More media in your posts</h3><p>Share more pictures and longer videos with your community.</p></div></article>
          <article className="benefitCard"><span className="benefitIcon textIcon" aria-hidden="true">T</span><div><h3>Longer text posts</h3><p>Write more in each post and share the full story.</p></div></article>
          <article className="benefitCard"><span className="benefitIcon rewardIcon" aria-hidden="true">↗</span><div><h3>Higher reward missions</h3><p>Get access to more high-reward mission opportunities.</p></div></article>
          <article className="benefitCard"><span className="benefitIcon earnIcon" aria-hidden="true">₦</span><div><h3>Earn from your posts</h3><p>Qualifying posts can earn through creator monetization.</p></div></article>
          <article className="benefitCard"><span className="benefitIcon trustIcon" aria-hidden="true">↑</span><div><h3>Build your trust</h3><p>Premium membership helps your contributor trust grow over time.</p></div></article>
          <article className="benefitCard verifiedBenefit"><div className="verifiedPreview"><span className="verifiedAvatar">Q</span><span className="verifiedBadge" role="img" aria-label="Premium verified badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 14.5 4l2.8-.1 1.2 2.5 2.2 1.7-.6 2.7.6 2.7-2.2 1.7-1.2 2.5-2.8-.1-2.5 1.2-2.5-1.2-2.8.1-1.2-2.5-2.2-1.7.6-2.7-.6-2.7 2.2-1.7 1.2-2.5 2.8.1L12 2.8Z"/><path d="m8.4 12.1 2.3 2.2 4.9-5"/></svg></span><strong>Qeixova Premium</strong></div><div><h3>Green verified badge</h3><p>A distinctive green badge marks your Premium profile and posts.</p></div></article>
          <article className="benefitCard reachBenefit"><span className="benefitIcon reachIcon" aria-hidden="true">◎</span><div><h3>More post visibility</h3><p>Get increased reach so more contributors can discover your posts.</p></div><div className="reachSignal"><i/><i/><i/><i/><i/><span>Wider contributor reach</span></div></article>
        </div>
      </section>
      <style jsx>{`
        .premiumPage{min-height:100vh;padding:20px 16px 100px;background:var(--bg);color:var(--text)}
        .premiumHeader{display:flex;align-items:center;gap:14px;width:min(100%,680px);margin:0 auto 24px;padding-bottom:17px;border-bottom:1px solid var(--border)}
        .premiumHeader>a{display:grid;place-items:center;width:42px;height:42px;border:1px solid var(--border);border-radius:50%;color:var(--text);font-size:23px;text-decoration:none}
        .premiumHeader span{color:#30814b;font-size:10px;font-weight:850;letter-spacing:.13em}.premiumHeader h1{margin-top:3px;font-size:22px;letter-spacing:-.03em}
        .premiumOffer{position:relative;overflow:hidden;width:min(100%,560px);margin:0 auto;padding:32px 25px 25px;border:1px solid #cde5d3;border-radius:22px;background:linear-gradient(145deg,#f0f9f2 0%,var(--bg) 74%);text-align:center;box-shadow:0 10px 35px rgba(35,105,60,.08)}
        .premiumOffer:before{position:absolute;inset:0 0 auto;height:5px;background:linear-gradient(90deg,#21a255,#8bd89d);content:""}
        .premiumMark{display:grid;place-items:center;width:54px;height:54px;margin:0 auto 15px;border-radius:17px;background:#dff2e4;color:#278049;font-size:29px}
        .premiumEyebrow{color:#398354;font-size:10px;font-weight:850;letter-spacing:.14em}.premiumOffer h2{margin-top:8px;font-size:25px;letter-spacing:-.045em}.premiumDescription{max-width:390px;margin:10px auto 20px;color:var(--muted);font-size:14px;line-height:1.55}
        .premiumPrice{color:var(--text);font-size:43px;font-weight:850;letter-spacing:-.05em}.premiumPrice span{margin-right:3px;color:#32834e;font-size:25px}.premiumPriceNote{margin-top:1px;color:var(--muted);font-size:11px}
        .premiumSubscribe{width:100%;max-width:360px;margin-top:22px;padding:14px 18px;border:0;border-radius:999px;background:#2e8b50;color:#fff;font-size:14px;font-weight:800;cursor:pointer;transition:background .15s,transform .15s}.premiumSubscribe:hover:not(:disabled){background:#247342;transform:translateY(-1px)}.premiumSubscribe:focus-visible{outline:3px solid #8bd89d;outline-offset:3px}.premiumSubscribe:disabled{opacity:.72;cursor:default}
        .premiumSecure,.premiumNotice{margin-top:11px;color:var(--muted);font-size:11px;line-height:1.5}.premiumNotice{color:#875d1d}
        .premiumBenefits{width:min(100%,760px);margin:25px auto 0}.benefitsHeading{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:12px}.benefitsHeading>div>span{color:#398354;font-size:9px;font-weight:850;letter-spacing:.14em}.benefitsHeading h2{margin-top:4px;font-size:20px;letter-spacing:-.03em}.benefitCount{padding:6px 10px;border:1px solid var(--border);border-radius:999px;color:var(--muted);font-size:10px;white-space:nowrap}
        .benefitGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.benefitCard{display:flex;align-items:flex-start;gap:12px;min-height:112px;padding:15px;border:1px solid var(--border);border-radius:15px;background:var(--bg);box-shadow:0 3px 12px rgba(20,40,25,.035)}.benefitIcon{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:12px;background:#eaf6ed;color:#2a8850;font-size:21px;font-weight:800}.textIcon{font-family:Georgia,serif;font-size:19px}.rewardIcon{background:#fff5df;color:#b27617}.earnIcon{background:#e9f5ed;color:#21834d}.trustIcon{background:#eef3ff;color:#5877be}.benefitCard h3{font-size:13px;line-height:1.35;letter-spacing:-.01em}.benefitCard p{margin-top:5px;color:var(--muted);font-size:11px;line-height:1.5}.verifiedBenefit{align-items:center;flex-wrap:wrap;border-color:#b9ddc3;background:linear-gradient(130deg,#f1faf3,var(--bg))}.verifiedPreview{display:flex;align-items:center;gap:7px;width:100%;padding-bottom:9px;border-bottom:1px solid #d9eadc}.verifiedAvatar{display:grid;place-items:center;width:29px;height:29px;border-radius:50%;background:#dcefe2;color:#267b48;font-size:12px;font-weight:900}.verifiedBadge{display:grid;place-items:center;width:19px;height:19px;margin-left:-13px;margin-top:20px;border-radius:50%;background:#2f9a58;box-shadow:0 0 0 2px var(--bg)}.verifiedBadge svg{width:15px;height:15px;fill:none;stroke:white;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.verifiedPreview strong{color:#267b48;font-size:11px}.verifiedBenefit>div:last-child{display:block}.verifiedBenefit h3{color:#267b48}.reachBenefit{display:grid;grid-template-columns:38px minmax(0,1fr);column-gap:12px}.reachBenefit>div:nth-child(2){align-self:center}.reachIcon{background:#edf6ff;color:#3180bb}.reachSignal{display:flex;align-items:flex-end;gap:4px;grid-column:2;margin-top:2px}.reachSignal i{width:8px;border-radius:5px 5px 2px 2px;background:linear-gradient(#4ab96d,#20824b)}.reachSignal i:nth-child(1){height:8px}.reachSignal i:nth-child(2){height:12px}.reachSignal i:nth-child(3){height:16px}.reachSignal i:nth-child(4){height:21px}.reachSignal i:nth-child(5){height:27px}.reachSignal span{align-self:center;margin-left:6px;color:var(--muted);font-size:9px}
        :global([data-theme="dark"]) .premiumOffer{border-color:#31553b;background:linear-gradient(145deg,#14251a 0%,var(--bg) 75%)}
        :global([data-theme="dark"]) .premiumMark{background:#203b29;color:#8bd89d}
        :global([data-theme="dark"]) .premiumDetails span{background:#203b29;color:#8bd89d}
        :global([data-theme="dark"]) .benefitCard{background:#121714;box-shadow:none}
        :global([data-theme="dark"]) .verifiedBenefit{border-color:#31553b;background:linear-gradient(130deg,#14251a,var(--bg))}
        :global([data-theme="dark"]) .verifiedPreview{border-color:#294832}
        :global([data-theme="dark"]) .verifiedBadge{box-shadow:0 0 0 2px #14251a}
        @media(max-width:600px){.premiumBenefits{margin-top:21px}.benefitGrid{grid-template-columns:1fr}.benefitCard{min-height:unset;padding:13px}.verifiedBenefit{display:flex;flex-wrap:wrap}.reachBenefit{display:grid;grid-template-columns:38px minmax(0,1fr)}}
        @media(max-width:520px){.premiumPage{padding:14px 10px 96px}.premiumHeader{margin-bottom:17px}.premiumOffer{padding:27px 17px 21px;border-radius:18px}.premiumOffer h2{font-size:22px}.premiumDescription{font-size:13px}.premiumPrice{font-size:39px}.benefitsHeading h2{font-size:18px}}
      `}</style>
      <BottomNav />
    </main>
  );
}
