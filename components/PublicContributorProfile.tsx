"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import ContributorLoading from "@/components/ContributorLoading";

type PublicPost = { id: number; body: string; created_at: string; like_count: number; view_count: number; comment_count: number; repost_count: number };
type PublicProfile = { id: number; full_name: string; bio: string | null; website: string | null; location: string | null; occupation: string | null; created_at: string; level: number; level_name: string | null; badge_color: string | null; follower_count: number; following_count: number; followed: boolean };

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "Q"; }
function timeAgo(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export default function PublicContributorProfile({ id }: { id: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/contributor/profile/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load this profile.");
        if (active) {
          setProfile(data.profile);
          setPosts(Array.isArray(data.posts) ? data.posts : []);
          setFollowing(Boolean(data.profile?.followed));
        }
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load this profile."); });
    return () => { active = false; };
  }, [id]);

  const toggleFollow = async () => {
    if (!profile || busy) return;
    setBusy(true);
    const response = await fetch("/api/contributor/creator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle_follow", creatorId: profile.id }) }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) setError(data.error || "Could not update your follow.");
    else {
      const nextFollowing = Boolean(data.followed);
      setFollowing(nextFollowing);
      setProfile((current) => current ? { ...current, followed: nextFollowing, follower_count: Math.max(0, current.follower_count + (nextFollowing ? 1 : -1)) } : current);
    }
    setBusy(false);
  };

  if (!profile) return <><main className="publicProfilePage">{error ? <section className="publicProfileError"><h1>Profile unavailable</h1><p>{error}</p><Link href="/creator">Back to Home</Link></section> : <ContributorLoading label="Loading contributor" detail="Opening their public creator profile." />}</main><BottomNav /></>;

  const handle = profile.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "contributor";
  return <>
    <main className="publicProfilePage">
      <header className="publicProfileHeading"><Link href="/creator" aria-label="Back to Home">←</Link><div><strong>{profile.full_name}</strong><span>{posts.length.toLocaleString()} posts</span></div></header>
      <section className="publicProfileIdentity">
        <div className="publicProfileActions"><span className="publicProfileAvatar">{initials(profile.full_name)}</span><div><button type="button" className={`publicFollowButton${following ? " isFollowing" : ""}`} onClick={() => void toggleFollow()} disabled={busy}>{busy ? "Saving…" : following ? "Following" : "Follow"}</button><Link className="publicMessageButton" href={`/messages?to=${profile.id}`}>Message</Link></div></div>
        <h1>{profile.full_name}</h1><span className="publicProfileHandle">@{handle}</span>
        {profile.bio ? <p className="publicProfileBio">{profile.bio}</p> : null}
        <div className="publicProfileMeta">{profile.occupation ? <span>{profile.occupation}</span> : null}{profile.location ? <span>{profile.location}</span> : null}{profile.website ? <a href={/^https?:\/\//i.test(profile.website) ? profile.website : `https://${profile.website}`} target="_blank" rel="noreferrer">{profile.website}</a> : null}<span>Joined {new Date(profile.created_at).toLocaleDateString([], { month: "long", year: "numeric" })}</span></div>
        <div className="publicProfileCounts"><span><b>{profile.following_count.toLocaleString()}</b> Following</span><span><b>{profile.follower_count.toLocaleString()}</b> Followers</span></div>
        <span className="publicLevel" style={{ borderColor: `${profile.badge_color || "#328456"}55`, color: profile.badge_color || "#328456" }}>L{profile.level} {profile.level_name || "Contributor"}</span>
      </section>
      <div className="publicPostsHeading">Posts</div>
      <section className="publicPostList" aria-label={`${profile.full_name}'s posts`}>
        {posts.length ? posts.map((post) => <article className="publicPost" key={post.id}><span className="publicPostAvatar">{initials(profile.full_name)}</span><div><header><strong>{profile.full_name}</strong><span>@{handle}</span><span>·</span><time>{timeAgo(post.created_at)}</time></header><p>{post.body}</p><footer><span>◉ {post.view_count.toLocaleString()}</span><span>♡ {post.like_count.toLocaleString()}</span><span>↻ {post.repost_count.toLocaleString()}</span><span>▢ {post.comment_count.toLocaleString()}</span></footer></div></article>) : <div className="publicProfileEmpty"><strong>No posts yet</strong><span>Posts shared by this contributor will appear here.</span></div>}
      </section>
    </main>
    <BottomNav />
    <style jsx>{`
      .publicProfilePage{width:min(100%,750px);min-height:100vh;margin:0 auto;border-inline:1px solid var(--border);background:var(--bg);color:var(--text)}
      .publicProfileHeading{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:20px;height:58px;padding:0 18px;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(12px)}
      .publicProfileHeading>a{color:var(--text);font-size:24px;text-decoration:none}.publicProfileHeading>div{display:grid;gap:2px}.publicProfileHeading strong{font-size:16px}.publicProfileHeading span,.publicProfileHandle{color:var(--muted);font-size:12px}
      .publicProfileIdentity{padding:15px 20px 17px;border-bottom:1px solid var(--border)}.publicProfileActions{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px}.publicProfileAvatar,.publicPostAvatar{display:grid;place-items:center;border-radius:50%;background:#e2f1e6;color:#27784a;font-weight:850}.publicProfileAvatar{width:76px;height:76px;border:4px solid var(--bg);font-size:22px}.publicProfileActions>div{display:flex;gap:8px}.publicFollowButton,.publicMessageButton{display:inline-flex;align-items:center;justify-content:center;min-height:37px;padding:0 15px;border:1px solid #328456;border-radius:999px;background:#328456;color:#fff;font:inherit;font-size:12px;font-weight:800;text-decoration:none;cursor:pointer}.publicFollowButton.isFollowing{background:var(--bg);color:#328456}.publicFollowButton:disabled{opacity:.65}.publicMessageButton{border-color:var(--border);background:var(--bg);color:var(--text)}
      .publicProfileIdentity h1{font-size:21px;letter-spacing:-.03em}.publicProfileBio{margin-top:12px;font-size:13px;line-height:1.5;white-space:pre-wrap}.publicProfileMeta{display:flex;flex-wrap:wrap;gap:8px 13px;margin-top:12px;color:var(--muted);font-size:11px}.publicProfileMeta a{color:#328456}.publicProfileCounts{display:flex;gap:16px;margin-top:13px;color:var(--muted);font-size:12px}.publicProfileCounts b{color:var(--text)}.publicLevel{display:inline-flex;margin-top:12px;padding:4px 8px;border:1px solid;border-radius:999px;font-size:10px;font-weight:750}
      .publicPostsHeading{position:sticky;top:58px;z-index:3;padding:14px 20px;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--bg) 94%,transparent);font-size:13px;font-weight:800}.publicPost{display:flex;gap:11px;padding:15px 18px;border-bottom:1px solid var(--border)}.publicPostAvatar{flex:0 0 40px;width:40px;height:40px;font-size:12px}.publicPost>div{min-width:0;flex:1}.publicPost header{display:flex;flex-wrap:wrap;gap:5px;color:var(--muted);font-size:11px}.publicPost header strong{color:var(--text)}.publicPost p{margin-top:6px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.publicPost footer{display:flex;justify-content:space-between;gap:8px;margin-top:12px;color:var(--muted);font-size:10px}.publicProfileEmpty,.publicProfileError{display:grid;justify-items:center;gap:8px;padding:48px 20px;text-align:center}.publicProfileEmpty span,.publicProfileError p{color:var(--muted);font-size:12px}.publicProfileError a{color:#328456}
      @media(max-width:700px){.publicProfilePage{border:0}.publicProfileIdentity{padding:13px 15px 16px}.publicProfileAvatar{width:68px;height:68px}.publicPost{padding:13px 12px;gap:9px}.publicPostAvatar{flex-basis:36px;width:36px;height:36px}.publicPost footer{flex-wrap:wrap;justify-content:flex-start;gap:8px 14px}}
    `}</style>
  </>;
}
