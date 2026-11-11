"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import ContributorLoading from "@/components/ContributorLoading";

type PublicPost = { id: number; body: string; created_at: string; like_count: number; view_count: number; comment_count: number; repost_count: number };
type PublicProfile = { id: number; full_name: string; bio: string | null; website: string | null; location: string | null; occupation: string | null; created_at: string; level: number; level_name: string | null; badge_color: string | null; follower_count: number; following_count: number; followed: boolean; is_premium: boolean };

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "Q"; }
function PremiumBadge() {
  return <svg className="premiumVerifiedBadge" viewBox="0 0 24 24" role="img" aria-label="Premium verified" title="Premium verified"><path d="M12 1.8 14.8 3l3-.1 1.2 2.7 2.5 1.7-.6 2.9.6 2.9-2.5 1.7-1.2 2.7-3-.1-2.8 1.2-2.8-1.2-3 .1L5 14.8l-2.5-1.7.6-2.9-.6-2.9L5 5.6 6.2 2.9l3 .1L12 1.8Z"/><path className="premiumVerifiedCheck" d="m8.1 11.9 2.4 2.4 5.5-5.5"/></svg>;
}
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
      <header className="publicProfileHeading"><Link href="/creator" aria-label="Back to Home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg></Link><div><strong className="publicProfileHeadingName">{profile.full_name}{profile.is_premium ? <PremiumBadge /> : null}</strong><span>{posts.length.toLocaleString()} {posts.length === 1 ? "post" : "posts"}</span></div></header>
      <section className="publicProfileIdentity">
        <div className="publicProfileActions"><span className="publicProfileAvatar" aria-hidden="true">{initials(profile.full_name)}</span><div><button type="button" className={`publicFollowButton${following ? " isFollowing" : ""}`} onClick={() => void toggleFollow()} disabled={busy}>{busy ? "Saving…" : following ? "Following" : "Follow"}</button><Link className="publicMessageButton" href={`/messages?to=${profile.id}`} aria-label={`Message ${profile.full_name}`} title={`Message ${profile.full_name}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 9h8M8 12.5h5"/></svg><span className="publicSrOnly">Message</span></Link></div></div>
        <h1><span>{profile.full_name}</span>{profile.is_premium ? <PremiumBadge /> : null}</h1><span className="publicProfileHandle">@{handle}</span>
        {profile.bio ? <p className="publicProfileBio">{profile.bio}</p> : null}
        <div className="publicProfileMeta">{profile.occupation ? <span>{profile.occupation}</span> : null}{profile.location ? <span>{profile.location}</span> : null}{profile.website ? <a href={/^https?:\/\//i.test(profile.website) ? profile.website : `https://${profile.website}`} target="_blank" rel="noreferrer">{profile.website}</a> : null}<span>Joined {new Date(profile.created_at).toLocaleDateString([], { month: "long", year: "numeric" })}</span></div>
        <div className="publicProfileCounts"><span><b>{profile.following_count.toLocaleString()}</b> Following</span><span><b>{profile.follower_count.toLocaleString()}</b> Followers</span></div>
        <span className="publicLevel" style={{ borderColor: `${profile.badge_color || "#328456"}55`, color: profile.badge_color || "#328456" }}>L{profile.level} {profile.level_name || "Contributor"}</span>
      </section>
      <div className="publicPostsHeading">Posts</div>
      <section className="publicPostList" aria-label={`${profile.full_name}'s posts`}>
        {posts.length ? posts.map((post) => <article className="publicPost" key={post.id}><Link className="publicPostAvatar" href={`/profile/${profile.id}`} aria-label={`Open ${profile.full_name}'s profile`}>{initials(profile.full_name)}</Link><div><header><strong>{profile.full_name}</strong>{profile.is_premium ? <PremiumBadge /> : null}<span>@{handle}</span><span>·</span><time>{timeAgo(post.created_at)}</time></header><p>{post.body}</p><footer><span>◉ {post.view_count.toLocaleString()}</span><span>♡ {post.like_count.toLocaleString()}</span><span>↻ {post.repost_count.toLocaleString()}</span><span>▢ {post.comment_count.toLocaleString()}</span></footer></div></article>) : <div className="publicProfileEmpty"><strong>No posts yet</strong><span>Posts shared by this contributor will appear here.</span></div>}
      </section>
    </main>
    <BottomNav />
    <style jsx>{`
      .publicProfilePage{display:block;flex:0 0 auto;width:100%;max-width:750px;min-height:100vh;margin:0 auto;border-inline:1px solid var(--border);background:var(--bg);color:var(--text)}
      .publicProfileHeading{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:16px;min-height:64px;padding:8px 20px;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(12px)}
      .publicProfilePage .publicProfileHeading>a,.publicProfilePage .publicProfileHeading>a:visited{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;color:var(--text);font-size:22px;text-decoration:none;transition:background .15s}.publicProfilePage .publicProfileHeading>a:hover{background:var(--surface)}.publicProfileHeading>div{display:grid;gap:3px}.publicProfileHeading strong{font-size:16px;line-height:1.2}.publicProfileHeading span,.publicProfileHandle{color:var(--muted);font-size:13px}
      .publicProfileIdentity{padding:20px 24px 22px;border-bottom:1px solid var(--border)}.publicProfileActions{display:flex;align-items:flex-start;justify-content:space-between;min-height:88px;margin-bottom:12px}.publicProfileAvatar,.publicPostAvatar{display:grid;place-items:center;border-radius:50%;background:#e2f1e6;color:#27784a;font-weight:850}.publicProfileAvatar{width:82px;height:82px;border:4px solid var(--bg);font-size:23px;box-shadow:0 0 0 1px var(--border)}.publicProfileActions>div{display:flex;flex-wrap:nowrap;align-items:center;gap:9px;padding-top:2px}.publicFollowButton,.publicMessageButton{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 19px;border:1px solid #328456;border-radius:999px;background:#328456;color:#fff;font:inherit;font-size:14px;font-weight:750;text-decoration:none;white-space:nowrap;cursor:pointer;transition:background .15s,color .15s,border-color .15s,transform .15s}.publicFollowButton:hover{background:#246a43;border-color:#246a43}.publicFollowButton:active,.publicMessageButton:active{transform:scale(.98)}.publicFollowButton.isFollowing{background:var(--bg);color:#328456}.publicFollowButton.isFollowing:hover{border-color:#c64545;background:#fff5f5;color:#b42318}.publicFollowButton:disabled{opacity:.65;cursor:wait}.publicProfilePage .publicProfileActions .publicMessageButton,.publicProfilePage .publicProfileActions .publicMessageButton:link,.publicProfilePage .publicProfileActions .publicMessageButton:visited{width:44px;height:44px;min-height:44px;padding:0;border-color:var(--border);background:var(--bg);color:var(--text);text-decoration:none}.publicProfilePage .publicProfileActions .publicMessageButton:hover{border-color:#328456;background:#f2faf4;color:var(--text);text-decoration:none}.publicMessageButton svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.publicSrOnly{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      .publicProfileIdentity h1{margin:0;font-size:24px;line-height:1.25;letter-spacing:-.025em;font-weight:800}.publicProfileBio{margin:14px 0 0;font-size:14px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.publicProfileMeta{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:14px;color:var(--muted);font-size:13px}.publicProfileMeta a{color:#328456;text-decoration:none}.publicProfileMeta a:hover{text-decoration:underline}.publicProfileCounts{display:flex;gap:20px;margin-top:16px;color:var(--muted);font-size:14px}.publicProfileCounts b{color:var(--text);font-weight:800}.publicLevel{display:inline-flex;align-items:center;margin-top:15px;padding:5px 10px;border:1px solid;border-radius:999px;background:color-mix(in srgb,currentColor 7%,var(--bg));font-size:12px;font-weight:750}
      .publicPostsHeading{position:sticky;top:64px;z-index:3;padding:15px 24px;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--bg) 94%,transparent);font-size:14px;font-weight:800}.publicPost{display:flex;gap:13px;padding:17px 20px;border-bottom:1px solid var(--border);transition:background .15s}.publicPost:hover{background:color-mix(in srgb,var(--surface) 45%,transparent)}.publicPostAvatar{flex:0 0 44px;width:44px;height:44px;font-size:13px;text-decoration:none;transition:box-shadow .15s,transform .15s}.publicPostAvatar:hover{box-shadow:0 0 0 3px #32845633;transform:scale(1.04)}.publicPost>div{min-width:0;flex:1}.publicPost header{display:flex;flex-wrap:wrap;align-items:baseline;gap:5px;color:var(--muted);font-size:13px}.publicPost header strong{color:var(--text);font-weight:750}.publicPost p{margin:7px 0 0;font-size:15px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.publicPost footer{display:flex;justify-content:space-between;gap:12px;margin-top:15px;color:var(--muted);font-size:12px}.publicProfileEmpty,.publicProfileError{display:grid;justify-items:center;gap:8px;padding:56px 20px;text-align:center}.publicProfileEmpty strong,.publicProfileError h1{margin:0;font-size:18px}.publicProfileEmpty span,.publicProfileError p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}.publicProfileError a{color:#328456}
      .publicProfilePage .publicPostList a.publicPostAvatar,.publicProfilePage .publicPostList a.publicPostAvatar:link,.publicProfilePage .publicPostList a.publicPostAvatar:visited{display:grid;flex:0 0 44px;place-items:center;width:44px;height:44px;overflow:hidden;border:1px solid #c6e2ce;border-radius:50%;background:linear-gradient(145deg,#edf8f0,#d9eedf);color:#247444;font-size:13px;font-weight:850;line-height:1;text-align:center;text-decoration:none!important;text-decoration-line:none!important;text-underline-offset:0}
      .publicProfilePage .publicPostList a.publicPostAvatar:hover{color:#1e6339;text-decoration:none!important;box-shadow:0 0 0 3px #3284562b;transform:translateY(-1px)}
      .publicProfilePage .publicPostList a.publicPostAvatar:focus-visible{outline:3px solid #328456;outline-offset:3px}
      @media(max-width:700px){.publicProfilePage{border:0;padding-bottom:calc(72px + env(safe-area-inset-bottom))}.publicProfileHeading{min-height:58px;padding:7px 14px}.publicProfileIdentity{padding:16px 16px 19px}.publicProfileActions{min-height:76px;margin-bottom:10px}.publicProfileAvatar{width:72px;height:72px;font-size:20px}.publicProfileActions>div{gap:7px}.publicFollowButton,.publicMessageButton{min-height:40px;padding:0 14px;font-size:13px}.publicProfileIdentity h1{font-size:22px}.publicProfileMeta{gap:8px 12px;font-size:12px}.publicProfileCounts{gap:17px;font-size:13px}.publicPostsHeading{top:58px;padding:13px 16px}.publicPost{padding:15px 13px;gap:10px}.publicPostAvatar{flex-basis:39px;width:39px;height:39px}.publicPost header{font-size:12px}.publicPost p{font-size:14px}.publicPost footer{flex-wrap:wrap;justify-content:flex-start;gap:8px 14px;font-size:11px}}
    `}</style>
  </>;
}
