"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import ContributorLoading from "@/components/ContributorLoading";

interface Profile {
  id: number; full_name: string; email: string; phone: string; bio?: string; website?: string | null; location?: string | null; occupation?: string | null;
  balance: number; streak: number; level: number;
  referral_code: string; tasks_completed: number;
  tasks_today: number; total_earned: number;
  total_withdrawn: number; referral_count: number;
  created_at: string; trust_level: string;
  approved_count: number; rejected_count: number;
  xp?: number; trust_score?: number; level_name?: string;
  badge_color?: string; milestones_claimed?: number;
  is_premium: boolean;
  total_earned_qlt: number; bonus_earned_qlt: number;
  creator_follower_count: number; creator_following_count: number;
  creator_posts: CreatorPost[]; creator_replies: CreatorReply[]; creator_reposts: CreatorRepost[];
}

type CreatorPost = { id: number; body: string; created_at: string; like_count: number; view_count: number; comment_count: number; repost_count: number; liked: boolean; reposted: boolean; bookmarked: boolean };
type CreatorReply = { id: number; body: string; created_at: string; post_id: number; post_body: string; post_author: string };
type CreatorRepost = { created_at: string; post_id: number; post_body: string; post_author: string };
type ProfileComment = { id: number; post_id: number; user_id: number; body: string; created_at: string; author_name: string };
type ProfileTab = "Posts" | "Replies" | "Reposts" | "Media";

type ModalType = "edit" | null;

function PremiumBadge() {
  return <svg className="profilePremiumBadge" viewBox="0 0 24 24" role="img" aria-label="Premium verified"><path d="M12 1.8 14.8 3l3-.1 1.2 2.7 2.5 1.7-.6 2.9.6 2.9-2.5 1.7-1.2 2.7-3-.1-2.8 1.2-2.8-1.2-3 .1L5 14.8l-2.5-1.7.6-2.9-.6-2.9L5 5.6 6.2 2.9l3 .1L12 1.8Z"/><path d="m8.1 11.9 2.4 2.4 5.5-5.5" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--qeixova-color-ee-ee-ee)", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 520, padding: "24px 20px 40px", maxHeight: "85vh", overflowY: "auto", border: "1px solid var(--qeixova-color-dd-dd-dd)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontWeight: 800, fontSize: 18, color: "var(--qeixova-color-0a-0a-0a)" }}>{title}</p>
          <button onClick={onClose} style={{ background: "var(--qeixova-color-dd-dd-dd)", border: "none", borderRadius: 10, width: 34, height: 34, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--qeixova-color-0a-0a-0a)" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, color: "var(--qeixova-color-44-44-44)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", marginTop: 6, padding: "13px 14px", borderRadius: 12, border: "1.5px solid var(--qeixova-color-cc-cc-cc)", fontSize: 15, outline: "none", color: "var(--qeixova-color-0a-0a-0a)", background: "var(--qeixova-color-e5-e5-e5)" }}
        onFocus={e => (e.target.style.borderColor = "#1AEF22")}
        onBlur={e => (e.target.style.borderColor = "var(--qeixova-color-66-66-66)")}
      />
    </div>
  );
}

function Alert({ msg }: { msg: { type: "success" | "error"; text: string } }) {
  return (
    <div style={{ background: msg.type === "success" ? "rgba(26,239,34,0.1)" : "rgba(229,62,62,0.1)", border: `1px solid ${msg.type === "success" ? "rgba(26,239,34,0.3)" : "rgba(229,62,62,0.3)"}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16 }}>{msg.type === "success" ? "✅" : "⚠️"}</span>
      <p style={{ color: msg.type === "success" ? "#1AEF22" : "#e53e3e", fontSize: 13, fontWeight: 600 }}>{msg.text}</p>
    </div>
  );
}

function ProfileActionIcon({ name, active = false }: { name: "reply" | "repost" | "like" | "views" | "bookmark" | "share"; active?: boolean }) {
  const props = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "reply") return <svg {...props}><path d="M20 11.5a7.5 7.5 0 0 1-8 7.2 9 9 0 0 1-3.4-.7L4 19l1.2-3.6A7 7 0 0 1 4 11.5a7.5 7.5 0 0 1 8-7.2 7.5 7.5 0 0 1 8 7.2Z" /></svg>;
  if (name === "repost") return <svg {...props}><path d="m17 3 4 4-4 4" /><path d="M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4" /><path d="M21 13v2a2 2 0 0 1-2 2H3" /></svg>;
  if (name === "like") return <svg {...props} fill={active ? "currentColor" : "none"}><path d="M20.8 8.8c0 5-8.8 11-8.8 11s-8.8-6-8.8-11A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>;
  if (name === "views") return <svg {...props}><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
  if (name === "bookmark") return <svg {...props} fill={active ? "currentColor" : "none"}><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z" /></svg>;
  return <svg {...props}><path d="M14 5h5v5" /><path d="M19 5 10 14" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></svg>;
}

function EditProfileModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (p: Partial<Profile>) => void; }) {
  const [name, setName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [website, setWebsite] = useState(profile.website || "");
  const [location, setLocation] = useState(profile.location || "");
  const [occupation, setOccupation] = useState(profile.occupation || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const save = async () => {
    setSaving(true); setMsg(null);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_profile", full_name: name, phone, bio, website, location, occupation }) });
    const data = await res.json();
    if (res.ok) { setMsg({ type: "success", text: "Profile updated!" }); onSaved({ full_name: name, phone, bio, website, location, occupation }); setTimeout(onClose, 1200); }
    else setMsg({ type: "error", text: data.error || "Failed to update" });
    setSaving(false);
  };

  return (
    <Modal title="Edit Profile" onClose={onClose}>
      {msg && <Alert msg={msg} />}
      <Field label="Full Name" value={name} onChange={setName} placeholder="Your full name" />
      <div style={{ marginBottom: 14 }}><label htmlFor="profile-bio" style={{ fontSize: 11, color: "var(--qeixova-color-44-44-44)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Bio · {bio.length}/280</label><textarea id="profile-bio" value={bio} maxLength={280} onChange={event => setBio(event.target.value)} placeholder="What would you like people to know about you?" style={{ width: "100%", minHeight: 82, marginTop: 6, padding: "13px 14px", borderRadius: 12, border: "1.5px solid var(--qeixova-color-cc-cc-cc)", font: "inherit", resize: "vertical" }} /></div>
      <Field label="What you do" value={occupation} onChange={setOccupation} placeholder="e.g. Designer, student, creator" />
      <Field label="Website" value={website} onChange={setWebsite} placeholder="https://yourwebsite.com" />
      <Field label="Location" value={location} onChange={setLocation} placeholder="City, country" />
      <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="+234 800 000 0000" />
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: "var(--qeixova-color-44-44-44)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Email Address</label>
        <input value={profile.email} disabled style={{ width: "100%", marginTop: 6, padding: "13px 14px", borderRadius: 12, border: "1.5px solid var(--qeixova-color-cc-cc-cc)", fontSize: 15, color: "var(--qeixova-color-44-44-44)", background: "var(--qeixova-color-e5-e5-e5)", cursor: "not-allowed" }} />
        <p style={{ fontSize: 11, color: "var(--qeixova-color-44-44-44)", marginTop: 4 }}>Email cannot be changed</p>
      </div>
      <button onClick={save} disabled={saving} style={{ width: "100%", background: saving ? "var(--qeixova-color-66-66-66)" : "linear-gradient(135deg, #1AEF22, #06B517)", color: "var(--qeixova-color-ff-ff-ff)", border: "none", borderRadius: 14, padding: "15px", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 6px 20px rgba(26,239,34,0.3)", marginTop: 4 }}>
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </Modal>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [copied, setCopied] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>("Posts");
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<number, ProfileComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [postBusy, setPostBusy] = useState<string | null>(null);
  const [timelineNotice, setTimelineNotice] = useState("");

  useEffect(() => {
    fetch("/api/profile").then(r => r.ok ? r.json() : null).then(d => { if (d?.profile) setProfile(d.profile); }).catch(() => {});
  }, []);

  const copyCode = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.referral_code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const patchProfile = (updates: Partial<Profile>) => setProfile(p => p ? { ...p, ...updates } : p);

  const loadPostComments = async (postId: number) => {
    const response = await fetch(`/api/contributor/creator?postId=${postId}`, { cache: "no-store" }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) { setTimelineNotice(data.error || "Replies could not be loaded. Try again."); return; }
    setCommentsByPost(current => ({ ...current, [postId]: Array.isArray(data.comments) ? data.comments : [] }));
  };

  const togglePostComments = (postId: number) => {
    const wasOpen = openComments.has(postId);
    setOpenComments(current => { const next = new Set(current); if (next.has(postId)) next.delete(postId); else next.add(postId); return next; });
    if (!wasOpen && !commentsByPost[postId]) void loadPostComments(postId);
  };

  const sendPostAction = async (action: "comment" | "toggle_repost" | "toggle_bookmark", postId: number, body?: string) => {
    setPostBusy(`${action}:${postId}`);
    setTimelineNotice("");
    const response = await fetch("/api/contributor/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, postId, ...(body ? { body } : {}) }) }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    setPostBusy(null);
    if (!response?.ok) { setTimelineNotice(data.error || "That action could not be completed. Please try again."); return false; }
    setProfile(current => {
      if (!current) return current;
      const targetPost = current.creator_posts.find(post => post.id === postId);
      const updated = { ...current, creator_posts: current.creator_posts.map(post => {
        if (post.id !== postId) return post;
        if (action === "toggle_repost") return { ...post, reposted: Boolean(data.active), repost_count: Math.max(0, post.repost_count + (data.active ? 1 : -1)) };
        if (action === "toggle_bookmark") return { ...post, bookmarked: Boolean(data.active) };
        return { ...post, comment_count: post.comment_count + 1 };
      }) };
      if (action === "toggle_repost" && targetPost) {
        updated.creator_reposts = data.active
          ? [{ created_at: new Date().toISOString(), post_id: postId, post_body: targetPost.body, post_author: current.full_name }, ...current.creator_reposts.filter(item => item.post_id !== postId)]
          : current.creator_reposts.filter(item => item.post_id !== postId);
      }
      if (action === "comment" && data.comment && targetPost) {
        updated.creator_replies = [{ id: Number(data.comment.id), body: data.comment.body, created_at: data.comment.created_at, post_id: postId, post_body: targetPost.body, post_author: current.full_name }, ...current.creator_replies];
      }
      return updated;
    });
    if (action === "comment") {
      setCommentDrafts(current => ({ ...current, [postId]: "" }));
      if (data.comment) setCommentsByPost(current => ({ ...current, [postId]: [...(current[postId] || []), data.comment] }));
    }
    return true;
  };

  const shareProfilePost = async (postId: number) => {
    const url = `${window.location.origin}/creator?post=${postId}`;
    try {
      if (navigator.share) await navigator.share({ title: "Qeixova post", url });
      else { await navigator.clipboard.writeText(url); setTimelineNotice("Post link copied."); }
    } catch { /* A dismissed share sheet does not need an error message. */ }
  };

  const submitProfileReply = async (event: FormEvent<HTMLFormElement>, postId: number) => {
    event.preventDefault();
    const body = (commentDrafts[postId] || "").trim();
    if (body.length < 2) return;
    await sendPostAction("comment", postId, body);
  };

  const stats = profile ? [
    { label: "Tasks Today",    value: String(profile.tasks_today),    icon: "/icon-task.svg" },
    { label: "Approved Tasks", value: String(profile.tasks_completed), icon: "/icon-task.svg" },
    { label: "Mission QLT",    value: `${Number(profile.total_earned_qlt ?? 0).toLocaleString()} QLT`, icon: "/icon-wallet.svg" },
    { label: "Bonus QLT",      value: `${Number(profile.bonus_earned_qlt ?? 0).toLocaleString()} QLT`, icon: "/icon-wallet.svg" },
    { label: "Total Earned",   value: profile.total_earned >= 1000 ? `${(profile.total_earned / 1000).toFixed(0)}k QLT` : `${profile.total_earned} QLT`, icon: "/icon-wallet.svg" },
    { label: "Withdrawn",      value: profile.total_withdrawn >= 1000 ? `${(profile.total_withdrawn / 1000).toFixed(0)}k QLT` : `${profile.total_withdrawn} QLT`, icon: "/icon-wallet.svg" },
    { label: "Balance",        value: `${profile.balance.toLocaleString()} QLT`, icon: "/icon-wallet.svg" },
    { label: "Referrals",      value: String(profile.referral_count), icon: "/icon-profile.svg" },
  ] : [];



  if (!profile) return <ContributorLoading label="Loading profile" detail="Preparing your account, progress, and preferences." />;
  const profileInitials = profile.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  return (
    <div className="page-body" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <section className="profileSocial">
        <header className="profileSocialHeading"><Link href="/creator" aria-label="Back to Home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg></Link><div><strong>{profile.full_name}</strong><span>{profile.creator_posts.length.toLocaleString()} posts</span></div></header>
        <div className="profileAvatarRow"><div className="profileAvatar">{profile.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</div><button type="button" className="profileEditButton" onClick={() => setModal("edit")}>Edit profile</button></div>
        <div className="profileIdentity"><h2>{profile.full_name}{profile.is_premium ? <PremiumBadge /> : null}</h2><span className="profileHandle">@{profile.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "contributor"}</span>
          {profile.bio ? <p className="profileBio">{profile.bio}</p> : <button type="button" className="profileAddBio" onClick={() => setModal("edit")}>Add a bio to tell the community about yourself.</button>}
          <div className="profileMeta">{profile.occupation ? <span>💼 {profile.occupation}</span> : null}{profile.location ? <span>⌖ {profile.location}</span> : null}{profile.website ? <a href={/^https?:\/\//i.test(profile.website) ? profile.website : `https://${profile.website}`} target="_blank" rel="noreferrer">↗ {profile.website}</a> : null}<span>▦ Joined {new Date(profile.created_at).toLocaleDateString([], { month: "long", year: "numeric" })}</span></div>
          <div className="profileSocialCounts"><span><b>{Number(profile.creator_following_count).toLocaleString()}</b> Following</span><span><b>{Number(profile.creator_follower_count).toLocaleString()}</b> Followers</span></div>
          <div className="profileBadges"><span style={{ borderColor: `${profile.badge_color ?? "#45875b"}55`, color: profile.badge_color ?? "#45875b" }}>L{profile.level} {profile.level_name || "Starter"}</span>{profile.streak > 0 ? <span>🔥 {profile.streak}-day streak</span> : null}{profile.trust_score !== undefined ? <span>Trust {profile.trust_score}%</span> : null}</div>
        </div>
<details className="profileAccountDetails" id="account-earnings"><summary><span><strong>Account &amp; earnings</strong><small>QLT balance, mission progress, and referrals</small></span><b aria-hidden="true"><span>View details</span></b></summary>      <section className="profileAccountSection">
        <header className="accountSectionHeading"><div><h2>Account overview</h2><p>Your QLT balance, mission progress, and referrals</p></div><Link href="/wallet">Wallet details <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M7 6h7v7" /></svg></Link></header>
        <div className="accountMetricGrid">{stats.map((item) => <article key={item.label} className={`accountMetric${item.label === "Balance" ? " balanceMetric" : ""}`}><div className="accountMetricLabel"><Image src={item.icon} alt="" width={17} height={17} /><span>{item.label}</span></div><strong>{item.value}</strong></article>)}</div>

        <section className="accountReviewCard"><div className="accountSubheading"><div><h3>Task review</h3><p>Your submitted mission results</p></div><span className="reviewRate">{profile.approved_count + profile.rejected_count > 0 ? Math.round(profile.approved_count / (profile.approved_count + profile.rejected_count) * 100) : 0}%<small>success</small></span></div><div className="reviewMetrics"><div><strong>{profile.approved_count}</strong><span>Approved</span></div><div><strong>{profile.rejected_count}</strong><span>Rejected</span></div><div><strong>{profile.approved_count + profile.rejected_count}</strong><span>Reviewed</span></div></div>{profile.trust_level === "new" && profile.approved_count < 5 ? <p className="accountHint">Complete {5 - profile.approved_count} more approved task{5 - profile.approved_count !== 1 ? "s" : ""} to become a Trusted User.</p> : null}{profile.trust_level === "flagged" ? <p className="accountWarning">Your account has been flagged due to a high rejection rate. Review mission requirements carefully.</p> : null}</section>

        <section className="accountReferralCard"><div className="referralCopy"><span className="accountEyebrow">INVITE YOUR COMMUNITY</span><h3>Refer &amp; earn 2,500 QLT + 10%</h3><p>Code <strong>{profile.referral_code}</strong> · {profile.referral_count} {profile.referral_count === 1 ? "person" : "people"} joined</p><small>Earn 10% of your referrals’ earnings.</small></div><div className="referralActions"><button type="button" onClick={copyCode}>{copied ? "Copied" : "Copy code"}</button><button type="button" onClick={() => { const url = `${window.location.origin}/register?ref=${profile.referral_code}`; if (navigator.share) void navigator.share({ title: "Join Qeixova", text: "Earn QLT by completing missions!", url }).catch(() => {}); else void navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}>Share invite</button></div></section>


      </section></details>
        <nav className="profileTabs" role="tablist" aria-label="Profile timeline">
          {(["Posts", "Replies", "Reposts", "Media"] as ProfileTab[]).map(tab => <button key={tab} id={`profile-tab-${tab.toLowerCase()}`} type="button" role="tab" aria-controls="profile-tabpanel" aria-selected={profileTab === tab} className={profileTab === tab ? "active" : ""} onClick={() => { setProfileTab(tab); setTimelineNotice(""); }}>{tab}<span>{tab === "Posts" ? profile.creator_posts.length : tab === "Replies" ? profile.creator_replies.length : tab === "Reposts" ? profile.creator_reposts.length : 0}</span></button>)}
        </nav>
        <div className="profileTimeline" id="profile-tabpanel" role="tabpanel" aria-labelledby={`profile-tab-${profileTab.toLowerCase()}`}>
          {timelineNotice ? <div className="profileTimelineNotice" role="status">{timelineNotice}<button type="button" onClick={() => setTimelineNotice("")} aria-label="Dismiss message">×</button></div> : null}
          {profileTab === "Posts" && profile.creator_posts.map(post => <article className="profilePost" key={post.id}>
            <Link className="profileTimelineAvatar" href="/profile" aria-label="Open your profile">{profileInitials}</Link>
            <div className="profilePostContent">
              <header><Link href="/profile" className="profilePostAuthor">{profile.full_name}</Link>{profile.is_premium ? <PremiumBadge /> : null}<span>@{profile.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "contributor"}</span><span>·</span><time dateTime={post.created_at}>{timeAgo(post.created_at)}</time></header>
              <p>{post.body}</p>
              <div className="profilePostActions" aria-label="Post actions">
                <button type="button" aria-label={`Reply to post, ${post.comment_count} replies`} aria-expanded={openComments.has(post.id)} onClick={() => togglePostComments(post.id)}><ProfileActionIcon name="reply" /><span>{post.comment_count.toLocaleString()}</span></button>
                <button type="button" aria-label={post.reposted ? "Undo repost" : "Repost"} aria-pressed={post.reposted} disabled={postBusy === `toggle_repost:${post.id}`} className={post.reposted ? "isReposted" : ""} onClick={() => void sendPostAction("toggle_repost", post.id)}><ProfileActionIcon name="repost" /><span>{post.repost_count.toLocaleString()}</span></button>
                <span className="profilePostLikes" title="Likes on your post"><ProfileActionIcon name="like" active={post.liked} /><span>{post.like_count.toLocaleString()}</span></span>
                <span className="profilePostViews" title="Post views"><ProfileActionIcon name="views" /><span>{post.view_count.toLocaleString()}</span></span>
                <button type="button" aria-label={post.bookmarked ? "Remove bookmark" : "Bookmark post"} aria-pressed={post.bookmarked} disabled={postBusy === `toggle_bookmark:${post.id}`} className={post.bookmarked ? "isBookmarked" : ""} onClick={() => void sendPostAction("toggle_bookmark", post.id)}><ProfileActionIcon name="bookmark" active={post.bookmarked} /></button>
                <button type="button" aria-label="Share post" onClick={() => void shareProfilePost(post.id)}><ProfileActionIcon name="share" /></button>
              </div>
              {openComments.has(post.id) ? <section className="profilePostComments" aria-label="Replies to this post">
                {(commentsByPost[post.id] || []).map(comment => <article className="profilePostComment" key={comment.id}><Link className="profileCommentAvatar" href={comment.user_id === profile.id ? "/profile" : `/profile/${comment.user_id}`} aria-label={`Open ${comment.author_name}'s profile`}>{comment.author_name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</Link><div><strong>{comment.author_name}<time>{timeAgo(comment.created_at)}</time></strong><p>{comment.body}</p></div></article>)}
                <form className="profilePostReplyForm" onSubmit={event => void submitProfileReply(event, post.id)}><span className="profileCommentAvatar current">{profileInitials}</span><input aria-label="Write a reply" maxLength={500} placeholder="Write a reply…" value={commentDrafts[post.id] || ""} onChange={event => setCommentDrafts(current => ({ ...current, [post.id]: event.target.value }))} /><button type="submit" disabled={!commentDrafts[post.id]?.trim() || postBusy === `comment:${post.id}`}>{postBusy === `comment:${post.id}` ? "Sending…" : "Reply"}</button></form>
              </section> : null}
            </div>
          </article>)}
          {profileTab === "Replies" && profile.creator_replies.map(reply => <article className="profilePost profilePostActivity" key={reply.id}><Link className="profileTimelineAvatar" href="/profile" aria-label="Open your profile">{profileInitials}</Link><div className="profilePostContent"><header><Link href="/profile" className="profilePostAuthor">{profile.full_name}</Link><span>replied to {reply.post_author}</span><time>{timeAgo(reply.created_at)}</time></header><p>{reply.body}</p><Link className="profileQuotedPost" href={`/creator?post=${reply.post_id}`}><strong>{reply.post_author}</strong><span>{reply.post_body}</span><small>Open conversation →</small></Link></div></article>)}
          {profileTab === "Reposts" && profile.creator_reposts.map((repost, index) => <article className="profilePost profilePostActivity" key={`${repost.post_id}-${index}`}><Link className="profileTimelineAvatar" href="/profile" aria-label="Open your profile">{profileInitials}</Link><div className="profilePostContent"><header><Link href="/profile" className="profilePostAuthor">{profile.full_name}</Link><span>reposted</span><time>{timeAgo(repost.created_at)}</time></header><Link className="profileQuotedPost" href={`/creator?post=${repost.post_id}`}><strong>{repost.post_author}</strong><span>{repost.post_body}</span><small>Open original post →</small></Link></div></article>)}
          {profileTab === "Media" ? <div className="profileEmpty"><strong>No media posts yet</strong><span>Photos and videos you share will appear here.</span><Link href="/creator">Create a post</Link></div> : null}
          {profileTab === "Posts" && profile.creator_posts.length === 0 ? <div className="profileEmpty"><strong>Your profile starts here</strong><span>Share your first useful post from Home and it will appear here.</span></div> : null}
          {profileTab === "Replies" && profile.creator_replies.length === 0 ? <div className="profileEmpty"><strong>No replies yet</strong><span>Your conversations on posts will show up here.</span></div> : null}
          {profileTab === "Reposts" && profile.creator_reposts.length === 0 ? <div className="profileEmpty"><strong>No reposts yet</strong><span>Posts you repost will be collected here.</span></div> : null}
        </div>
      </section>



      <style jsx>{`
        .profileAccountDetails{margin:12px 14px 14px;overflow:hidden;border:1px solid #cfe3d5;border-radius:14px;background:linear-gradient(110deg,#f2faf4,#fff 70%);box-shadow:0 3px 12px rgba(32,105,62,.07);transition:border-color .16s,box-shadow .16s,background .16s}.profileAccountDetails:hover{border-color:#78b78c;box-shadow:0 5px 16px rgba(32,105,62,.12)}.profileAccountDetails>summary{display:flex;align-items:center;gap:12px;min-height:66px;padding:12px 14px;cursor:pointer;list-style:none;transition:background .16s}.profileAccountDetails>summary:hover{background:#eaf6ed}.profileAccountDetails>summary:focus-visible{outline:3px solid #2f9b5a;outline-offset:-3px}.profileAccountDetails>summary::-webkit-details-marker{display:none}.profileAccountDetails>summary>span{display:grid;gap:3px}.profileAccountDetails>summary strong{font-size:14px;color:#1f5734}.profileAccountDetails>summary small{font-size:11px;color:#607b69}.profileAccountDetails>summary>b{display:flex;align-items:center;margin-left:auto;padding:8px 12px;border:1px solid #b9d9c2;border-radius:999px;background:#fff;color:#277747;font-size:10px;font-weight:800;white-space:nowrap}.profileAccountDetails[open]{border-color:#78b78c;background:#fff;box-shadow:0 6px 18px rgba(32,105,62,.1)}.profileAccountDetails[open]>summary{border-bottom:1px solid #d7e9dc;background:#f4faf5}.profileSocial,.profileAccountSection{width:min(100%,750px);margin:0 auto;color:#17202b}.profileSocial{border-left:1px solid #e4e7eb;border-right:1px solid #e4e7eb;background:#fff}.profileSocialHeading{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:22px;height:58px;padding:0 18px;border-bottom:1px solid #e7e9ec;background:rgba(255,255,255,.94);backdrop-filter:blur(10px)}.profileSocialHeading>a{color:#17202b;font-size:25px;text-decoration:none}.profileSocialHeading>div{display:grid;gap:2px}.profileSocialHeading strong{font-size:17px}.profileSocialHeading span{color:#647383;font-size:11px}.profileSocialHeading>button{margin-left:auto;border:0;background:none;color:#17202b;font-size:19px;cursor:pointer}.profileAvatarRow{display:flex;justify-content:space-between;align-items:center;min-height:82px;padding:12px 20px 0}.profileAvatar{display:grid;place-items:center;width:72px;height:72px;margin-top:0;border:5px solid white;border-radius:50%;background:linear-gradient(135deg,#d9eee0,#badcc7);color:#237348;font-size:23px;font-weight:850;box-shadow:0 1px 4px #0002}.profileEditButton{margin-top:0;padding:9px 16px;border:1px solid #cfd6dd;border-radius:999px;background:#fff;color:#17202b;font-size:12px;font-weight:800;cursor:pointer}.profileIdentity{padding:0 21px 16px}.profileIdentity h2{font-size:22px;letter-spacing:-.035em}.profileHandle{display:block;margin-top:2px;color:#657587;font-size:13px}.profileBio{margin-top:13px;color:#293642;font-size:13px;line-height:1.5;white-space:pre-wrap}.profileAddBio{margin-top:10px;padding:0;border:0;background:none;color:#2588c9;font-size:12px;text-align:left;cursor:pointer}.profileMeta{display:flex;flex-wrap:wrap;gap:7px 14px;margin-top:12px;color:#617180;font-size:11px}.profileMeta a{color:#2588c9;text-decoration:none}.profileSocialCounts{display:flex;gap:16px;margin-top:13px;color:#637283;font-size:12px}.profileSocialCounts b{color:#17202b}.profileBadges{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}.profileBadges span{padding:5px 9px;border:1px solid #dce6df;border-radius:999px;background:#f7fbf8;color:#34754e;font-size:10px;font-weight:750}.profileTabs{position:sticky;top:58px;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);height:56px;border-top:1px solid #e7e9ec;border-bottom:1px solid #dce4df;background:rgba(255,255,255,.97);backdrop-filter:blur(10px)}.profileTabs button{position:relative;min-width:0;border:0;border-radius:8px 8px 0 0;background:transparent;color:#526477;font-size:13px;font-weight:750;cursor:pointer;transition:background .15s,color .15s}.profileTabs button:hover{background:#f0f8f2;color:#246b40}.profileTabs button:focus-visible{outline:3px solid #2f9b5a;outline-offset:-4px}.profileTabs button.active{color:#1f713f;font-weight:850}.profileTabs button.active:after{position:absolute;bottom:0;left:50%;width:min(64px,72%);height:4px;border-radius:4px 4px 0 0;background:#2f9b5a;content:"";transform:translateX(-50%)}.profilePost{display:flex;gap:12px;padding:15px 18px;border-bottom:1px solid #e8ebee}.profilePostAvatar{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border-radius:50%;background:#dcefe2;color:#27774a;font-size:12px;font-weight:850;text-decoration:none;transition:box-shadow .15s,transform .15s}.profilePostAvatar:hover{box-shadow:0 0 0 3px #2e995533;transform:scale(1.04)}.profilePostContent{min-width:0;flex:1}.profilePostContent header{display:flex;flex-wrap:wrap;align-items:center;gap:5px;color:#667587;font-size:11px}.profilePostContent header strong{color:#18212a;font-size:12px}.profilePostContent p{margin-top:6px;color:#202a34;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.profilePostContent footer{display:flex;justify-content:space-between;gap:7px;margin-top:13px;color:#627181;font-size:10px}.profilePostContent blockquote{margin:9px 0 0;padding:10px 12px;border:1px solid #e2e7eb;border-radius:10px;color:#263440;font-size:11px;line-height:1.45}.profilePostContent blockquote p{margin:4px 0 0;font-size:11px}.profileEmpty{display:grid;justify-items:center;gap:8px;padding:50px 20px;text-align:center}.profileEmpty strong{font-size:15px}.profileEmpty span{max-width:300px;color:#6c7c8b;font-size:12px;line-height:1.5}.profileAccountSection{width:100%;padding:17px 14px 16px;color:#1a2630}.accountSectionHeading,.accountSubheading{display:flex;align-items:center;justify-content:space-between;gap:12px}.accountSectionHeading{margin:0 2px 14px}.accountSectionHeading h2{font-size:17px;letter-spacing:-.02em}.accountSectionHeading p,.accountSubheading p{margin-top:3px;color:#71808d;font-size:10px}.accountSectionHeading>a{padding:7px 10px;border:1px solid #d9e2e7;border-radius:999px;color:#28784d;font-size:10px;font-weight:750;text-decoration:none;white-space:nowrap}.accountMetricGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.accountMetric{min-width:0;padding:11px 12px;border:1px solid #e3e9ec;border-radius:12px;background:#fff}.accountMetric.balanceMetric{border-color:#cde6d5;background:linear-gradient(135deg,#f2faf4,#fff)}.accountMetricLabel{display:flex;align-items:center;gap:6px;color:#6c7c88;font-size:9px}.accountMetricLabel img{opacity:.72}.accountMetric>strong{display:block;margin-top:9px;color:#1d2a34;font-size:15px;letter-spacing:-.02em}.balanceMetric>strong{color:#21834d;font-size:19px}.accountReviewCard{margin-top:13px;padding:14px;border:1px solid #e3e9ec;border-radius:14px;background:#fff}.accountSubheading h3,.accountReferralCard h3{font-size:13px;letter-spacing:-.01em}.reviewRate{display:grid;justify-items:end;color:#298552;font-size:16px;font-weight:850}.reviewRate small{color:#71808d;font-size:9px;font-weight:550}.reviewMetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.reviewMetrics>div{display:grid;justify-items:center;gap:3px;padding:10px;border-radius:10px;background:#f5f8f6}.reviewMetrics>div:nth-child(2){background:#fff5f4}.reviewMetrics strong{color:#24804b;font-size:19px}.reviewMetrics>div:nth-child(2) strong{color:#c54c4c}.reviewMetrics span{color:#71808d;font-size:9px}.accountHint,.accountWarning{margin:10px 0 0;padding:9px 10px;border-radius:9px;background:#f2f8f3;color:#477558;font-size:10px;line-height:1.4}.accountWarning{background:#fff4f2;color:#a6453d}.accountReferralCard{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-top:13px;padding:15px;border:1px solid #f0dfbd;border-radius:14px;background:linear-gradient(115deg,#fffaf0,#fff)}.accountEyebrow{color:#a56b1d;font-size:8px;font-weight:850;letter-spacing:.13em}.accountReferralCard h3{margin-top:5px;color:#382a18}.referralCopy p{margin-top:7px;color:#6f5940;font-size:10px}.referralCopy p strong{color:#382a18;letter-spacing:.05em}.referralCopy small{display:block;margin-top:3px;color:#8c7559;font-size:9px}.referralActions{display:flex;flex-shrink:0;gap:6px}.referralActions button{padding:8px 11px;border:1px solid #e6d4b1;border-radius:9px;background:#fff;color:#855914;font-size:10px;font-weight:750;cursor:pointer}.referralActions button+button{border-color:#b27a26;background:#b27a26;color:white}.profileAccountDetails[open] .profileAccountSection{padding-bottom:16px}
        @media(max-width:700px){.profileSocial{width:100%;border:0}.profileSocialHeading{height:54px;padding-inline:10px}.profileAvatar{width:64px;height:64px;font-size:20px}.profileAvatarRow{min-height:72px;padding:10px 9px 0}.profileIdentity{padding:0 9px 16px}.profileTabs{top:54px}.profilePost{padding:13px 8px;gap:8px}.profilePostAvatar{width:34px;height:34px;flex-basis:34px}.profilePostContent footer{font-size:9px;flex-wrap:wrap;justify-content:flex-start;gap:8px 14px}.profileAccountDetails{margin:10px 8px 12px}.profileAccountDetails>summary{padding-inline:11px}.profileAccountSection{padding:14px 8px}.accountMetricGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.accountReferralCard{align-items:flex-start;flex-direction:column}.referralActions{width:100%}.referralActions button{flex:1}}
      `}</style>

      <BottomNav />
      {modal === "edit" && profile && <EditProfileModal profile={profile} onClose={() => setModal(null)} onSaved={patchProfile} />}
    </div>
  );
}
