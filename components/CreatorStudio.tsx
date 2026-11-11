"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/useAuth";
import ContributorLoading from "@/components/ContributorLoading";

type CreatorPost = { id: number; user_id: number; body: string; created_at: string; updated_at: string; edited: boolean; author_name: string; like_count: number; view_count: number; comment_count: number; repost_count: number; liked: boolean; reposted: boolean; bookmarked: boolean; followed: boolean };
type CreatorComment = { id: number; post_id: number; user_id: number; body: string; created_at: string; author_name: string };
type Summary = { post_count: number; view_count: number; like_count: number; following_count: number };
type FeedTab = "for-you" | "following" | "popular" | "saved";

async function readJson(response: Response) { return response.json().catch(() => ({})); }
function timeAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "Q"; }

function EngagementIcon({ name, active = false }: { name: "reply" | "repost" | "like" | "views" | "bookmark" | "share"; active?: boolean }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "reply") return <svg {...common}><path d="M20 11.5a7.5 7.5 0 0 1-8 7.2 9 9 0 0 1-3.4-.7L4 19l1.2-3.6A7 7 0 0 1 4 11.5a7.5 7.5 0 0 1 8-7.2 7.5 7.5 0 0 1 8 7.2Z" /></svg>;
  if (name === "repost") return <svg {...common}><path d="m17 3 4 4-4 4" /><path d="M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4" /><path d="M21 13v2a2 2 0 0 1-2 2H3" /></svg>;
  if (name === "like") return <svg {...common} fill={active ? "currentColor" : "none"} stroke={active ? "currentColor" : "currentColor"}><path d="M20.8 8.8c0 5-8.8 11-8.8 11s-8.8-6-8.8-11A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>;
  if (name === "views") return <svg {...common}><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
  if (name === "bookmark") return <svg {...common} fill={active ? "currentColor" : "none"}><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z" /></svg>;
  return <svg {...common}><path d="M14 5h5v5" /><path d="M19 5 10 14" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></svg>;
}

export default function CreatorStudio() {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [summary, setSummary] = useState<Summary>({ post_count: 0, view_count: 0, like_count: 0, following_count: 0 });
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FeedTab>("for-you");
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<number, CreatorComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [editingPost, setEditingPost] = useState<{ id: number; body: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mutedCreatorId, setMutedCreatorId] = useState<number | null>(null);
  const viewed = useRef(new Set<number>());
  const root = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setSearch(new URLSearchParams(window.location.search).get("search") || "");
  }, []);

  const load = useCallback(async () => {
    const response = await fetch(`/api/contributor/creator?tab=${tab}`, { cache: "no-store" }).catch(() => null);
    if (!response) { setError("Creator feed could not connect. Check your connection and try again."); setLoading(false); return; }
    const data = await readJson(response);
    if (!response.ok) { setError(data.error || "Creator feed could not load."); setLoading(false); return; }
    setPosts(Array.isArray(data.posts) ? data.posts : []);
    setSummary(data.summary ?? { post_count: 0, view_count: 0, like_count: 0, following_count: 0 });
    setHasMore(Boolean(data.hasMore));
    setError(""); setLoading(false);
  }, [tab]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const response = await fetch(`/api/contributor/creator?tab=${tab}&offset=${posts.length}`, { cache: "no-store" }).catch(() => null);
    const data = response ? await readJson(response) : {};
    if (!response?.ok) setError(data.error || "More posts could not load.");
    else {
      setPosts((current) => [...current, ...(Array.isArray(data.posts) ? data.posts : [])]);
      setHasMore(Boolean(data.hasMore));
    }
    setLoadingMore(false);
  };

  const loadComments = async (postId: number) => {
    const response = await fetch(`/api/contributor/creator?postId=${postId}`, { cache: "no-store" }).catch(() => null);
    const data = response ? await readJson(response) : {};
    if (!response?.ok) { setError(data.error || "Replies could not load."); return; }
    setCommentsByPost((current) => ({ ...current, [postId]: Array.isArray(data.comments) ? data.comments : [] }));
  };

  const toggleComments = (postId: number) => {
    const wasOpen = openComments.has(postId);
    setOpenComments((current) => { const next = new Set(current); if (next.has(postId)) next.delete(postId); else next.add(postId); return next; });
    if (!wasOpen && !commentsByPost[postId]) void loadComments(postId);
  };

  const submitComment = async (event: FormEvent, postId: number) => {
    event.preventDefault();
    const content = (commentDrafts[postId] || "").trim();
    if (!content) return;
    const response = await fetch("/api/contributor/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "comment", postId, body: content }) }).catch(() => null);
    const data = response ? await readJson(response) : {};
    if (!response?.ok) { setError(data.error || "Your reply could not be sent."); return; }
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
    if (data.comment) setCommentsByPost((current) => ({ ...current, [postId]: [...(current[postId] || []), data.comment] }));
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, comment_count: post.comment_count + 1 } : post));
  };

  useEffect(() => { if (user) void load(); }, [user, load]);
  useEffect(() => {
    if (!user || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return;
      const postId = Number((entry.target as HTMLElement).dataset.creatorPost);
      const post = posts.find((candidate) => candidate.id === postId);
      if (!post || post.user_id === user.id || viewed.current.has(postId)) return;
      viewed.current.add(postId);
      void fetch("/api/contributor/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view", postId }) }).catch(() => {});
      observer.unobserve(entry.target);
    }), { threshold: 0.5 });
    root.current?.querySelectorAll<HTMLElement>("[data-creator-post]").forEach((post) => observer.observe(post));
    return () => observer.disconnect();
  }, [posts, user, tab, search]);
  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId || !posts.some((post) => post.id === Number(postId))) return;
    setTab("for-you");
    window.setTimeout(() => document.getElementById(`creator-post-${postId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }, [posts]);

  const action = async (payload: Record<string, unknown>, key: string) => {
    setBusy(key); setError(""); setNotice("");
    const response = await fetch("/api/contributor/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    const data = response ? await readJson(response) : {};
    setBusy(null);
    if (!response?.ok) { setError(data.error || "That action could not be completed. Please try again."); return false; }
    if (payload.action === "publish") {
      await load();
    } else if (payload.action === "toggle_like") {
      setPosts((current) => current.map((post) => post.id === Number(payload.postId) ? { ...post, liked: Boolean(data.liked), like_count: Math.max(0, post.like_count + (data.liked ? 1 : -1)) } : post));
    } else if (payload.action === "toggle_repost") {
      setPosts((current) => current.map((post) => post.id === Number(payload.postId) ? { ...post, reposted: Boolean(data.active), repost_count: Math.max(0, post.repost_count + (data.active ? 1 : -1)) } : post));
    } else if (payload.action === "toggle_bookmark") {
      setPosts((current) => current.map((post) => post.id === Number(payload.postId) ? { ...post, bookmarked: Boolean(data.active) } : post));
    } else if (payload.action === "toggle_follow") {
      const creatorId = Number(payload.creatorId);
      setPosts((current) => current.map((post) => post.user_id === creatorId ? { ...post, followed: Boolean(data.followed) } : post));
      setSummary((current) => ({ ...current, following_count: Math.max(0, current.following_count + (data.followed ? 1 : -1)) }));
    } else if (payload.action === "toggle_mute") {
      const creatorId = Number(payload.creatorId);
      setMutedCreatorId(data.muted ? creatorId : null);
      setNotice(data.muted ? "You’ll see fewer posts from this contributor." : "Posts from this contributor will appear again.");
      setActiveMenu(null);
      await load();
    }
    return true;
  };

  const editPost = async () => {
    if (!editingPost) return;
    const body = editingPost.body.trim();
    if (body.length < 3 || body.length > 1200) { setError("Posts must contain 3 to 1,200 characters."); return; }
    setBusy(`edit:${editingPost.id}`);
    const response = await fetch("/api/contributor/creator", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: editingPost.id, body }) }).catch(() => null);
    const data = response ? await readJson(response) : {};
    setBusy(null);
    if (!response?.ok) { setError(data.error || "Your post could not be updated."); return; }
    setPosts((current) => current.map((post) => post.id === editingPost.id ? { ...post, body, edited: true, updated_at: new Date().toISOString() } : post));
    setEditingPost(null); setActiveMenu(null); setNotice("Your post was updated.");
  };

  const deletePost = async (postId: number) => {
    if (!window.confirm("Delete this post? Its replies and engagement records will also be removed.")) return;
    setBusy(`delete:${postId}`);
    const response = await fetch(`/api/contributor/creator?postId=${postId}`, { method: "DELETE" }).catch(() => null);
    const data = response ? await readJson(response) : {};
    setBusy(null);
    if (!response?.ok) { setError(data.error || "Your post could not be deleted."); return; }
    const removed = posts.find((post) => post.id === postId);
    setPosts((current) => current.filter((post) => post.id !== postId));
    if (removed?.user_id === user?.id) setSummary((current) => ({ ...current, post_count: Math.max(0, current.post_count - 1) }));
    setActiveMenu(null); setNotice("Your post was deleted.");
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    const content = body.trim();
    if (content.length < 3) { setError("Write at least 3 characters before posting."); return; }
    if (await action({ action: "publish", body: content }, "publish")) { setBody(""); setNotice("Your post is live in the creator feed."); }
  };

  const visiblePosts = useMemo(() => {
    let result = posts;
    if (tab === "following") result = result.filter((post) => post.followed);
    if (tab === "popular") result = [...result].sort((a, b) => (b.like_count * 2 + b.view_count) - (a.like_count * 2 + a.view_count));
    if (tab === "saved") result = result.filter((post) => post.bookmarked);
    const query = search.trim().toLowerCase();
    if (query) result = result.filter((post) => post.body.toLowerCase().includes(query) || post.author_name.toLowerCase().includes(query));
    return result;
  }, [posts, tab, search]);
  const suggestions = useMemo(() => {
    const unique = new Map<number, CreatorPost>();
    posts.forEach((post) => { if (post.user_id !== user?.id && !post.followed) unique.set(post.user_id, post); });
    return [...unique.values()].slice(0, 4);
  }, [posts, user]);

  const sharePost = async (postId: number) => {
    const url = `${window.location.origin}/creator?post=${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Qeixova Creator post", text: "Take a look at this creator post.", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice("Post link copied to clipboard.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try { await navigator.clipboard.writeText(url); setNotice("Post link copied to clipboard."); }
      catch { setNotice(url); }
    }
  };

  if (authLoading || loading) return <ContributorLoading label="Loading Home" detail="Preparing your community feed." />;

  return (
    <main ref={root} className="page-body creatorPage">
      <header className="creatorTopbar"><div className="creatorTitle"><span className="creatorBrandMark">Q</span><div><span className="creatorEyebrow">QEIXOVA COMMUNITY</span><h1>Home</h1></div></div><label className="creatorSearch"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creator posts" aria-label="Search creator posts" /></label><Link className="creatorTopCta" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text)", textDecoration: "none" }} href="/messages" aria-label="Open contributor messages"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 3v-14Z" /><path d="M8 9h8M8 12.5h5" /></svg><span>Messages</span></Link><div className="creatorMobileTop"><button type="button" className="creatorMobileAvatar" aria-label="Open navigation menu" onClick={() => window.dispatchEvent(new Event("open-mobile-navigation"))}>{initials(user?.fullName || "Qeixova")}</button><Link href="/creator" className="creatorMobileBrand" aria-label="Qeixova home"><Image src="/qeixova-icon.png" alt="Qeixova" width={40} height={40} priority /></Link><button type="button" className="creatorMobilePost" onClick={() => { document.getElementById("creator-post-body")?.focus(); document.getElementById("creator-post-body")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Post</button></div></header>

      {error ? <div className="creatorAlert" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss">×</button></div> : null}
      {notice ? <div className="creatorNotice" role="status"><span>{notice}</span>{mutedCreatorId ? <button type="button" className="undoMute" style={{ fontSize: 11, fontWeight: 800, textDecoration: "underline" }} onClick={() => void action({ action: "toggle_mute", creatorId: mutedCreatorId }, `mute:${mutedCreatorId}`)}>Undo</button> : null}<button type="button" onClick={() => { setNotice(""); setMutedCreatorId(null); }} aria-label="Dismiss">×</button></div> : null}

      <div className="creatorLayout">
        <section className="creatorFeed" aria-label="Creator feed">
          <nav className="creatorTabs" aria-label="Creator feed filters">
            <button type="button" className={tab === "for-you" ? "active" : ""} aria-pressed={tab === "for-you"} onClick={() => setTab("for-you")}>For you</button>
            <button type="button" className={tab === "following" ? "active" : ""} aria-pressed={tab === "following"} onClick={() => setTab("following")}>Following</button>
            <button type="button" className={tab === "popular" ? "active" : ""} aria-pressed={tab === "popular"} onClick={() => setTab("popular")}>Popular</button>
            <button type="button" className={tab === "saved" ? "active" : ""} aria-pressed={tab === "saved"} onClick={() => setTab("saved")}>Saved</button>
          </nav>

          <div className="creatorMobileDiscovery"><strong>Creators to follow</strong><div>{suggestions.map((post) => <button type="button" key={post.user_id} onClick={() => void action({ action: "toggle_follow", creatorId: post.user_id }, `follow:${post.user_id}`)} disabled={busy === `follow:${post.user_id}`}><span className="creatorMobileDiscoveryAvatar">{initials(post.author_name)}</span><span><b>{post.author_name}</b><small>Follow creator</small></span><i>＋</i></button>)}</div></div>

          <form className="creatorComposer" onSubmit={publish}>
              <Link href="/profile" className="creatorAvatar creatorAvatarLink current" aria-label="Open your profile">{initials(user?.fullName || "Qeixova")}</Link>
            <div className="creatorComposeMain"><label className="srOnly" htmlFor="creator-post-body">What would you like to share?</label><textarea id="creator-post-body" value={body} maxLength={1200} onChange={(event) => setBody(event.target.value)} placeholder="What valuable idea would you like to share?" /><div className="creatorComposeActions"><span>{body.length}/1,200</span><button type="submit" disabled={busy === "publish" || body.trim().length < 3}>{busy === "publish" ? "Posting…" : "Post"}</button></div></div>
          </form>

          <div className="creatorFeedLabel"><span>{tab === "for-you" ? "Growth Community" : tab === "following" ? "People you follow" : tab === "saved" ? "Your saved posts" : "Popular with contributors"}</span><span>{visiblePosts.length} posts</span></div>
          {visiblePosts.length ? <><div className="creatorPostList">{visiblePosts.map((post) => <article className={`creatorPost${activeMenu === post.id ? " menuOpen" : ""}`} data-creator-post={post.id} id={`creator-post-${post.id}`} key={post.id}>
            <Link className="creatorAvatar creatorPostAvatarLink" href={post.user_id === user?.id ? "/profile" : `/profile/${post.user_id}`} aria-label={`Open ${post.author_name}'s profile`}>{initials(post.author_name)}</Link><div className="creatorPostContent">
              <header className="creatorPostHeader"><Link className="creatorPostAuthor" href={post.user_id === user?.id ? "/profile" : `/profile/${post.user_id}`}>{post.author_name}{post.user_id === user?.id ? <em>You</em> : null}</Link><span className="creatorPostHandle">@{post.author_name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "creator"}</span><span className="creatorPostDot">·</span><time dateTime={post.created_at}>{timeAgo(post.created_at)}</time><button type="button" className="creatorPostMenu" onClick={() => setActiveMenu((current) => current === post.id ? null : post.id)} aria-label="Post options" aria-expanded={activeMenu === post.id}>•••</button></header>
              {activeMenu === post.id ? <div className="creatorPostMenuPanel" role="menu">{post.user_id === user?.id ? <><button type="button" role="menuitem" onClick={() => { setEditingPost({ id: post.id, body: post.body }); setActiveMenu(null); }}>Edit post</button><button type="button" role="menuitem" className="deleteOption" disabled={busy === `delete:${post.id}`} onClick={() => void deletePost(post.id)}>Delete post</button></> : <><button type="button" role="menuitem" onClick={() => { setActiveMenu(null); void sharePost(post.id); }}>Copy post link</button><button type="button" role="menuitem" onClick={() => void action({ action: "toggle_mute", creatorId: post.user_id }, `mute:${post.user_id}`)}>Mute @{post.author_name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "contributor"}</button></>}</div> : null}
              {post.reposted ? <div className="creatorRepostNote"><EngagementIcon name="repost" /> You reposted</div> : null}
              {editingPost?.id === post.id ? <div className="creatorEditPost"><textarea aria-label="Edit post" maxLength={1200} value={editingPost.body} onChange={(event) => setEditingPost((current) => current ? { ...current, body: event.target.value } : null)} /><div><span>{editingPost.body.length}/1,200</span><button type="button" className="cancelEdit" onClick={() => setEditingPost(null)}>Cancel</button><button type="button" disabled={busy === `edit:${post.id}`} onClick={() => void editPost()}>{busy === `edit:${post.id}` ? "Saving…" : "Save"}</button></div></div> : <p className="creatorPostBody">{post.body}{post.edited ? <small className="editedLabel"> · edited</small> : null}</p>}
              <footer className="creatorPostActions">
                <button type="button" className="replyAction" aria-label={`Reply to ${post.author_name}'s post`} aria-expanded={openComments.has(post.id)} onClick={() => toggleComments(post.id)}><EngagementIcon name="reply" /><b>{Number(post.comment_count).toLocaleString()}</b></button>
                <button type="button" className={post.reposted ? "reposted" : ""} aria-label={post.reposted ? "Undo repost" : "Repost"} aria-pressed={post.reposted} disabled={busy === `repost:${post.id}`} onClick={() => void action({ action: "toggle_repost", postId: post.id }, `repost:${post.id}`)}><EngagementIcon name="repost" /><b>{Number(post.repost_count).toLocaleString()}</b></button>
                <button type="button" disabled={busy === `like:${post.id}`} aria-label={post.liked ? "Unlike post" : "Like post"} aria-pressed={post.liked} className={post.liked ? "liked" : ""} onClick={() => void action({ action: "toggle_like", postId: post.id }, `like:${post.id}`)}><EngagementIcon name="like" active={post.liked} /><b>{Number(post.like_count).toLocaleString()}</b></button>
                <span className="creatorViews" title="Unique logged-in contributor views"><EngagementIcon name="views" /><b>{Number(post.view_count).toLocaleString()}</b></span>
                <button type="button" className={post.bookmarked ? "saved" : ""} aria-label={post.bookmarked ? "Remove bookmark" : "Bookmark post"} aria-pressed={post.bookmarked} disabled={busy === `bookmark:${post.id}`} onClick={() => void action({ action: "toggle_bookmark", postId: post.id }, `bookmark:${post.id}`)}><EngagementIcon name="bookmark" active={post.bookmarked} /></button>
                <button type="button" className="shareButton" aria-label="Share post" onClick={() => void sharePost(post.id)}><EngagementIcon name="share" /></button>
              </footer>
              {openComments.has(post.id) ? <section className="creatorComments" aria-label={`Replies to ${post.author_name}'s post`}>
                {(commentsByPost[post.id] || []).map((comment) => <article className="creatorComment" key={comment.id}><Link className="creatorCommentAvatar" href={comment.user_id === user?.id ? "/profile" : `/profile/${comment.user_id}`} aria-label={`Open ${comment.author_name}'s profile`}>{initials(comment.author_name)}</Link><div><strong>{comment.author_name}<time>{timeAgo(comment.created_at)}</time></strong><p>{comment.body}</p></div></article>)}
                <form className="creatorReplyForm" onSubmit={(event) => void submitComment(event, post.id)}><Link className="creatorCommentAvatar current" href="/profile" aria-label="Open your profile">{initials(user?.fullName || "Q")}</Link><input aria-label="Write a reply" placeholder="Post your reply" maxLength={500} value={commentDrafts[post.id] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} /><button type="submit" disabled={!(commentDrafts[post.id] || "").trim()}>Reply</button></form>
              </section> : null}
            </div></article>)}</div>{hasMore && tab !== "saved" ? <div className="creatorLoadMore"><button type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more posts"}</button></div> : null}</> : <div className="creatorEmpty"><span>✦</span><strong>{tab === "following" ? "Your following feed is ready for creators" : tab === "saved" ? "No saved posts yet" : search ? "No matching posts" : "Your creator feed starts here"}</strong><p>{tab === "following" ? "Follow a contributor from For you to see their posts here." : tab === "saved" ? "Bookmark posts you want to come back to." : search ? "Try another name or search term." : "Share the first useful post and invite the community into the conversation."}</p>{tab !== "for-you" ? <button type="button" onClick={() => setTab("for-you")}>Explore posts</button> : null}</div>}
        </section>

        <aside className="creatorRail" aria-label="Creator overview">
          <section className="creatorProfileCard"><div className="creatorProfileCover" /><div className="creatorProfileRow"><Link href="/profile" className="creatorAvatar creatorAvatarLink current" aria-label="Open your profile">{initials(user?.fullName || "Qeixova")}</Link><Link href="/profile" className="creatorProfileEdit" style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text)", textDecoration: "none" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19.7 7.8a2.6 2.6 0 0 0-3.6-3.6L4 16.5Z" /><path d="m14.8 5.5 3.7 3.7" /></svg>Edit profile</Link></div><strong>{user?.fullName || "Creator"}</strong><span className="creatorProfileHandle">@{(user?.fullName || "creator").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20)}</span><p>Share what you know. Help other contributors grow.</p><div className="creatorProfileStats"><span><b>{Number(summary.post_count).toLocaleString()}</b> Posts</span><span><b>{Number(summary.following_count).toLocaleString()}</b> Following</span></div></section>

          <section className="creatorRailCard"><div className="creatorRailHeading"><h2>Your performance</h2><span>↗</span></div><div className="creatorMetric"><span>Unique views</span><strong>{Number(summary.view_count).toLocaleString()}</strong></div><div className="creatorMetric"><span>Likes received</span><strong>{Number(summary.like_count).toLocaleString()}</strong></div><div className="creatorMetric"><span>Published posts</span><strong>{Number(summary.post_count).toLocaleString()}</strong></div><Link href="/wallet" className="creatorRewardLink" style={{ display: "flex", alignItems: "center", gap: 8, color: "#28764a", textDecoration: "none" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M16 14h2" /></svg><span>View your wallet</span><span className="creatorLinkArrow" aria-hidden="true">↗</span></Link></section>

          <section className="creatorRailCard rewardCard"><span className="creatorEyebrow">CREATOR PROGRAM</span><h2>Build your presence.</h2><p>Views and likes from verified contributors are recorded for each post.</p><div className="creatorSetupLine"><i /> Reward rules are being prepared</div><small>QLT rewards will appear here when eligibility and rates are configured.</small></section>

          <section className="creatorRailCard peopleCard"><div className="creatorRailHeading"><h2>Creators to follow</h2><button type="button" onClick={() => setTab("popular")}>Explore</button></div>{suggestions.length ? suggestions.map((post) => <div className="suggestion" key={post.user_id}><Link href={`/profile/${post.user_id}`} className="creatorAvatar creatorAvatarLink" aria-label={`Open ${post.author_name}'s profile`}>{initials(post.author_name)}</Link><div><strong>{post.author_name}</strong><small>{Number(post.like_count).toLocaleString()} likes · contributor</small></div><button type="button" disabled={busy === `follow:${post.user_id}`} onClick={() => void action({ action: "toggle_follow", creatorId: post.user_id }, `follow:${post.user_id}`)}>Follow</button></div>) : <p className="noSuggestions">New contributors will appear here as they publish.</p>}</section>

          <footer className="creatorRailFooter"><Link href="/terms">Guidelines</Link><Link href="/privacy">Privacy</Link><span>Qeixova Creator Space</span></footer>
        </aside>
      </div>

      <style jsx>{`
        .creatorPage{width:min(100%,1120px);margin:0 auto;padding:0 20px 100px;color:var(--text)}.creatorTopbar{position:sticky;top:0;z-index:8;display:flex;align-items:center;gap:20px;min-height:72px;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(14px)}.creatorTitle{display:flex;align-items:center;gap:10px;min-width:215px}.creatorBrandMark{display:grid;place-items:center;width:35px;height:35px;border-radius:11px;background:#31a565;color:#fff;font-size:17px;font-weight:900}.creatorTitle h1{margin-top:2px;font-size:16px;letter-spacing:-.02em}.creatorEyebrow{color:#328456;font-size:9px;font-weight:850;letter-spacing:.12em}.creatorSearch{display:flex;align-items:center;gap:9px;width:min(100%,440px);height:39px;padding:0 13px;border:1px solid var(--border);border-radius:999px;background:var(--card-bg);color:var(--muted)}.creatorSearch>span{font-size:22px;line-height:1}.creatorSearch input{width:100%;border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:12px}.creatorTopCta{display:flex;align-items:center;gap:8px;margin-left:auto;padding:9px 12px;border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:12px;font-weight:700;text-decoration:none}.creatorMobileTop,.creatorMobileDiscovery{display:none}.creatorAlert,.creatorNotice{display:flex;justify-content:space-between;gap:12px;margin:12px 0;padding:10px 13px;border:1px solid #efc0ba;border-radius:10px;background:#fff4f2;color:#973d33;font-size:12px}.creatorNotice{border-color:#c8e3d1;background:#eff8f1;color:#287448}.creatorAlert button,.creatorNotice button{border:0;background:none;color:inherit;font-size:18px;cursor:pointer}
        .creatorLayout{display:grid;grid-template-columns:minmax(0,690px) minmax(250px,300px);justify-content:center;gap:28px}.creatorFeed{min-width:0;border-left:1px solid var(--border);border-right:1px solid var(--border)}.creatorTabs{position:sticky;top:72px;z-index:5;display:grid;grid-template-columns:repeat(4,1fr);height:53px;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(12px)}.creatorTabs button{position:relative;border:0;background:none;color:var(--muted);font-size:12px;font-weight:650;cursor:pointer}.creatorTabs button.active{color:var(--text);font-weight:850}.creatorTabs button.active::after{position:absolute;bottom:0;left:50%;width:48px;height:3px;border-radius:4px 4px 0 0;background:#2994d6;content:"";transform:translateX(-50%)}
        .creatorComposer{display:flex;gap:12px;padding:17px 17px 13px;border-bottom:1px solid var(--border)}.creatorAvatar{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border-radius:50%;background:#e4f2e8;color:#267449;font-size:11px;font-weight:850}.creatorAvatarLink{color:#267449;text-decoration:none;transition:box-shadow .15s,transform .15s}.creatorAvatarLink:hover{box-shadow:0 0 0 3px #2e995533;transform:scale(1.04)}.creatorAvatar.current{background:#d9eee0;color:#206a3f}.creatorComposeMain{flex:1;min-width:0}.creatorComposeMain textarea{display:block;width:100%;min-height:62px;resize:vertical;padding:7px 0;border:0;outline:none;background:transparent;color:var(--text);font:inherit;font-size:15px;line-height:1.55}.creatorComposeMain textarea::placeholder{color:var(--muted)}.creatorComposeActions{display:flex;align-items:center;justify-content:flex-end;gap:12px}.creatorComposeActions>span{color:var(--muted);font-size:10px}.creatorComposeActions button{min-width:72px;padding:9px 16px;border:0;border-radius:999px;background:#2892d4;color:#fff;font-size:11px;font-weight:850;cursor:pointer}.creatorComposeActions button:disabled{opacity:.4;cursor:not-allowed}.creatorFeedLabel{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--border);color:var(--muted);font-size:10px}.creatorFeedLabel>span:first-child{color:var(--text);font-weight:750}
        .creatorPost{position:relative;display:flex;gap:11px;padding:16px 17px 12px;border-bottom:1px solid var(--border);scroll-margin-top:140px}.creatorPost>.creatorAvatar{flex-basis:39px;width:39px;height:39px}.creatorPostAvatarLink{color:#267449;text-decoration:none;transition:box-shadow .15s,transform .15s}.creatorPostAvatarLink:hover{box-shadow:0 0 0 3px #2e995533;transform:scale(1.04)}.creatorPostContent{min-width:0;flex:1}.creatorPostHeader{display:flex;align-items:center;gap:6px;min-width:0}.creatorPostHeader>strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.creatorPostHeader em{margin-left:5px;padding:2px 5px;border-radius:99px;background:#ebf5ee;color:#277646;font-size:8px;font-style:normal}.creatorPostHandle,.creatorPostDot,.creatorPostHeader time{overflow:hidden;color:var(--muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.creatorPostMenu{display:grid;flex:0 0 36px;place-items:center;width:36px;height:36px;margin-left:auto;border:1px solid transparent;border-radius:50%;background:transparent;color:var(--muted);font-size:13px;letter-spacing:2px;cursor:pointer;transition:background .15s,border-color .15s,color .15s}.creatorPostMenu:hover,.creatorPostMenu[aria-expanded="true"]{border-color:var(--border);background:var(--card-bg);color:var(--text)}.creatorPostBody{margin:8px 0 12px;font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}.creatorPostActions{display:flex;align-items:center;justify-content:space-between;gap:6px;max-width:440px}.creatorPostActions>button,.creatorPostActions>.creatorViews{display:flex;align-items:center;gap:5px;min-width:0;padding:5px 7px;border:0;border-radius:8px;background:transparent;color:var(--muted);font:inherit;font-size:10px;cursor:pointer}.creatorPostActions>button:hover{background:#edf5f0;color:#267b4a}.creatorPostActions b{font-size:10px;font-weight:700}.creatorPostActions small{font-size:9px}.creatorPostActions>button>span,.creatorPostActions>.creatorViews{font-size:15px}.creatorPostActions>button.liked{color:#d35465}.creatorPostActions>button:disabled{opacity:.58;cursor:default}.creatorPostActions .followButton{margin-left:auto;padding:6px 11px;border:1px solid #2c8e54;border-radius:999px;color:#28764a;font-size:10px;font-weight:800}.creatorPostActions .followButton.following{border-color:var(--border);color:var(--muted)}
        .creatorEmpty{display:grid;justify-items:center;gap:8px;padding:45px 20px;text-align:center}.creatorEmpty>span{color:#39a264;font-size:25px}.creatorEmpty strong{font-size:13px}.creatorEmpty p{max-width:330px;color:var(--muted);font-size:11px;line-height:1.5}.creatorEmpty button{margin-top:4px;padding:8px 12px;border:0;border-radius:99px;background:#2993d3;color:white;font-size:10px;font-weight:800;cursor:pointer}
        .creatorRail{display:grid;align-content:start;gap:15px;padding-top:16px}.creatorProfileCard,.creatorRailCard{overflow:hidden;border:1px solid var(--border);border-radius:15px;background:var(--bg)}.creatorProfileCover{height:67px;background:linear-gradient(110deg,#d8eee0,#d9e9f2 60%,#f3eadb)}.creatorProfileRow{display:flex;align-items:flex-end;justify-content:space-between;margin:-22px 14px 8px}.creatorProfileRow .creatorAvatar{width:52px;height:52px;flex-basis:52px;border:3px solid var(--bg);font-size:13px}.creatorProfileEdit{padding:6px 9px;border:1px solid var(--border);border-radius:99px;color:var(--text);font-size:9px;font-weight:750;text-decoration:none}.creatorProfileCard>strong,.creatorProfileHandle,.creatorProfileCard>p{display:block;margin-inline:15px}.creatorProfileCard>strong{font-size:12px}.creatorProfileHandle{margin-top:3px;color:var(--muted);font-size:10px}.creatorProfileCard>p{margin-top:10px;margin-bottom:12px;color:var(--muted);font-size:10px;line-height:1.45}.creatorProfileStats{display:flex;gap:14px;padding:10px 15px 13px;border-top:1px solid var(--border);color:var(--muted);font-size:9px}.creatorProfileStats b{color:var(--text);font-size:10px}
        .creatorRailCard{padding:14px}.creatorRailHeading{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.creatorRailHeading h2{font-size:12px}.creatorRailHeading>span{color:#38965d}.creatorRailHeading button{border:0;background:none;color:#328456;font-size:9px;font-weight:800;cursor:pointer}.creatorMetric{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border);color:var(--muted);font-size:10px}.creatorMetric strong{color:var(--text);font-size:13px}.creatorRewardLink{display:flex;justify-content:space-between;margin-top:8px;padding-top:10px;border-top:1px solid var(--border);color:#318254;font-size:10px;font-weight:750;text-decoration:none}.rewardCard{background:linear-gradient(145deg,color-mix(in srgb,#f0f7f1 75%,var(--bg)),var(--bg))}.rewardCard h2{margin-top:7px;font-size:15px}.rewardCard>p{margin:7px 0 10px;color:var(--muted);font-size:10px;line-height:1.55}.creatorSetupLine{display:flex;align-items:center;gap:6px;color:#4f765d;font-size:9px;font-weight:750}.creatorSetupLine i{width:7px;height:7px;border-radius:50%;background:#e0aa51}.rewardCard>small{display:block;margin-top:7px;color:var(--muted);font-size:9px;line-height:1.45}.peopleCard .creatorRailHeading{margin-bottom:7px}.suggestion{display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid var(--border)}.suggestion .creatorAvatar{width:32px;height:32px;flex-basis:32px;font-size:9px}.suggestion>div{display:grid;min-width:0;flex:1;gap:3px}.suggestion strong{overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.suggestion small{color:var(--muted);font-size:8px}.suggestion button{padding:5px 8px;border:1px solid #328456;border-radius:999px;background:transparent;color:#328456;font-size:9px;font-weight:800;cursor:pointer}.suggestion button:disabled{opacity:.5}.noSuggestions{color:var(--muted);font-size:10px;line-height:1.45}.creatorRailFooter{display:flex;flex-wrap:wrap;gap:10px;padding:0 4px;color:var(--muted);font-size:9px}.creatorRailFooter a{color:inherit;text-decoration:none}.srOnly{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        @media(max-width:950px){.creatorLayout{grid-template-columns:minmax(0,690px) 250px;gap:16px}.creatorTitle{min-width:170px}}
        @media(max-width:760px){.creatorPage{width:100%;padding:0 0 95px}.creatorTopbar{display:none!important}.creatorLayout{display:block}.creatorFeed{border:0}.creatorTabs{position:sticky;top:56px;display:flex;justify-content:flex-start;gap:0;height:58px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none}.creatorTabs::-webkit-scrollbar{display:none}.creatorTabs button{flex:0 0 auto;min-width:max-content;padding:0 15px;font-size:13px}.creatorTabs button.active::after{width:68px}.creatorMobileDiscovery{display:block;padding:9px 0 10px;border-bottom:1px solid var(--border);overflow:hidden}.creatorMobileDiscovery>strong{display:block;padding:0 14px 7px;color:var(--muted);font-size:9px;letter-spacing:.08em;text-transform:uppercase}.creatorMobileDiscovery>div{display:flex;gap:8px;overflow-x:auto;padding:0 14px;scrollbar-width:none}.creatorMobileDiscovery>div::-webkit-scrollbar{display:none}.creatorMobileDiscovery button{display:flex;align-items:center;gap:6px;flex:0 0 auto;max-width:210px;padding:4px 9px 4px 4px;border:1px solid #d9e2e8;border-radius:999px;background:var(--bg);color:var(--text);text-align:left;cursor:pointer}.creatorMobileDiscoveryAvatar{display:grid;place-items:center;width:31px;height:31px;border:2px solid #adf277;border-radius:50%;background:#e4f2e8;color:#267449;font-size:8px;font-weight:850}.creatorMobileDiscovery button>span:nth-child(2){display:grid;min-width:0;gap:2px}.creatorMobileDiscovery b{overflow:hidden;max-width:125px;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.creatorMobileDiscovery small{color:var(--muted);font-size:8px}.creatorMobileDiscovery i{color:#2994d6;font-size:15px;font-style:normal;font-weight:700}.creatorComposer{padding:13px 14px 12px}.creatorAvatar{width:38px;height:38px;flex-basis:38px;font-size:10px}.creatorComposeMain textarea{min-height:54px;font-size:14px}.creatorComposeActions button{min-width:66px;padding:8px 15px}.creatorFeedLabel{padding:12px 14px}.creatorPost{padding:14px 14px 12px;gap:10px}.creatorPost>.creatorAvatar{width:38px;height:38px;flex-basis:38px;font-size:10px}.creatorPostHeader{gap:4px}.creatorPostHeader>strong{font-size:12px}.creatorPostHandle,.creatorPostDot,.creatorPostHeader time{font-size:10px}.creatorPostBody{font-size:14px;line-height:1.5}.creatorPostActions{gap:1px}.creatorPostActions>button,.creatorPostActions>.creatorViews{gap:4px;padding-inline:5px;font-size:10px}.creatorPostActions small{font-size:8px}.creatorRail{display:none}.creatorFeedLabel{padding-inline:14px}}
        @media(max-width:410px){.creatorRail{grid-template-columns:1fr}.creatorProfileCard,.peopleCard{grid-column:auto}.creatorPostHandle{display:none}.creatorPostMenu{font-size:12px}.creatorPostActions small{display:none}.creatorPostActions .followButton{padding-inline:8px}}
        .creatorTopCta svg,.creatorProfileEdit svg,.creatorRewardLink svg{width:16px;height:16px;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.creatorProfileEdit svg{width:12px;height:12px}.creatorTopCta:link,.creatorTopCta:visited,.creatorProfileEdit:link,.creatorProfileEdit:visited,.creatorRewardLink:link,.creatorRewardLink:visited{color:var(--text);text-decoration:none}.creatorRewardLink:link,.creatorRewardLink:visited{justify-content:flex-start;color:#28764a}.creatorRewardLink .creatorLinkArrow{margin-left:auto;font-size:14px}.creatorTopCta:hover,.creatorProfileEdit:hover,.creatorRewardLink:hover{color:#20653f;text-decoration:none}
        .creatorPostActions{max-width:none;gap:3px}.creatorPostActions>button:not(.followButton){display:flex;flex:1;justify-content:center;align-items:center;min-height:28px;padding:4px 3px;color:var(--muted)}.creatorPostActions>button svg,.creatorPostActions>.creatorViews svg{display:block;width:17px;height:17px;flex:0 0 auto}.creatorPostActions>.creatorViews{display:flex;flex:1;justify-content:center;align-items:center;gap:4px;padding:4px 3px}.creatorPostActions .reposted{color:#28965e}.creatorPostActions .liked{color:#e64d78}.creatorPostActions .saved{color:#288fd0}.creatorPostActions>button:hover{background:color-mix(in srgb,#eaf3ed 70%,var(--bg))}.messageAuthorButton{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;padding:5px 9px;border:1px solid var(--border);border-radius:999px;color:var(--muted);font-size:9px;font-weight:750;text-decoration:none}.messageAuthorButton:hover{border-color:#98caaa;background:#eff7f1;color:#28774a}.creatorRepostNote{display:flex;align-items:center;gap:6px;margin:3px 0 5px 2px;color:#378957;font-size:9px;font-weight:700}.creatorRepostNote svg{width:13px;height:13px}.creatorComments{margin-top:5px;padding-top:10px;border-top:1px solid var(--border)}.creatorComment{display:flex;gap:8px;margin:8px 0}.creatorCommentAvatar{display:grid;place-items:center;flex:0 0 27px;width:27px;height:27px;border-radius:50%;background:#e4f2e8;color:#267449;font-size:8px;font-weight:800;text-decoration:none;transition:box-shadow .15s,transform .15s}.creatorCommentAvatar:hover{box-shadow:0 0 0 3px #2e995533;transform:scale(1.04)}.creatorCommentAvatar.current{background:#d9eee0;color:#206a3f}.creatorComment>div{min-width:0;flex:1}.creatorComment strong{display:flex;align-items:center;gap:7px;font-size:10px}.creatorComment time{color:var(--muted);font-size:9px;font-weight:500}.creatorComment p{margin-top:3px;font-size:11px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.creatorReplyForm{display:flex;align-items:center;gap:8px;margin-top:11px}.creatorReplyForm input{min-width:0;flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:999px;outline:none;background:var(--bg);color:var(--text);font:inherit;font-size:10px}.creatorReplyForm input:focus{border-color:#44a66a}.creatorReplyForm button{padding:7px 12px;border:0;border-radius:999px;background:#2992d4;color:white;font-size:10px;font-weight:800;cursor:pointer}.creatorReplyForm button:disabled{opacity:.45;cursor:not-allowed}
        .creatorPost.menuOpen{z-index:60}.creatorPostMenuPanel{position:absolute;z-index:40;top:54px;right:12px;display:grid;width:max-content;min-width:170px;max-width:min(250px,calc(100vw - 28px));max-height:min(320px,calc(100dvh - 110px));overflow-y:auto;padding:6px;border:1px solid var(--border);border-radius:10px;background:var(--bg);box-shadow:0 8px 24px #14251b20}.creatorPostMenuPanel button{padding:10px 12px;border:0;border-radius:6px;background:transparent;color:var(--text);text-align:left;font:inherit;font-size:12px;cursor:pointer}.creatorPostMenuPanel button:hover{background:color-mix(in srgb,#eaf3ed 70%,var(--bg))}.creatorPostMenuPanel .deleteOption{color:#c24141}.creatorEditPost{margin:7px 0}.creatorEditPost textarea{width:100%;min-height:72px;padding:9px;border:1px solid var(--border);border-radius:9px;background:var(--bg);color:var(--text);font:inherit;font-size:12px;resize:vertical}.creatorEditPost>div{display:flex;justify-content:flex-end;align-items:center;gap:7px;margin-top:6px}.creatorEditPost>div span{margin-right:auto;color:var(--muted);font-size:9px}.creatorEditPost button{padding:6px 11px;border:0;border-radius:999px;background:#2992d4;color:#fff;font-size:10px;font-weight:750;cursor:pointer}.creatorEditPost button.cancelEdit{border:1px solid var(--border);background:transparent;color:var(--text)}.creatorEditPost button:disabled{opacity:.55}.editedLabel{color:var(--muted);font-size:9px}.creatorLoadMore{display:flex;justify-content:center;padding:14px;border-top:1px solid var(--border)}.creatorLoadMore button{padding:9px 16px;border:1px solid var(--border);border-radius:999px;background:var(--bg);color:var(--text);font:inherit;font-size:11px;font-weight:750;cursor:pointer}.creatorLoadMore button:disabled{opacity:.55;cursor:wait}
      `}</style>
    </main>
  );
}
