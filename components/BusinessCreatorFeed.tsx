"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BusinessSidebar from "@/components/BusinessSidebar";
import BusinessBottomNav from "@/components/BusinessBottomNav";
import PremiumBadge from "@/components/PremiumBadge";

type BusinessPost = { id: number; user_id: number | null; business_id: number | null; is_business: boolean; is_own: boolean; followed: boolean; author_name: string; author_avatar_url: string | null; body: string; media_url: string | null; media_type: "image" | "video" | null; is_premium?: boolean; created_at: string; updated_at: string; edited: boolean; like_count: number; comment_count: number; repost_count: number; liked: boolean; reposted: boolean; bookmarked: boolean };
type BusinessComment = { id: number; post_id: number; user_id: number | null; business_id: number | null; is_business: boolean; author_name: string; author_avatar_url: string | null; is_premium: boolean; body: string; created_at: string; reaction_count: number; reacted: boolean };

function FeedActionIcon({ name }: { name: "like" | "repost" | "comment" | "save" | "share" }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "like") return <svg {...common}><path d="M20.8 8.8c0 5-8.8 11-8.8 11s-8.8-6-8.8-11A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>;
  if (name === "repost") return <svg {...common}><path d="m17 3 4 4-4 4" /><path d="M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4" /><path d="M21 13v2a2 2 0 0 1-2 2H3" /></svg>;
  if (name === "comment") return <svg {...common}><path d="M20 11.5a7.5 7.5 0 0 1-8 7.2 9 9 0 0 1-3.4-.7L4 19l1.2-3.6A7 7 0 0 1 4 11.5a7.5 7.5 0 0 1 8-7.2 7.5 7.5 0 0 1 8 7.2Z" /></svg>;
  if (name === "save") return <svg {...common}><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z" /></svg>;
  return <svg {...common}><path d="M14 5h5v5" /><path d="M19 5 10 14" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></svg>;
}

export default function BusinessCreatorFeed() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [posts, setPosts] = useState<BusinessPost[]>([]);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [premium, setPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"for-you" | "following" | "popular" | "saved" | "businesses" | "contributors">("for-you");
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<number, BusinessComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<number>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [editingPost, setEditingPost] = useState<{ id: number; body: string } | null>(null);
  const [mutedCreatorId, setMutedCreatorId] = useState<number | null>(null);
  const loadRevision = useRef(0);

  useEffect(() => {
    if (activeMenu === null) return;
    const closeMenu = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveMenu(null); };
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest(".bcPostMenuWrap")) setActiveMenu(null);
    };
    document.addEventListener("keydown", closeMenu);
    document.addEventListener("pointerdown", closeOutside);
    return () => { document.removeEventListener("keydown", closeMenu); document.removeEventListener("pointerdown", closeOutside); };
  }, [activeMenu]);

  const load = useCallback(async () => {
    const revision = ++loadRevision.current;
    setLoading(true);
    const [businessResponse, feedResponse] = await Promise.all([
      fetch("/api/business/me", { cache: "no-store" }).catch(() => null),
      fetch(`/api/business/creator?tab=${tab}`, { cache: "no-store" }).catch(() => null),
    ]);
    if (revision !== loadRevision.current) return;
    if (businessResponse?.status === 401) { router.replace("/business/login"); return; }
    if (!businessResponse?.ok || !feedResponse?.ok) {
      const failedData = feedResponse ? await feedResponse.json().catch(() => ({})) : {};
      setNotice(failedData.error || "The Creator feed could not load. Check your connection and try again."); setLoading(false); return;
    }
    const businessData = await businessResponse.json().catch(() => ({}));
    const data = await feedResponse.json().catch(() => ({}));
    setBusinessName(businessData.business?.name || "Business");
    setPosts(Array.isArray(data.posts) ? data.posts : []);
    setHasMore(Boolean(data.hasMore));
    setPremium(Boolean(data.premium?.active));
    setLoading(false);
  }, [router, tab]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const tabAtRequest = tab;
    const revisionAtRequest = loadRevision.current;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/business/creator?tab=${tabAtRequest}&offset=${posts.length}`, { cache: "no-store" }).catch(() => null);
      const data = response ? await response.json().catch(() => ({})) : {};
      if (revisionAtRequest !== loadRevision.current || tabAtRequest !== tab) return;
      if (!response?.ok) { setNotice(data.error || "More posts could not load."); return; }
      setPosts((current) => [...current, ...(Array.isArray(data.posts) ? data.posts : [])]); setHasMore(Boolean(data.hasMore));
    } finally { setLoadingMore(false); }
  };

  const chooseMedia = (file: File | undefined) => {
    if (!file) return;
    const type = ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? "image" : ["video/mp4", "video/webm", "video/quicktime"].includes(file.type) ? "video" : null;
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

  const visiblePosts = posts.filter((post) => {
    const matchesSearch = !search.trim() || `${post.author_name} ${post.body}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch;
  });

  const loadComments = async (postId: number) => {
    setLoadingComments((current) => new Set(current).add(postId));
    try {
      const response = await fetch(`/api/business/creator?postId=${postId}`, { cache: "no-store" }).catch(() => null);
      const data = response ? await response.json().catch(() => ({})) : {};
      if (!response?.ok) { setNotice(data.error || "Comments could not load."); return; }
      setCommentsByPost((current) => ({ ...current, [postId]: Array.isArray(data.comments) ? data.comments : [] }));
    } finally { setLoadingComments((current) => { const next = new Set(current); next.delete(postId); return next; }); }
  };
  const toggleComments = (postId: number) => {
    const opening = !openComments.has(postId);
    setOpenComments((current) => { const next = new Set(current); if (next.has(postId)) next.delete(postId); else next.add(postId); return next; });
    if (opening && !commentsByPost[postId]) void loadComments(postId);
  };
  const postAction = async (action: string, postId: number) => {
    if (actionBusy) return; setActionBusy(`${action}:${postId}`); setNotice("");
    try {
      const response = await fetch("/api/business/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, postId }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "That action could not be completed.");
      setPosts((current) => current.map((post) => post.id !== postId ? post : {
        ...post,
        liked: action === "toggle_like" ? Boolean(data.active) : post.liked,
        like_count: action === "toggle_like" ? Number(data.likeCount) : post.like_count,
        reposted: action === "toggle_repost" ? Boolean(data.active) : post.reposted,
        repost_count: action === "toggle_repost" ? Number(data.repostCount) : post.repost_count,
        bookmarked: action === "toggle_bookmark" ? Boolean(data.active) : post.bookmarked,
      }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "That action could not be completed."); }
    finally { setActionBusy(null); }
  };
  const creatorAction = async (action: "toggle_follow" | "toggle_mute", creatorId: number) => {
    setActionBusy(`${action}:${creatorId}`);
    try {
      const response = await fetch("/api/business/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, creatorId }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "That action could not be completed.");
      setActiveMenu(null); setMutedCreatorId(action === "toggle_mute" && data.muted ? creatorId : null); setNotice(action === "toggle_mute" ? (data.muted ? "You’ll see fewer posts from this contributor." : "Posts from this contributor will appear again.") : (data.followed ? "You’re following this contributor." : "You unfollowed this contributor."));
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "That action could not be completed."); }
    finally { setActionBusy(null); }
  };
  const editPost = async () => {
    if (!editingPost) return;
    const content = editingPost.body.trim();
    if (content.length < 3 || content.length > 1200) { setNotice("Posts must contain 3 to 1,200 characters."); return; }
    setActionBusy(`edit:${editingPost.id}`);
    try {
      const response = await fetch("/api/business/creator", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: editingPost.id, body: content }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Your post could not be updated.");
      setEditingPost(null); setActiveMenu(null); setNotice("Your post was updated."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Your post could not be updated."); }
    finally { setActionBusy(null); }
  };
  const deletePost = async (postId: number) => {
    if (!window.confirm("Delete this post? Its replies and engagement records will also be removed.")) return;
    setActionBusy(`delete:${postId}`);
    try {
      const response = await fetch(`/api/business/creator?postId=${postId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Your post could not be deleted.");
      setActiveMenu(null); setNotice("Your post was deleted."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Your post could not be deleted."); }
    finally { setActionBusy(null); }
  };
  const submitComment = async (event: React.FormEvent, postId: number) => {
    event.preventDefault(); const content = (commentDrafts[postId] || "").trim(); if (!content || actionBusy) return;
    setActionBusy(`comment:${postId}`);
    try {
      const response = await fetch("/api/business/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "comment", postId, body: content }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Your reply could not be sent.");
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      if (data.comment) setCommentsByPost((current) => ({ ...current, [postId]: [...(current[postId] || []), data.comment] }));
      setPosts((current) => current.map((post) => post.id === postId ? { ...post, comment_count: post.comment_count + 1 } : post));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Your reply could not be sent."); }
    finally { setActionBusy(null); }
  };
  const reactToComment = async (commentId: number, postId: number) => {
    if (actionBusy) return;
    setActionBusy(`reaction:${commentId}`);
    try {
      const response = await fetch("/api/business/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle_comment_reaction", commentId }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Your reaction could not be saved.");
      setCommentsByPost((current) => ({ ...current, [postId]: (current[postId] || []).map((comment) => comment.id === commentId ? { ...comment, reacted: Boolean(data.active), reaction_count: Number(data.reactionCount) || 0 } : comment) }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Your reaction could not be saved."); }
    finally { setActionBusy(null); }
  };
  const sharePost = async (postId: number) => {
    const post = posts.find((item) => item.id === postId);
    const url = `${window.location.origin}/post/${postId}`;
    try {
      if (navigator.share) { await navigator.share({ title: `${post?.author_name || "Qeixova"} post`, text: post?.body.slice(0, 180) || "Take a look at this post.", url }); return; }
      await navigator.clipboard.writeText(url); setNotice("Post link copied to clipboard.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try { await navigator.clipboard.writeText(url); setNotice("Post link copied to clipboard."); }
      catch { setNotice(url); }
    }
  };
  const copyPostLink = async (postId: number) => {
    const url = `${window.location.origin}/post/${postId}`;
    try { await navigator.clipboard.writeText(url); setNotice("Post link copied to clipboard."); }
    catch { setNotice(url); }
    setActiveMenu(null);
  };

  return <main className="businessCreatorPage"><BusinessSidebar name={businessName || "Business"}/><div className="businessCreatorMain">
    <header className="bcTopbar"><div className="bcBrand"><span className="bcMark">Q</span><div><small>QEIXOVA COMMUNITY</small><h1>Home</h1></div></div><label className="bcSearch"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creator posts" aria-label="Search creator posts"/></label><span className="bcTopLink">Creator feed</span></header>
    <div className="bcLayout"><section className="bcFeed" aria-label="Shared Creator feed">
      <nav className="bcTabs" aria-label="Feed filters">{([ ["for-you", "For you"], ["following", "Following"], ["popular", "Popular"], ["saved", "Saved"], ["businesses", "Businesses"], ["contributors", "Contributors"] ] as const).map(([value, label]) => <button key={value} type="button" className={tab === value ? "active" : ""} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</nav>
      {notice ? <p className="businessCreatorNotice" role="status"><span>{notice}</span>{mutedCreatorId ? <button type="button" onClick={() => void creatorAction("toggle_mute", mutedCreatorId)}>Undo</button> : null}<button type="button" aria-label="Dismiss message" onClick={() => { setNotice(""); setMutedCreatorId(null); }}>×</button></p> : null}
      <section className="bcComposer"><span className="bcAvatar bcCurrent">{businessName.slice(0, 2).toUpperCase()}</span><div className="bcComposeMain"><label htmlFor="business-creator-post">Post as {businessName || "your business"}</label><textarea id="business-creator-post" maxLength={premium ? 1200 : 280} value={body} onChange={(event) => setBody(event.target.value)} placeholder="What valuable idea would you like to share?"/><div className="bcComposeActions"><span>{body.length}/{premium ? "1,200" : "280"}</span>{premium ? <label className="bcMediaPick">Photo/video<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={(event) => { chooseMedia(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label> : <span className="bcPremiumHint">Premium unlocks photo and video posts</span>}<button type="button" disabled={busy || (body.trim().length < 3 && !media)} onClick={() => void publish()}>{busy ? "Posting…" : "Post"}</button></div>{media ? <div className="businessCreatorPreview">{media.type === "video" ? <video src={media.url} controls playsInline/> : <img src={media.url} alt="Post preview"/>}<button type="button" onClick={() => setMedia(null)} aria-label="Remove media">×</button></div> : null}</div></section>
      <div className="bcFeedLabel"><strong>{tab === "for-you" ? "Growth Community" : tab === "following" ? "People you follow" : tab === "saved" ? "Your saved posts" : tab === "businesses" ? "Business updates" : tab === "contributors" ? "Contributor posts" : "Popular posts"}</strong><span>{visiblePosts.length} posts</span></div>
      {loading ? <p className="bcEmpty">Loading the shared Creator feed…</p> : visiblePosts.length ? <><div className="bcPostList">{visiblePosts.map((post) => <article className={`bcPost${activeMenu === post.id ? " menuOpen" : ""}`} key={post.id}><div className="bcPostAvatar">{post.author_avatar_url ? <img src={post.author_avatar_url} alt=""/> : post.author_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div><div className="bcPostContent"><header className="bcPostHeader"><strong>{post.author_name}{post.is_premium ? <PremiumBadge /> : null}</strong>{post.is_business ? <em>BUSINESS</em> : null}<span>{post.is_business ? "Business" : "Contributor"}</span><i>·</i><time>{new Date(post.created_at).toLocaleDateString([], { dateStyle: "medium" })}</time><div className="bcPostMenuWrap"><button type="button" className="bcPostMenu" aria-label="Post options" aria-haspopup="menu" aria-expanded={activeMenu === post.id} onClick={() => setActiveMenu((current) => current === post.id ? null : post.id)}><svg viewBox="0 0 8 16" aria-hidden="true"><circle cx="4" cy="3.5" r="1.3"/><circle cx="4" cy="8" r="1.3"/><circle cx="4" cy="12.5" r="1.3"/></svg></button>{activeMenu === post.id ? <div className="bcPostMenuPanel" role="menu">{post.is_own ? <><button type="button" role="menuitem" onClick={() => { setEditingPost({ id: post.id, body: post.body }); setActiveMenu(null); }}>Edit post</button><button type="button" role="menuitem" className="deleteOption" disabled={actionBusy === `delete:${post.id}`} onClick={() => void deletePost(post.id)}>Delete post</button></> : <><button type="button" role="menuitem" onClick={() => void copyPostLink(post.id)}>Copy post link</button>{!post.is_business && post.user_id ? <><button type="button" role="menuitem" onClick={() => void creatorAction("toggle_follow", post.user_id!)}>{post.followed ? "Unfollow" : "Follow"} contributor</button><button type="button" role="menuitem" onClick={() => void creatorAction("toggle_mute", post.user_id!)}>Mute contributor</button></> : null}</>}</div> : null}</div></header>{editingPost?.id === post.id ? <div className="bcEditPost"><textarea aria-label="Edit post" maxLength={1200} value={editingPost.body} onChange={(event) => setEditingPost((current) => current ? { ...current, body: event.target.value } : null)}/><div><span>{editingPost.body.length}/1,200</span><button type="button" className="cancelEdit" onClick={() => setEditingPost(null)}>Cancel</button><button type="button" disabled={actionBusy === `edit:${post.id}`} onClick={() => void editPost()}>{actionBusy === `edit:${post.id}` ? "Saving…" : "Save"}</button></div></div> : post.body.trim() ? <p className="bcPostBody">{post.body}{post.edited ? <small className="bcEditedLabel"> · edited</small> : null}</p> : null}{post.media_url ? post.media_type === "video" ? <video className="bcPostMedia" src={post.media_url} controls playsInline preload="metadata"/> : <img className="bcPostMedia" src={post.media_url} alt="Post attachment"/> : null}{post.reposted ? <div className="bcRepostNote"><FeedActionIcon name="repost"/> You reposted</div> : null}<footer className="bcPostActions"><button type="button" className={post.liked ? "liked" : ""} aria-pressed={post.liked} disabled={Boolean(actionBusy) || post.is_own} onClick={() => void postAction("toggle_like", post.id)} aria-label={post.is_own ? "You cannot like your own post" : post.liked ? "Unlike post" : "Like post"}><FeedActionIcon name="like"/><b>{post.like_count}</b></button><button type="button" className={post.reposted ? "reposted" : ""} aria-pressed={post.reposted} disabled={Boolean(actionBusy)} onClick={() => void postAction("toggle_repost", post.id)} aria-label={post.reposted ? "Undo repost" : "Repost"}><FeedActionIcon name="repost"/><b>{post.repost_count}</b></button><button type="button" aria-expanded={openComments.has(post.id)} disabled={Boolean(actionBusy)} onClick={() => toggleComments(post.id)} aria-label="Comments"><FeedActionIcon name="comment"/><b>{post.comment_count}</b></button><button type="button" className={post.bookmarked ? "saved" : ""} aria-pressed={post.bookmarked} disabled={Boolean(actionBusy)} onClick={() => void postAction("toggle_bookmark", post.id)} aria-label={post.bookmarked ? "Remove saved post" : "Save post"}><FeedActionIcon name="save"/><b>{post.bookmarked ? "Saved" : "Save"}</b></button><button type="button" onClick={() => void sharePost(post.id)} aria-label="Share post"><FeedActionIcon name="share"/><b>Share</b></button></footer>{openComments.has(post.id) ? <section className="bcComments" aria-label={`Comments on ${post.author_name}'s post`}>{loadingComments.has(post.id) ? <p className="bcCommentState">Loading comments…</p> : commentsByPost[post.id]?.length ? null : commentsByPost[post.id] ? <p className="bcCommentState">No comments yet. Start the conversation.</p> : null}{(commentsByPost[post.id] || []).map((comment) => <article className="bcComment" key={comment.id}><span className="bcCommentAvatar">{comment.author_avatar_url ? <img src={comment.author_avatar_url} alt=""/> : comment.author_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><strong>{comment.author_name}{comment.is_business ? <em>BUSINESS</em> : null}{comment.is_premium ? <PremiumBadge/> : null}</strong><p>{comment.body}</p><button type="button" className={comment.reacted ? "reacted" : ""} aria-label={comment.reacted ? "Remove reaction from comment" : "React to comment"} aria-pressed={comment.reacted} disabled={actionBusy === `reaction:${comment.id}`} onClick={() => void reactToComment(comment.id, post.id)}><FeedActionIcon name="like"/><span>{comment.reaction_count || "Like"}</span></button></div></article>)}<form className="bcReply" onSubmit={(event) => void submitComment(event, post.id)}><span className="bcAvatar bcCurrent">{businessName.slice(0, 2).toUpperCase()}</span><input aria-label="Write a comment" maxLength={500} value={commentDrafts[post.id] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Write a reply…"/><button type="submit" disabled={actionBusy === `comment:${post.id}` || !(commentDrafts[post.id] || "").trim()}>Reply</button></form></section> : null}</div></article>)}</div>{hasMore && tab !== "saved" ? <div className="bcLoadMore"><button type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more posts"}</button></div> : null}</> : <p className="bcEmpty">{posts.length ? (search.trim() ? "No posts match your search." : tab === "following" ? "Posts from contributors you follow will appear here." : tab === "saved" ? "Posts you save will appear here." : "No posts match these filters.") : "No posts have been shared yet. Publish the first update and it will appear in both feeds."}</p>}
    </section><aside className="bcRail"><section className="bcRailCard"><div className="bcCover"/><div className="bcProfileAvatar">{businessName.slice(0, 2).toUpperCase()}</div><strong>{businessName || "Your business"}</strong><p>Share your updates with contributors in the Creator community.</p><div className="bcRailStat"><b>{posts.filter((post) => post.is_business).length}</b> business posts</div></section><section className="bcRailCard bcProgram"><small>BUSINESS CREATOR</small><h2>Grow your presence.</h2><p>Business updates appear in the same feed as contributor posts.</p><Link href="/business/premium">{premium ? "View Premium" : "Activate Premium"}</Link></section></aside></div>
  </div><BusinessBottomNav/><style jsx>{`
    .businessCreatorPage{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh;background:var(--bg);color:var(--text)}.businessCreatorMain{width:min(100%,1440px);margin:0 auto;padding:0 28px 100px}.bcTopbar{position:sticky;z-index:5;top:0;display:flex;align-items:center;gap:28px;min-height:74px;border-bottom:1px solid var(--border);background:var(--bg)}.bcBrand{display:flex;align-items:center;gap:12px;min-width:265px}.bcMark{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:#2da76a;color:#fff;font-size:22px;font-weight:900}.bcBrand small,.bcProgram small{color:#328456;font-size:9px;font-weight:850;letter-spacing:.13em}.bcBrand h1{margin-top:2px;font-size:19px}.bcSearch{display:flex;align-items:center;gap:10px;width:min(100%,550px);height:48px;padding:0 16px;border:1px solid var(--border);border-radius:999px;background:var(--card-bg);color:var(--muted)}.bcSearch>span{font-size:23px}.bcSearch input{width:100%;border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:13px}.bcTopLink{font-size:14px}.bcLayout{display:grid;grid-template-columns:minmax(0,780px) minmax(270px,375px);justify-content:center;gap:35px}.bcFeed{min-width:0;border-inline:1px solid var(--border);background:var(--card-bg)}.bcTabs{position:sticky;top:74px;z-index:3;display:flex;justify-content:space-around;height:66px;border-bottom:1px solid var(--border);background:var(--card-bg)}.bcTabs button{position:relative;min-width:90px;padding:0 14px;border:0;background:none;color:var(--muted);font:inherit;font-size:13px;font-weight:750;cursor:pointer}.bcTabs button.active{color:var(--text)}.bcTabs button.active:after{position:absolute;right:20%;bottom:0;left:20%;height:3px;border-radius:4px 4px 0 0;background:#2992d4;content:""}.bcPremium{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:14px;padding:13px 15px;border:1px solid #c9e4d1;border-radius:15px;background:linear-gradient(120deg,#edf8f0,var(--card-bg));color:inherit;text-decoration:none}.bcPremium:hover{border-color:#8bc89b}.bcPremium strong{font-size:13px}.bcPremium p{margin-top:4px;color:var(--muted);font-size:11px;line-height:1.45}.bcPremium>span{display:grid;place-items:center;flex:0 0 auto;min-height:39px;padding:0 15px;border-radius:999px;background:#2d8c50;color:white;font-size:11px;font-weight:800}.bcComposer{display:flex;gap:14px;padding:16px 20px;border-bottom:1px solid var(--border)}.bcAvatar{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border-radius:50%;background:#dcefe3;color:#27794a;font-size:11px;font-weight:850}.bcComposeMain{min-width:0;flex:1}.bcComposeMain>label{display:block;margin:2px 0 8px;font-size:12px;font-weight:800}.bcComposeMain textarea{width:100%;min-height:64px;padding:7px 0;border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:14px;resize:vertical}.bcComposeActions{display:flex;align-items:center;gap:10px}.bcComposeActions>span:first-child{margin-right:auto;color:var(--muted);font-size:10px}.bcMediaPick,.bcPremiumHint{position:relative;padding:8px 12px;border:1px solid var(--border);border-radius:999px;color:#27794a;font-size:10px;font-weight:750;white-space:nowrap}.bcMediaPick input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.bcComposeActions button{min-width:78px;min-height:39px;padding:0 16px;border:0;border-radius:999px;background:#2992d4;color:white;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.bcComposeActions button:disabled{opacity:.5;cursor:not-allowed}.bcFeedLabel{display:flex;justify-content:space-between;padding:15px 20px;border-bottom:1px solid var(--border);font-size:11px}.bcFeedLabel span{color:var(--muted)}.bcPostList{display:block}.bcPost{position:relative;display:flex;gap:13px;padding:17px 20px 13px;border-bottom:1px solid var(--border)}.bcPostAvatar{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;overflow:hidden;border-radius:50%;background:#dcefe3;color:#27794a;font-size:10px;font-weight:850}.bcPostAvatar img{width:100%;height:100%;object-fit:cover}.bcPostContent{min-width:0;flex:1}.bcPostHeader{display:flex;align-items:center;flex-wrap:wrap;gap:6px;min-height:28px}.bcPostMenuWrap{position:relative;display:grid;margin-left:auto}.bcPostMenu{display:grid;flex:0 0 36px;place-items:center;width:36px;height:36px;margin:-4px -8px -4px 0;padding:0;border:1px solid transparent;border-radius:50%;background:transparent;color:var(--muted);cursor:pointer}.bcPostMenu svg{display:block;width:8px;height:16px;fill:currentColor}.bcPostMenu:hover,.bcPostMenu[aria-expanded="true"]{border-color:var(--border);background:var(--card-bg);color:var(--text)}.bcPost.menuOpen{z-index:20}.bcPostMenuPanel{position:absolute;z-index:30;top:38px;right:0;display:grid;width:max-content;min-width:170px;max-width:min(250px,calc(100vw - 28px));padding:6px;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);box-shadow:0 8px 24px #14251b20}.bcPostMenuPanel button{padding:10px 12px;border:0;border-radius:6px;background:transparent;color:var(--text);text-align:left;font:inherit;font-size:12px;cursor:pointer}.bcPostMenuPanel button:hover{background:var(--bg)}.bcPostMenuPanel .deleteOption{color:#c24141}.bcEditPost{margin:7px 0}.bcEditPost textarea{width:100%;min-height:72px;padding:9px;border:1px solid var(--border);border-radius:9px;background:var(--bg);color:var(--text);font:inherit;font-size:12px;resize:vertical}.bcEditPost>div{display:flex;justify-content:flex-end;align-items:center;gap:7px;margin-top:6px}.bcEditPost>div span{margin-right:auto;color:var(--muted);font-size:9px}.bcEditPost button{padding:6px 11px;border:0;border-radius:999px;background:#2992d4;color:#fff;font-size:10px;font-weight:750;cursor:pointer}.bcEditPost button.cancelEdit{border:1px solid var(--border);background:transparent;color:var(--text)}.bcEditPost button:disabled{opacity:.55}.bcEditedLabel{color:var(--muted);font-size:9px}.bcPostMenuWrap{position:relative;display:grid;margin-left:auto}.bcPostMenu{display:grid;flex:0 0 36px;place-items:center;width:36px;height:36px;margin:-4px -8px -4px 0;padding:0;border:1px solid transparent;border-radius:50%;background:transparent;color:var(--muted);cursor:pointer}.bcPostMenu svg{display:block;width:8px;height:16px;fill:currentColor}.bcPostMenu:hover,.bcPostMenu[aria-expanded="true"]{border-color:var(--border);background:var(--card-bg);color:var(--text)}.bcPost.menuOpen{z-index:20}.bcPostMenuPanel{position:absolute;z-index:30;top:38px;right:0;display:grid;width:max-content;min-width:170px;max-width:min(250px,calc(100vw - 28px));padding:6px;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);box-shadow:0 8px 24px #14251b20}.bcPostMenuPanel button{padding:10px 12px;border:0;border-radius:6px;background:transparent;color:var(--text);text-align:left;font:inherit;font-size:12px;cursor:pointer}.bcPostMenuPanel button:hover{background:var(--bg)}.bcPostMenuPanel .deleteOption{color:#c24141}.bcEditPost{margin:7px 0}.bcEditPost textarea{width:100%;min-height:72px;padding:9px;border:1px solid var(--border);border-radius:9px;background:var(--bg);color:var(--text);font:inherit;font-size:12px;resize:vertical}.bcEditPost>div{display:flex;justify-content:flex-end;align-items:center;gap:7px;margin-top:6px}.bcEditPost>div span{margin-right:auto;color:var(--muted);font-size:9px}.bcEditPost button{padding:6px 11px;border:0;border-radius:999px;background:#2992d4;color:#fff;font-size:10px;font-weight:750;cursor:pointer}.bcEditPost button.cancelEdit{border:1px solid var(--border);background:transparent;color:var(--text)}.bcEditPost button:disabled{opacity:.55}.bcEditedLabel{color:var(--muted);font-size:9px}.bcPostHeader strong{font-size:12px}.bcPostHeader em{padding:3px 5px;border-radius:4px;background:#edf6ee;color:#387d4e;font-size:8px;font-style:normal;font-weight:850}.bcPostHeader span,.bcPostHeader i,.bcPostHeader time{color:var(--muted);font-size:10px;font-style:normal}.bcPostBody{margin:8px 0 13px;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.bcPostMedia{display:block;width:100%;max-height:520px;margin:5px 0 11px;border-radius:15px;object-fit:cover}.bcRepostNote{display:flex;align-items:center;gap:6px;margin:3px 0 5px 2px;color:#378957;font-size:9px;font-weight:700}.bcRepostNote svg{width:13px;height:13px}.bcPostActions{display:flex;align-items:center;justify-content:space-between;gap:6px;max-width:440px;padding-top:4px;color:var(--muted)}.bcPostActions button{display:flex;align-items:center;gap:5px;min-width:0;min-height:30px;padding:5px 7px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:10px;cursor:pointer}.bcPostActions button:hover{background:var(--bg);color:#267b4a}.bcPostActions button svg{display:block;width:17px;height:17px;flex:0 0 auto}.bcPostActions button:focus:not(:focus-visible){outline:none;box-shadow:none}.bcPostActions .liked{color:#e64d78}.bcPostActions .reposted{color:#28965e}.bcPostActions .saved{color:#288fd0}.bcPostActions b{font-size:10px;font-weight:700}.bcComments{margin-top:7px;padding-top:9px;border-top:1px solid var(--border)}.bcCommentState{padding:8px 0;color:var(--muted);font-size:11px}.bcComment{display:flex;gap:8px;margin:8px 0}.bcCommentAvatar{display:grid;place-items:center;flex:0 0 28px;width:28px;height:28px;overflow:hidden;border-radius:50%;background:#e4f2e8;color:#267449;font-size:8px;font-weight:800}.bcCommentAvatar img{width:100%;height:100%;object-fit:cover}.bcComment>div{min-width:0;flex:1}.bcComment strong{display:flex;align-items:center;gap:5px;font-size:10px}.bcComment em{font-size:8px;font-style:normal;color:#378957}.bcComment p{margin-top:3px;font-size:11px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.bcComment button{display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:3px 5px;border:0;border-radius:6px;background:transparent;color:var(--muted);font:inherit;font-size:9px;font-weight:700;cursor:pointer}.bcComment button svg{width:12px;height:12px}.bcComment button:hover{background:#edf5f0;color:#267b4a}.bcComment button.reacted{color:#d35465}.bcComment button:disabled{opacity:.55;cursor:default}.bcComment button.reacted{color:#d35465}.bcReply{display:flex;align-items:center;gap:8px;margin-top:10px}.bcReply input{min-width:0;flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:999px;background:var(--bg);color:var(--text);font:inherit;font-size:11px}.bcReply button{padding:8px 12px;border:0;border-radius:999px;background:#2992d4;color:#fff;font-size:10px;font-weight:800}.bcReply button:disabled{opacity:.5}.bcEmpty{margin:18px;padding:20px;border:1px dashed var(--border);border-radius:12px;color:var(--muted);font-size:12px;line-height:1.5}.bcLoadMore{display:flex;justify-content:center;padding:14px;border-top:1px solid var(--border)}.bcLoadMore button{padding:9px 16px;border:1px solid var(--border);border-radius:999px;background:var(--bg);color:var(--text);font:inherit;font-size:11px;font-weight:750;cursor:pointer}.bcLoadMore button:disabled{opacity:.55;cursor:wait}.bcRail{display:grid;align-content:start;gap:18px;padding-top:20px}.bcRailCard{position:relative;overflow:hidden;padding:0 16px 14px;border:1px solid var(--border);border-radius:20px;background:var(--card-bg)}.bcCover{height:78px;margin:0 -16px;background:linear-gradient(110deg,#d8eee0,#d9e9f2 60%,#f3eadb)}.bcProfileAvatar{display:grid;place-items:center;width:58px;height:58px;margin-top:-30px;border:3px solid var(--card-bg);border-radius:50%;background:#dcefe3;color:#27794a;font-size:14px;font-weight:850}.bcRailCard>strong{display:block;margin-top:8px;font-size:13px}.bcRailCard>p{margin-top:7px;color:var(--muted);font-size:11px;line-height:1.5}.bcRailStat{margin:13px -16px -14px;padding:13px 16px;border-top:1px solid var(--border);color:var(--muted);font-size:10px}.bcRailStat b{margin-right:4px;color:var(--text);font-size:12px}.bcProgram{padding:17px;background:linear-gradient(145deg,#eff8f1,var(--card-bg))}.bcProgram h2{margin-top:8px;font-size:16px}.bcProgram>a{display:inline-flex;align-items:center;justify-content:center;min-height:38px;margin-top:11px;padding:0 14px;border-radius:999px;background:#2d8c50;color:#fff;font-size:11px;font-weight:800;text-decoration:none}.bcProgram>span{display:inline-block;margin-top:10px;color:#2d8c50;font-size:11px;font-weight:800}.businessCreatorNotice{display:flex;align-items:center;gap:8px;margin:10px 15px;padding:10px 12px;border-radius:9px;background:#fff5df;color:#805b19;font-size:11px}.businessCreatorNotice>span{flex:1}.businessCreatorNotice button{padding:4px 7px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;font-weight:800;cursor:pointer}.businessCreatorNotice button:hover{background:#0000000c}.businessCreatorPreview{position:relative;margin-top:10px}.businessCreatorPreview img,.businessCreatorPreview video{display:block;width:100%;max-height:420px;object-fit:cover;border-radius:12px}.businessCreatorPreview>button{position:absolute;right:8px;top:8px;width:32px;height:32px;border:0;border-radius:50%;background:#0009;color:white;font-size:21px}
    @media(max-width:1100px){.businessCreatorMain{padding-inline:16px}.bcLayout{grid-template-columns:minmax(0,780px) 270px;gap:20px}.bcBrand{min-width:200px}}
    @media(max-width:760px){.businessCreatorPage{display:block}.businessCreatorMain{padding:0 0 95px}.bcTopbar{position:relative;min-height:58px;padding:0 14px;border:0}.bcBrand{min-width:0;gap:8px}.bcBrand .bcMark{width:36px;height:36px}.bcBrand small{font-size:7px}.bcBrand h1{font-size:15px}.bcSearch,.bcTopLink,.bcRail{display:none}.bcLayout{display:block}.bcFeed{border:0}.bcTabs{top:0;height:54px;justify-content:flex-start;overflow-x:auto;scrollbar-width:none}.bcTabs::-webkit-scrollbar{display:none}.bcTabs button{flex:0 0 auto;min-width:max-content;padding:0 16px;font-size:12px}.bcTabs button.active:after{right:18%;left:18%}.bcPremium{align-items:flex-start;flex-direction:column;margin:10px;padding:12px}.bcPremium>span{width:100%}.bcComposer{padding:12px 14px}.bcAvatar{flex-basis:36px;width:36px;height:36px}.bcComposeMain textarea{min-height:55px}.bcComposeActions{flex-wrap:wrap}.bcComposeActions>span:first-child{width:100%}.bcPremiumHint,.bcMediaPick{max-width:calc(100% - 90px);overflow:hidden;text-overflow:ellipsis}.bcFeedLabel{padding:12px 14px}.bcPost{gap:10px;padding:14px}.bcPostAvatar{flex-basis:38px;width:38px;height:38px}.bcPostHeader{gap:4px}.bcPostHeader strong{font-size:11px}.bcPostHeader span,.bcPostHeader time{font-size:9px}.bcPostBody{font-size:14px}.bcPostMedia{border-radius:12px}}
  `}</style></main>;
}
