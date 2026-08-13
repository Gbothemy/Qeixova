"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ContributorLoading from "@/components/ContributorLoading";
import { useAuth } from "@/lib/useAuth";

type Comment = {
  id: number;
  body: string;
  created_at: string;
  author_name: string;
};

type Post = {
  id: number;
  body: string;
  topic: string;
  created_at: string;
  author_name: string;
  author_level: string;
  badge_color: string;
  reaction_count: number;
  comment_count: number;
  reacted: boolean;
  comments: Comment[];
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "Q";
}

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function CommunityFeed() {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postBody, setPostBody] = useState("");
  const [comments, setComments] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadPosts = useCallback(async () => {
    setError("");
    const response = await fetch("/api/community/posts", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      setError("The growth feed could not be loaded. Please try again.");
      setLoading(false);
      return;
    }
    const data = await response.json().catch(() => ({}));
    setPosts(Array.isArray(data.posts) ? data.posts : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) void loadPosts();
  }, [user, loadPosts]);

  const request = useCallback(async (payload: Record<string, unknown>, key: string) => {
    setBusy(key);
    setError("");
    const response = await fetch("/api/community/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    setBusy(null);
    if (!response?.ok) {
      setError(data?.error || "That action could not be completed.");
      return false;
    }
    await loadPosts();
    return true;
  }, [loadPosts]);

  const submitPost = async () => {
    const content = postBody.trim();
    if (content.length < 3) return setError("Write something before posting.");
    if (await request({ action: "create_post", body: content }, "post")) setPostBody("");
  };

  const submitComment = async (postId: number) => {
    const content = (comments[postId] || "").trim();
    if (content.length < 2) return setError("Write a comment first.");
    if (await request({ action: "comment", postId, body: content }, `comment:${postId}`)) {
      setComments((current) => ({ ...current, [postId]: "" }));
      setExpanded((current) => new Set(current).add(postId));
    }
  };

  const totalActivity = useMemo(() => posts.reduce((sum, post) => sum + post.reaction_count + post.comment_count, 0), [posts]);

  if (authLoading || loading) return <ContributorLoading label="Loading growth feed" detail="Connecting you with the Qeixova community." />;

  return (
    <main className="page-body communityFeed">
      <header className="feedHeader">
        <div>
          <p>Growth</p>
          <h1>Community Feed</h1>
          <span>Share progress, ask questions, and help contributors grow together.</span>
        </div>
        <div className="feedSignal"><strong>{posts.length}</strong><span>posts</span><strong>{totalActivity}</strong><span>interactions</span></div>
      </header>

      {error ? <div className="feedError" role="alert">{error}</div> : null}

      <section className="composer" aria-label="Create community post">
        <div className="avatar current">{initials(user?.fullName || "Qeixova")}</div>
        <div className="composerBody">
          <textarea
            value={postBody}
            onChange={(event) => setPostBody(event.target.value.slice(0, 800))}
            placeholder="Share an update, win, link, or question..."
            aria-label="Post content"
          />
          <div><span>{postBody.length}/800</span><button type="button" disabled={busy === "post" || postBody.trim().length < 3} onClick={submitPost}>{busy === "post" ? "Posting..." : "Post"}</button></div>
        </div>
      </section>

      <section className="feedList" aria-label="Community posts">
        {posts.length === 0 ? (
          <div className="emptyFeed"><strong>Start the conversation</strong><span>Share the first update with the contributor community.</span></div>
        ) : posts.map((post) => {
          const showComments = expanded.has(post.id);
          return (
            <article className="postCard" key={post.id}>
              <header>
                <div className="avatar" style={{ borderColor: post.badge_color }}>{initials(post.author_name)}</div>
                <div><h2>{post.author_name}</h2><p>{post.author_level} contributor · {relativeTime(post.created_at)}</p></div>
                <span className="topic">{post.topic}</span>
              </header>
              <p className="postBody">{post.body}</p>
              <div className="postCounts"><span>{post.reaction_count} helpful</span><span>{post.comment_count} comment{post.comment_count === 1 ? "" : "s"}</span></div>
              <div className="postActions">
                <button type="button" className={post.reacted ? "active" : ""} disabled={busy === `reaction:${post.id}`} onClick={() => request({ action: "toggle_reaction", postId: post.id }, `reaction:${post.id}`)}>{post.reacted ? "Helpful ✓" : "Helpful"}</button>
                <button type="button" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(post.id)) next.delete(post.id); else next.add(post.id); return next; })}>Comments ({post.comment_count})</button>
              </div>
              {showComments ? (
                <div className="commentSection">
                  {post.comments.map((comment) => (
                    <div className="comment" key={comment.id}><span>{initials(comment.author_name)}</span><p><strong>{comment.author_name}</strong>{comment.body}</p></div>
                  ))}
                  {post.comments.length === 0 ? <p className="noComments">No comments yet. Add the first one.</p> : null}
                  <div className="commentComposer">
                    <input value={comments[post.id] || ""} maxLength={300} onChange={(event) => setComments((current) => ({ ...current, [post.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitComment(post.id); } }} placeholder="Write a comment" aria-label={`Comment on ${post.author_name}'s post`} />
                    <button type="button" disabled={busy === `comment:${post.id}` || (comments[post.id] || "").trim().length < 2} onClick={() => submitComment(post.id)}>{busy === `comment:${post.id}` ? "Sending..." : "Send"}</button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <style jsx>{`
        .communityFeed{width:100%;max-width:760px;margin:0 auto;color:var(--text);padding-top:28px}.feedHeader{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:22px 24px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(135deg,rgba(245,166,35,.1),rgba(26,239,34,.04) 55%,#090a09);margin-bottom:14px}.feedHeader p{margin:0 0 5px;color:var(--accent-2);font-size:11px;font-weight:950;letter-spacing:1px;text-transform:uppercase}.feedHeader h1{margin:0;font-size:32px;line-height:1.05}.feedHeader>div>span{display:block;margin-top:8px;color:var(--muted);font-size:13px;line-height:1.5}.feedSignal{display:grid!important;grid-template-columns:auto auto;gap:2px 8px;min-width:130px;padding:11px 13px;border:1px solid var(--border);border-radius:13px;background:#090a09}.feedSignal strong{font-size:16px;color:var(--text)}.feedSignal span{margin:0!important;font-size:10px!important}.feedError{margin-bottom:12px;padding:11px 13px;border:1px solid rgba(229,62,62,.3);border-radius:12px;background:rgba(229,62,62,.08);color:#ff9999;font-size:12px}.composer,.postCard,.emptyFeed{border:1px solid var(--border);border-radius:15px;background:#0c0e0d}.composer{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;padding:14px;margin-bottom:12px}.avatar{width:40px;height:40px;display:grid;place-items:center;border:2px solid var(--accent);border-radius:50%;background:#090b0a;color:var(--text);font-size:12px;font-weight:950;flex:0 0 auto}.avatar.current{border:0;background:var(--accent-2);color:#090909}.composerBody textarea{width:100%;min-height:90px;resize:vertical;border:1px solid var(--border);border-radius:11px;background:#050706;color:var(--text);padding:12px;font:inherit;font-size:13px;line-height:1.5;outline:none}.composerBody textarea:focus,.commentComposer input:focus{border-color:rgba(26,239,34,.55);box-shadow:0 0 0 3px rgba(26,239,34,.08)}.composerBody>div{display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:8px}.composerBody span{color:var(--muted);font-size:11px}.composer button,.commentComposer button{border:0;border-radius:10px;background:var(--accent);color:#050505;padding:10px 20px;font-weight:950;cursor:pointer}.composer button:disabled,.commentComposer button:disabled{opacity:.45;cursor:not-allowed}.feedList{display:grid;gap:11px}.postCard{padding:14px}.postCard>header{display:flex;align-items:center;gap:10px}.postCard h2{margin:0;font-size:14px}.postCard header p{margin:3px 0 0;color:var(--muted);font-size:11px}.topic{margin-left:auto;padding:5px 8px;border-radius:999px;background:rgba(245,166,35,.09);color:var(--accent-2);font-size:9px;font-weight:900;text-transform:uppercase}.postBody{margin:14px 0;color:var(--text);font-size:14px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}.postCounts{display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid var(--border);color:var(--muted);font-size:11px}.postActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.postActions button{min-height:38px;border:1px solid var(--border);border-radius:9px;background:#060807;color:var(--text);font-weight:850;cursor:pointer}.postActions button.active{border-color:rgba(26,239,34,.45);background:rgba(26,239,34,.08);color:var(--accent)}.commentSection{display:grid;gap:8px;margin-top:10px}.comment{display:flex;align-items:flex-start;gap:9px;padding:9px;border-radius:10px;background:#060807}.comment>span{width:27px;height:27px;display:grid;place-items:center;border-radius:50%;background:#1b201e;color:#ddd;font-size:9px;font-weight:900}.comment p{margin:0;color:var(--muted);font-size:12px;line-height:1.5}.comment strong{display:block;margin-bottom:2px;color:var(--text);font-size:11px}.noComments{margin:2px 0;color:var(--muted);font-size:11px}.commentComposer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.commentComposer input{min-width:0;border:1px solid var(--border);border-radius:9px;background:#050706;color:var(--text);padding:10px 12px;outline:none}.commentComposer button{padding:9px 16px}.emptyFeed{display:grid;gap:6px;place-items:center;padding:44px 20px;text-align:center}.emptyFeed span{color:var(--muted);font-size:12px}@media(max-width:640px){.communityFeed{padding:16px 14px 96px}.feedHeader{align-items:flex-start;flex-direction:column;padding:18px}.feedHeader h1{font-size:27px}.feedSignal{width:100%}.composer{grid-template-columns:1fr}.composer>.avatar{display:none}.postCard{padding:12px}.topic{display:none}.postActions{grid-template-columns:1fr}.commentComposer{grid-template-columns:1fr}.commentComposer button{width:100%}}
      `}</style>
    </main>
  );
}
