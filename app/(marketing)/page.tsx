"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { WITHDRAWAL_UNLOCK_QLT } from "@/lib/rewardRules";

const campaignTypes = [
  { icon: "/icon-social-media.svg", title: "WhatsApp Status Campaign", desc: "Share flyers and content to WhatsApp status for 24 hours." },
  { icon: "/icon-survey.svg",       title: "Facebook Repost Campaign", desc: "Post flyers with captions to Facebook stories and timelines." },
  { icon: "/icon-content.svg",      title: "TikTok Promotion",         desc: "Repost short-form videos and tag creator pages." },
  { icon: "/icon-app-testing.svg",  title: "App Testing",              desc: "Download apps and submit onboarding feedback." },
  { icon: "/icon-survey.svg",       title: "Referral Campaign",        desc: "Invite new users and earn for every successful referral." },
  { icon: "/icon-social-media.svg", title: "Music Promotion",          desc: "Distribute song teasers and promote releases across communities." },
];

const businessTypes = [
  { icon: "/icon-local-business.svg", title: "Local Businesses",          desc: "Promote products, services, store openings, events, and special offers to nearby communities." },
  { icon: "/icon-music.svg",          title: "Musicians & Entertainment", desc: "Distribute songs, promote releases, push trends, and create grassroots awareness." },
  { icon: "/icon-startup.svg",        title: "Startups & Apps",           desc: "Get real users for testing, onboarding, reviews, and feedback." },
  { icon: "/icon-creator.svg",        title: "Content Creators",          desc: "Increase awareness for videos, pages, live streams, and creator content." },
  { icon: "/icon-events.svg",         title: "Event Organizers",          desc: "Spread awareness for concerts, church programs, conferences, and community events." },
  { icon: "/icon-community.svg",      title: "Communities & NGOs",        desc: "Mobilize grassroots participation and community-driven campaigns." },
];

const whyFeatures = [
  { icon: "/icon-human-distribution.svg", title: "Human Distribution",      desc: "Reach people through real individuals and communities instead of relying only on algorithms." },
  { icon: "/icon-affordable.svg",         title: "Affordable Awareness",    desc: "Launch flexible campaigns that fit your budget and goals." },
  { icon: "/icon-grassroots.svg",         title: "Grassroots Reach",        desc: "Expand visibility organically through community-driven promotion." },
  { icon: "/icon-flexible.svg",           title: "Flexible Campaign Types", desc: "Run awareness, engagement, testing, referral, and distribution campaigns from one platform." },
  { icon: "/icon-verified.svg",           title: "Verified Participation",  desc: "Campaigns are completed by real contributors with verification and quality checks." },
  { icon: "/icon-creator-friendly.svg",   title: "Creator-Friendly",        desc: "Perfect for creators, musicians, startups, local businesses, and growing brands." },
];

const steps = [
  { num: "01", icon: "/icon-create-mission.svg", title: "Create a Campaign",           desc: "Upload your flyer, video, product, music, event, app, or promotional content." },
  { num: "02", icon: "/icon-target-audience.svg",title: "Choose Your Goal",            desc: "Select content distribution, reposts, community awareness, app testing, surveys, or referral campaigns." },
  { num: "03", icon: "/icon-profile.svg",         title: "Activate Real Participants", desc: "Qeixova contributors complete tasks and help spread your content across real communities." },
  { num: "04", icon: "/icon-analytics.svg",       title: "Track Visibility",           desc: "Monitor campaign performance, submissions, reach activity, and contributor engagement." },
];

const faqs = [
  { q: "What is Qeixova Tasks?",                  a: "Qeixova Tasks is a community-powered growth platform where businesses gain visibility and contributors earn through meaningful digital participation — not bots or fake traffic." },
  { q: "Who can use Qeixova?",                    a: "Any business, creator, musician, startup, event organizer, or community that wants to grow visibility through real human participation. Contributors earn by completing campaigns." },
  { q: "How do contributors earn?",               a: "Contributors complete participation tasks — sharing flyers, reposting content, testing apps, joining campaigns — and earn QLT rewards. 10 QLT = ₦1. Withdraw to any Nigerian bank." },
  { q: "Is this real engagement or fake?",        a: "Real. Every contributor is verified. No bots, no fake accounts, no spam. Campaigns are completed by real people with quality checks and fraud prevention." },
  { q: "How do withdrawals work?",                a: `Contributors earn QLT by completing tasks. Once you reach ${WITHDRAWAL_UNLOCK_QLT.toLocaleString()} QLT lifetime earnings, withdrawals unlock. Minimum withdrawal is processed within 24 hours to your bank.` },
  { q: "How much does a campaign cost?",          a: "You set the reward per completion and the total budget. You only pay for verified completions — no wasted spend on impressions or clicks that don't convert." },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.12 }
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(26,239,34,${p.alpha})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  // Automatically cycle through the process steps unless reduced motion is preferred.
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    const intervalId = window.setInterval(() => {
      setActiveStep(current => (current + 1) % steps.length);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div style={{ background: "#000000", color: "#F5F5F5", overflowX: "hidden" }}>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(0,0,0,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1a1a1a", padding: "0 5vw", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image src="/qeixova-icon.png" alt="Qeixova" width={32} height={32} style={{ borderRadius: 9, objectFit: "contain" }} />
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.5 }}>Qeixova</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Link href="/login" style={{ fontSize: 13, fontWeight: 600, color: "#1AEF22", textDecoration: "none", padding: "8px 12px", whiteSpace: "nowrap" }}>Login</Link>
          <Link href="/register" style={{ fontSize: 13, fontWeight: 700, color: "#000", textDecoration: "none", padding: "9px 16px", background: "linear-gradient(135deg, #1AEF22, #06B517)", borderRadius: 9, boxShadow: "0 4px 14px rgba(26,239,34,0.3)", whiteSpace: "nowrap" }}>Get Started</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: "linear-gradient(160deg, #050505 0%, #0d0d0d 100%)", padding: "36px 5vw 52px", textAlign: "center", borderBottom: "1px solid #1a1a1a", position: "relative", overflow: "hidden" }}>
        <canvas ref={canvasRef} id="landing-particles" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(26,239,34,0.06) 0%, transparent 70%)" }} />
        <div className="animate-fade-up" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(26,239,34,0.08)", border: "1px solid rgba(26,239,34,0.2)", borderRadius: 20, padding: "6px 16px", marginBottom: 28 }}>
          <div className="animate-pulse-glow" style={{ width: 6, height: 6, borderRadius: "50%", background: "#1AEF22" }} />
          <span style={{ fontSize: 12, color: "#1AEF22", fontWeight: 700 }}>Community-Powered Digital Growth</span>
        </div>
        <h1 className="animate-fade-up delay-1" style={{ fontSize: "clamp(30px, 6vw, 64px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: -2, maxWidth: 820, margin: "0 auto 20px", color: "#F5F5F5", position: "relative" }}>
          Grow Your Business Through<br />
          <span className="shimmer-text">Real Human Participation.</span>
        </h1>
        <p className="animate-fade-up delay-2" style={{ fontSize: "clamp(14px, 2vw, 18px)", color: "#ccc", maxWidth: 620, margin: "0 auto 16px", lineHeight: 1.7, position: "relative" }}>
          Qeixova Tasks helps businesses, creators, brands, musicians, and communities amplify their visibility through real people — not bots, fake traffic, or empty engagement.
        </p>
        <p className="animate-fade-up delay-3" style={{ fontSize: 14, color: "#bbb", maxWidth: 560, margin: "0 auto 36px", lineHeight: 1.7, position: "relative" }}>
          Launch awareness campaigns, distribute content, gather engagement, grow communities, and reach real audiences through a network of verified digital participants.
        </p>
        <div className="animate-fade-up delay-4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
          <Link href="/register" className="btn-amber-glow" style={{ background: "linear-gradient(135deg, #F5A623, #d89420)", color: "#000", textDecoration: "none", padding: "16px 36px", borderRadius: 14, fontWeight: 800, fontSize: 16, boxShadow: "0 8px 28px rgba(245,166,35,0.4)", transition: "all 0.2s ease" }}>
            Start a Campaign
          </Link>
          <Link href="/register" className="btn-glow" style={{ background: "#111", border: "1.5px solid #222", color: "#F5F5F5", textDecoration: "none", padding: "16px 32px", borderRadius: 14, fontWeight: 600, fontSize: 15, transition: "all 0.2s ease" }}>
            Become a Contributor
          </Link>
        </div>
        <p className="animate-fade-up delay-5" style={{ color: "#999", fontSize: 12, marginTop: 18, position: "relative" }}>Trusted for community-powered growth, content distribution, and grassroots digital promotion.</p>
      </section>

      {/* Trust strip */}
      <section style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a", padding: "18px 5vw" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 28, flexWrap: "wrap" }}>
          {["Verified contributors only", "Pay per completion", "Real human participation", "Transparent QLT conversion", "24h withdrawal processing"].map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#1AEF22", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#ccc", fontWeight: 500 }}>{t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 2 — What Qeixova Does */}
      <section style={{ padding: "32px 5vw 48px", background: "#000" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1AEF22", letterSpacing: 2, textTransform: "uppercase", background: "rgba(26,239,34,0.08)", borderRadius: 20, padding: "4px 14px" }}>What We Do</span>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 42px)", fontWeight: 900, color: "#F5F5F5", marginTop: 14, letterSpacing: -1, marginBottom: 20 }}>More Than Tasks. A Human-Powered Growth Engine.</h2>
          <p style={{ fontSize: 16, color: "#ccc", lineHeight: 1.8, marginBottom: 16 }}>
            Qeixova Tasks connects businesses and creators with real people who help distribute, promote, test, share, and amplify content across digital communities.
          </p>
          <p style={{ fontSize: 15, color: "#bbb", lineHeight: 1.8 }}>
            Instead of relying only on expensive ads or unpredictable algorithms, brands can activate real human participation to increase awareness and visibility.
          </p>
        </div>
      </section>

      {/* SECTION 3 — How It Works */}
      <section id="how-it-works" style={{ padding: "32px 5vw 48px", background: "#050505", borderTop: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 34 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1AEF22", letterSpacing: 2, textTransform: "uppercase", background: "rgba(26,239,34,0.08)", borderRadius: 20, padding: "4px 14px" }}>Simple Process</span>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, color: "#F5F5F5", marginTop: 14, letterSpacing: -1 }}>How Qeixova Works</h2>
          </div>

          {/* Carousel — all screen sizes */}
          <div style={{ position: "relative" }}>
            {/* Single card display */}
            <div style={{ overflow: "hidden", borderRadius: 20 }}>
              <div style={{ display: "flex", transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)", transform: `translateX(-${activeStep * 100}%)` }}>
                {steps.map(s => (
                  <div key={s.num} style={{ minWidth: "100%", textAlign: "center", background: "linear-gradient(135deg, #0a1a0a, #0d1f0d)", borderRadius: 20, padding: "48px 40px", border: "1px solid rgba(26,239,34,0.15)", boxSizing: "border-box", boxShadow: "0 0 40px rgba(26,239,34,0.05)" }}>
                    <div style={{ width: 88, height: 88, borderRadius: 24, background: "linear-gradient(135deg, #1AEF22, #06B517)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", boxShadow: "0 8px 32px rgba(26,239,34,0.35)" }}>
                      <Image src={s.icon} alt={s.title} width={40} height={40} style={{ objectFit: "contain", filter: "brightness(0)" }} />
                    </div>
                    <h3 style={{ fontWeight: 900, fontSize: "clamp(20px, 3vw, 28px)", color: "#F5F5F5", marginBottom: 14, letterSpacing: -0.5 }}>{s.title}</h3>
                    <p style={{ fontSize: "clamp(14px, 1.5vw, 16px)", color: "#ccc", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 4 — For Businesses */}
      <section id="for-businesses" style={{ padding: "32px 5vw 48px", background: "#000" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 34 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#F5A623", letterSpacing: 2, textTransform: "uppercase", background: "rgba(245,166,35,0.08)", borderRadius: 20, padding: "4px 14px" }}>For Businesses</span>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, color: "#F5F5F5", marginTop: 14, letterSpacing: -1 }}>Built for Businesses That Want Visibility</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 40 }}>
            {businessTypes.map((b, i) => (
              <div key={b.title} className={`reveal card-hover delay-${i + 1}`} style={{ background: "#0a0a0a", borderRadius: 18, padding: "24px 20px", border: "1px solid #1a1a1a" }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: "rgba(26,239,34,0.06)", border: "1px solid rgba(26,239,34,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Image src={b.icon} alt={b.title} width={24} height={24} style={{ objectFit: "contain", filter: "invert(58%) sepia(98%) saturate(400%) hue-rotate(83deg) brightness(110%)" }} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: 14, color: "#F5F5F5", marginBottom: 8 }}>{b.title}</h3>
                <p style={{ fontSize: 13, color: "#bbb", lineHeight: 1.6 }}>{b.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ background: "linear-gradient(135deg, #0d0d0d, #111)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 20, padding: "32px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#F5F5F5", marginBottom: 8 }}>Ready to launch your first campaign?</p>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {["Pay per completion", "Verified contributors", "Real human reach"].map(t => (
                  <span key={t} style={{ fontSize: 12, color: "#ccc" }}><span style={{ color: "#F5A623" }}>✓</span> {t}</span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/register" style={{ background: "linear-gradient(135deg, #F5A623, #d89420)", color: "#000", textDecoration: "none", padding: "12px 24px", borderRadius: 11, fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>
                Start a Campaign →
              </Link>
              <Link href="/business/login" style={{ background: "transparent", border: "1.5px solid #333", color: "#ccc", textDecoration: "none", padding: "12px 20px", borderRadius: 11, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>
                Business Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — For Contributors */}
      <section id="contributors" className="contributors-section" style={{ padding: "32px 5vw 48px", background: "#050505", borderTop: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="contributors-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
            <div className="contributors-copy">
              <span style={{ display: "inline-flex", fontSize: 11, fontWeight: 700, color: "#1AEF22", letterSpacing: 2, textTransform: "uppercase", background: "rgba(26,239,34,0.08)", borderRadius: 20, padding: "4px 14px" }}>For Contributors</span>
              <h2 className="contributors-title" style={{ fontSize: "clamp(22px, 3.5vw, 38px)", fontWeight: 900, color: "#F5F5F5", marginTop: 14, letterSpacing: 0, marginBottom: 16 }}>Earn By Helping Businesses Grow</h2>
              <p style={{ fontSize: 15, color: "#ccc", lineHeight: 1.8, marginBottom: 20 }}>
                Become part of a growing network of digital contributors helping brands and creators reach more people online.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
                {["Reposting content", "Sharing flyers", "Testing apps", "Joining campaigns", "Giving feedback", "Referral activities"].map(t => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#1AEF22", flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: "#ccc" }}>{t}</span>
                  </div>
                ))}
              </div>
              <Link href="/register" className="contributors-cta" style={{ display: "inline-block", background: "linear-gradient(135deg, #1AEF22, #06B517)", color: "#000", textDecoration: "none", padding: "14px 32px", borderRadius: 12, fontWeight: 800, fontSize: 15 }}>
                Start Earning →
              </Link>
            </div>
            <div className="contributors-card" style={{ background: "#0a0a0a", borderRadius: 20, padding: "32px 28px", border: "1px solid #1a1a1a" }}>
              <div className="contributors-proof" style={{ background: "rgba(26,239,34,0.06)", border: "1px solid rgba(26,239,34,0.12)", borderRadius: 14, padding: "20px", marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1AEF22", marginBottom: 6 }}>Not fake engagement.</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1AEF22", marginBottom: 6 }}>Real participation.</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1AEF22", marginBottom: 6 }}>Real contribution.</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1AEF22" }}>Real rewards.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Starter → Bronze", desc: "Earn 50,001 QLT to unlock withdrawals" },
                  { label: "Bronze → Silver", desc: "200,001 QLT lifetime earned" },
                  { label: "Silver → Gold", desc: "500,001 QLT lifetime earned" },
                  { label: "Gold → VIP", desc: "1,000,001 QLT lifetime earned" },
                ].map(l => (
                  <div className="contributors-level" key={l.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #111" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#F5F5F5" }}>{l.label}</span>
                    <span style={{ fontSize: 11, color: "#aaa" }}>{l.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — Why Qeixova */}
      <section style={{ padding: "32px 5vw 48px", background: "#000" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 34 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1AEF22", letterSpacing: 2, textTransform: "uppercase", background: "rgba(26,239,34,0.08)", borderRadius: 20, padding: "4px 14px" }}>Why Qeixova</span>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, color: "#F5F5F5", marginTop: 14, letterSpacing: -1 }}>Why Businesses Choose Qeixova</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {whyFeatures.map((f, i) => (
              <div key={f.title} className={`reveal card-hover delay-${i + 1}`} style={{ background: "#0a0a0a", borderRadius: 16, padding: "22px 18px", border: "1px solid #1a1a1a" }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(26,239,34,0.06)", border: "1px solid rgba(26,239,34,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Image src={f.icon} alt={f.title} width={20} height={20} style={{ objectFit: "contain", filter: "invert(58%) sepia(98%) saturate(400%) hue-rotate(83deg) brightness(110%)" }} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: 14, color: "#F5F5F5", marginBottom: 6 }}>{f.title}</h3>
                <p style={{ fontSize: 12, color: "#bbb", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7 — Campaign Examples */}
      <section style={{ padding: "32px 5vw 48px", background: "#050505", borderTop: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 34 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#F5A623", letterSpacing: 2, textTransform: "uppercase", background: "rgba(245,166,35,0.08)", borderRadius: 20, padding: "4px 14px" }}>Campaign Examples</span>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, color: "#F5F5F5", marginTop: 14, letterSpacing: -1 }}>What You Can Promote</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {campaignTypes.map((c, i) => (
              <div key={c.title} className={`reveal card-hover delay-${i + 1}`} style={{ background: "#0a0a0a", borderRadius: 16, padding: "22px 18px", border: "1px solid #1a1a1a" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(26,239,34,0.06)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Image src={c.icon} alt={c.title} width={24} height={24} style={{ objectFit: "contain" }} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 14, color: "#F5F5F5", marginBottom: 6 }}>{c.title}</h3>
                <p style={{ fontSize: 12, color: "#bbb", lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8 — Vision */}
      <section style={{ padding: "32px 5vw 48px", background: "#000" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1AEF22", letterSpacing: 2, textTransform: "uppercase", background: "rgba(26,239,34,0.08)", borderRadius: 20, padding: "4px 14px" }}>Our Vision</span>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, color: "#F5F5F5", marginTop: 14, letterSpacing: -1, marginBottom: 20 }}>Building Africa&apos;s Human Participation Network</h2>
          <p style={{ fontSize: 16, color: "#ccc", lineHeight: 1.8, marginBottom: 16 }}>
            Qeixova Tasks is building a digital ecosystem where businesses gain visibility, creators grow faster, and contributors earn through meaningful online participation.
          </p>
          <p style={{ fontSize: 15, color: "#bbb", lineHeight: 1.8 }}>
            We believe growth should not belong only to companies with large advertising budgets. Through community-powered distribution and participation, we help brands and creators reach people in a more human way.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "32px 5vw 48px", background: "#050505", borderTop: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1AEF22", letterSpacing: 2, textTransform: "uppercase", background: "rgba(26,239,34,0.08)", borderRadius: 20, padding: "4px 14px" }}>FAQ</span>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 36px)", fontWeight: 900, color: "#F5F5F5", marginTop: 14, letterSpacing: -1 }}>Common Questions</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{ background: openFaq === i ? "#0d0d0d" : "#050505", border: `1.5px solid ${openFaq === i ? "rgba(26,239,34,0.2)" : "#1a1a1a"}`, borderRadius: 14, overflow: "hidden" }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i} aria-controls={`faq-answer-${i}`} style={{ width: "100%", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#F5F5F5" }}>{faq.q}</span>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: openFaq === i ? "#1AEF22" : "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: openFaq === i ? "#000" : "#ccc", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                    {openFaq === i ? "−" : "+"}
                  </span>
                </button>
                {openFaq === i && <p id={`faq-answer-${i}`} style={{ padding: "0 18px 16px", fontSize: 13, color: "#ccc", lineHeight: 1.7 }}>{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 9 — Final CTA */}
      <section style={{ background: "#050505", borderTop: "1px solid #1a1a1a", padding: "32px 5vw 48px", textAlign: "center" }}>
        <div style={{ marginBottom: 20 }}>
          <Image src="/qeixova-icon.png" alt="Qeixova" width={64} height={64} className="animate-float" style={{ objectFit: "contain", borderRadius: 18 }} />
        </div>
        <h2 style={{ fontSize: "clamp(24px, 5vw, 48px)", fontWeight: 900, color: "#F5F5F5", letterSpacing: -1.5, marginBottom: 14 }}>
          Launch Your First Growth<br />
          <span style={{ background: "linear-gradient(135deg, #1AEF22, #06B517)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Campaign Today.</span>
        </h2>
        <p style={{ color: "#ccc", fontSize: 15, maxWidth: 480, margin: "0 auto 36px", lineHeight: 1.7 }}>
          Whether you&apos;re promoting a business, a song, an event, an app, or a brand — Qeixova helps you reach real people through real participation.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" style={{ background: "linear-gradient(135deg, #F5A623, #d89420)", color: "#000", textDecoration: "none", padding: "16px 36px", borderRadius: 14, fontWeight: 800, fontSize: 16, boxShadow: "0 8px 28px rgba(245,166,35,0.4)", display: "inline-block" }}>
            Create Campaign
          </Link>
          <Link href="/register" style={{ background: "#111", border: "1.5px solid #222", color: "#F5F5F5", textDecoration: "none", padding: "16px 28px", borderRadius: 14, fontWeight: 600, fontSize: 15, display: "inline-block" }}>
            Become a Contributor
          </Link>
        </div>
        <p style={{ color: "#999", fontSize: 12, marginTop: 16 }}>Free to join. No experience needed.</p>
      </section>

      {/* Footer */}
      <footer style={{ background: "#000", borderTop: "1px solid #111", padding: "40px 5vw 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 36, marginBottom: 44 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Image src="/qeixova-icon.png" alt="Qeixova" width={32} height={32} style={{ borderRadius: 9, objectFit: "contain" }} />
                <span style={{ fontWeight: 800, fontSize: 16, color: "#F5F5F5" }}>Qeixova</span>
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.8, color: "#aaa", maxWidth: 200 }}>Community-Powered Digital Growth.</p>
              <p style={{ fontSize: 11, color: "#999", marginTop: 8, lineHeight: 1.6 }}>Helping businesses, creators, and communities grow through human participation.</p>
            </div>
            <div>
              <p style={{ color: "#F5F5F5", fontWeight: 700, fontSize: 12, marginBottom: 14 }}>Platform</p>
              {[{ label: "How it works", href: "#how-it-works" }, { label: "For businesses", href: "#for-businesses" }, { label: "Campaigns", href: "/business/register" }, { label: "Contributors", href: "/register" }].map(l => (
                <a key={l.label} href={l.href} style={{ display: "block", fontSize: 12, marginBottom: 9, color: "#aaa", textDecoration: "none" }}>{l.label}</a>
              ))}
            </div>
            <div>
              <p style={{ color: "#F5F5F5", fontWeight: 700, fontSize: 12, marginBottom: 14 }}>Support</p>
              {[{ label: "Help Center", href: "mailto:qeixova@gmail.com" }, { label: "Contact", href: "mailto:qeixova@gmail.com" }, { label: "Privacy Policy", href: "/privacy" }, { label: "Terms", href: "/terms" }, { label: "Refund Policy", href: "/refund-policy" }, { label: "Prohibited Campaigns", href: "/prohibited-campaign-policy" }].map(l => (
                <a key={l.label} href={l.href} style={{ display: "block", fontSize: 12, marginBottom: 9, color: "#aaa", textDecoration: "none" }}>{l.label}</a>
              ))}
            </div>
            <div>
              <p style={{ color: "#F5F5F5", fontWeight: 700, fontSize: 12, marginBottom: 14 }}>Social</p>
              <a href="https://x.com/QeixovaTech" target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 12, marginBottom: 9, color: "#aaa", textDecoration: "none" }}>@QeixovaTech</a>
              <a href="https://www.facebook.com/profile.php?id=61568026449468" target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 12, marginBottom: 9, color: "#aaa", textDecoration: "none" }}>Facebook</a>
              <a href="mailto:qeixova@gmail.com" style={{ display: "block", fontSize: 12, color: "#aaa", textDecoration: "none" }}>qeixova@gmail.com</a>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #111", paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <p style={{ fontSize: 11, color: "#999" }}>© 2026 Qeixova. All rights reserved.</p>
            <p style={{ fontSize: 11, color: "#999" }}>Qeixova Tasks — Community-Powered Digital Growth.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}


