"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BusinessSidebar from "@/components/BusinessSidebar";
import BusinessBottomNav from "@/components/BusinessBottomNav";

type BusinessPost = { id: number; body: string; media_url: string | null; media_type: "image" | "video" | null; created_at: string; like_count: number; comment_count: number };

export default function BusinessCreatorFeed() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [posts, setPosts] = useState<BusinessPost[]>([]);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [premium, setPremium] = useState(false);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [businessResponse, feedResponse] = await Promise.all([
      fetch("/api/business/me", { cache: "no-store" }).catch(() => null),
      fetch("/api/business/creator", { cache: "no-store" }).catch(() => null),
    ]);
    if (!businessResponse?.ok || !feedResponse?.ok) { router.replace("/business/login"); return; }
    const businessData = await businessResponse.json().catch(() => ({}));
    const data = await feedResponse.json().catch(() => ({}));
    setBusinessName(businessData.business?.name || "Business");
    setPosts(Array.isArray(data.posts) ? data.posts : []);
    setPremium(Boolean(data.premium?.active));
    setEndsAt(data.premium?.endsAt ?? null);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const chooseMedia = (file: File | undefined) => {
    if (!file) return;
    const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
    const max = type === "image" ? 2 * 1024 * 1024 : 3 * 1024 * 1024;
    if (!type || file.size > max) { setNotice(type ? "Images must be under 2 MB and videos under 3 MB." : "Choose an image or video file."); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setMedia({ url: reader.result, type }); };
    reader.onerror = () => setNotice("That file could not be read.");
    reader.readAsDataURL(file);
  };

  const publish = async () => {
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/business/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, mediaUrl: media?.url, mediaType: media?.type }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The post could not be published.");
      setBody(""); setMedia(null); setNotice("Your post is live in the shared Creator feed."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "The post could not be published."); }
    finally { setBusy(false); }
  };

  const subscribe = async () => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/business/premium", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not start Business Premium checkout.");
      window.location.assign(data.authorizationUrl);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not start checkout."); setBusy(false); }
  };

  return <main className="businessCreatorPage"><BusinessSidebar name={businessName || "Business"}/><div className="businessCreatorMain">
    <header><div><span>QEIXOVA COMMUNITY</span><h1>Creator feed</h1><p>Share your business updates with contributors in the same feed as creators.</p></div></header>
    <section className="businessCreatorPremium"><div><strong>{premium ? "Business Premium is active" : "Business Premium"}</strong><p>{premium ? endsAt ? `Access through ${new Date(endsAt).toLocaleDateString([], { dateStyle: "medium" })}.` : "Longer posts and photo or video posts are unlocked." : "Post short updates for free. Premium unlocks longer posts plus photo and video posts."}</p></div>{!premium ? <button disabled={busy} onClick={() => void subscribe()}>Subscribe · ₦5,700 / month</button> : null}</section>
    {notice ? <p className="businessCreatorNotice" role="status">{notice}</p> : null}
    <section className="businessCreatorComposer"><label htmlFor="business-creator-post">Post as {businessName || "your business"}</label><textarea id="business-creator-post" maxLength={premium ? 1200 : 280} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share an update with the community…"/><div className="businessCreatorActions"><span>{body.length}/{premium ? 1200 : 280}{!premium ? " · short posts" : ""}</span><label className={!premium ? "locked" : ""}>Photo or video<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" disabled={!premium} onChange={(event) => chooseMedia(event.target.files?.[0])}/></label><button disabled={busy || (body.trim().length < 3 && !media)} onClick={() => void publish()}>{busy ? "Working…" : "Post"}</button></div>{media ? <div className="businessCreatorPreview">{media.type === "video" ? <video src={media.url} controls playsInline/> : <img src={media.url} alt="Post preview"/>}<button type="button" onClick={() => setMedia(null)} aria-label="Remove media">×</button></div> : null}</section>
    <section className="businessCreatorPosts"><h2>Your posts</h2>{loading ? <p>Loading your Creator posts…</p> : posts.length ? posts.map((post) => <article key={post.id}><header><span className="businessPostAvatar">{(businessName[0] || "B").toUpperCase()}</span><div><strong>{businessName}</strong><small>{new Date(post.created_at).toLocaleDateString([], { dateStyle: "medium" })}</small></div><span className="businessCreatorBadge">BUSINESS</span></header>{post.body.trim() ? <p>{post.body}</p> : null}{post.media_url ? post.media_type === "video" ? <video src={post.media_url} controls playsInline/> : <img src={post.media_url} alt="Business post attachment"/> : null}<footer><span>♡ {post.like_count} likes</span><span>▢ {post.comment_count} comments</span></footer></article>) : <p>Your business posts will show up here and in the contributor Creator feed.</p>}</section>
  </div><BusinessBottomNav/><style jsx>{`
    .businessCreatorPage{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh;background:var(--bg);color:var(--text)}.businessCreatorMain{width:min(100%,900px);margin:0 auto;padding:28px 24px 100px}.businessCreatorMain>header{margin-bottom:20px}.businessCreatorMain>header span{color:#358251;font-size:10px;font-weight:850;letter-spacing:.13em}.businessCreatorMain h1{margin-top:5px;font-size:28px}.businessCreatorMain>header p{margin-top:7px;color:var(--muted);font-size:13px}.businessCreatorPremium,.businessCreatorComposer,.businessCreatorPosts article{margin-bottom:14px;padding:17px;border:1px solid var(--border);border-radius:15px;background:var(--card-bg)}.businessCreatorPremium{display:flex;align-items:center;justify-content:space-between;gap:16px;border-color:#bedfc6;background:linear-gradient(125deg,#eff9f1,var(--card-bg))}.businessCreatorPremium p{margin-top:5px;color:var(--muted);font-size:12px;line-height:1.5}.businessCreatorPremium button,.businessCreatorActions>button{min-height:42px;padding:0 16px;border:0;border-radius:999px;background:#2d8c50;color:white;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.businessCreatorPremium button:disabled,.businessCreatorActions>button:disabled{opacity:.55}.businessCreatorComposer>label{display:block;margin-bottom:9px;font-size:13px;font-weight:800}.businessCreatorComposer textarea{width:100%;min-height:100px;padding:12px;border:1px solid var(--border);border-radius:12px;outline:none;background:var(--bg);color:var(--text);font:inherit;font-size:14px;resize:vertical}.businessCreatorComposer textarea:focus{border-color:#62a97c}.businessCreatorActions{display:flex;align-items:center;gap:10px;margin-top:10px}.businessCreatorActions>span{margin-right:auto;color:var(--muted);font-size:11px}.businessCreatorActions label{position:relative;padding:10px 13px;border:1px solid var(--border);border-radius:999px;color:#267847;font-size:11px;font-weight:750;cursor:pointer}.businessCreatorActions label.locked{opacity:.48;cursor:not-allowed}.businessCreatorActions input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:inherit}.businessCreatorPosts h2{margin:22px 0 12px;font-size:17px}.businessCreatorPosts>p{padding:20px;border:1px dashed var(--border);border-radius:12px;color:var(--muted);font-size:12px}.businessCreatorPosts article>header{display:flex;align-items:center;gap:10px}.businessPostAvatar{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#e4f2e8;color:#267449;font-weight:850}.businessCreatorPosts article header div{display:grid;gap:3px}.businessCreatorPosts article header small{color:var(--muted);font-size:10px}.businessCreatorBadge{margin-left:auto;padding:5px 8px;border-radius:999px;background:#edf6ee;color:#387d4e;font-size:9px;font-weight:800}.businessCreatorPosts article>p{margin:14px 0;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.businessCreatorPosts article>img,.businessCreatorPosts article>video,.businessCreatorPreview img,.businessCreatorPreview video{display:block;width:100%;max-height:420px;object-fit:cover;border-radius:12px}.businessCreatorPosts article>footer{display:flex;gap:17px;margin-top:12px;color:var(--muted);font-size:11px}.businessCreatorPreview{position:relative;margin-top:12px}.businessCreatorPreview>button{position:absolute;right:8px;top:8px;width:32px;height:32px;border:0;border-radius:50%;background:#0009;color:white;font-size:21px}.businessCreatorNotice{margin-bottom:12px;padding:11px 13px;border-radius:10px;background:#fff5df;color:#805b19;font-size:12px}
    @media(max-width:760px){.businessCreatorPage{display:block}.businessCreatorMain{padding:18px 13px 100px}.businessCreatorPremium{align-items:flex-start;flex-direction:column}.businessCreatorPremium button{width:100%}.businessCreatorActions{flex-wrap:wrap}.businessCreatorActions>span{width:100%}.businessCreatorActions>button{min-width:78px}}
  `}</style></main>;
}
