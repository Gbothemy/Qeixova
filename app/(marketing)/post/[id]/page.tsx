import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicCreatorPost, getPublicPostPreviewImageUrl } from "@/lib/publicCreatorPost";

type Props = { params: Promise<{ id: string }> };

function getPostId(id: string) { return /^\d+$/.test(id) ? Number(id) : 0; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPublicCreatorPost(getPostId(id)).catch(() => null);
  if (!post) return { title: "Post not found | Qeixova" };
  const description = (post.body.trim() || `${post.authorName} shared a post on Qeixova.`).replace(/\s+/g, " ").slice(0, 300);
  const canonicalPath = `/post/${post.id}`;
  const previewImage = getPublicPostPreviewImageUrl(post);
  return {
    title: `${post.authorName} on Qeixova`,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: { type: "article", url: canonicalPath, title: `${post.authorName} on Qeixova`, description, siteName: "Qeixova", images: [{ url: previewImage, alt: `Post by ${post.authorName}` }] },
    twitter: { card: "summary_large_image", title: `${post.authorName} on Qeixova`, description, images: [previewImage] },
  };
}

export default async function SharedPostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPublicCreatorPost(getPostId(id)).catch(() => null);
  if (!post) notFound();
  return (
    <main className="sharedPostPage">
      <Link href="/" className="sharedPostBrand"><img src="/qeixova-icon.png" alt="" /> Qeixova</Link>
      <article className="sharedPostCard">
        <header>{post.isBusiness ? <span className="sharedPostAvatar" aria-label={`${post.authorName}, business`}>{post.authorName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span> : <Link href={`/profile/${post.authorId}`} className="sharedPostAvatar" aria-label={`View ${post.authorName}'s profile`}>{post.authorAvatarUrl ? <img src={post.authorAvatarUrl} alt="" /> : post.authorName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</Link>}<div><strong>{post.authorName}</strong><span>{post.isBusiness ? "Qeixova business" : "Qeixova contributor"} · {new Date(post.createdAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</span></div></header>
        {post.body.trim() ? <p className="sharedPostBody">{post.body}</p> : null}
        {post.mediaUrl ? post.mediaType === "video" ? <video src={post.mediaUrl} controls playsInline preload="metadata" aria-label="Post video" style={{ width: "100%", maxHeight: 540, borderRadius: 12 }} /> : <img src={post.mediaUrl} alt="Post attachment" style={{ width: "100%", maxHeight: 540, objectFit: "cover", borderRadius: 12 }} /> : null}
        {post.authorBio ? <p className="sharedPostBio">{post.authorBio}</p> : null}
        <footer><span>Shared from Qeixova</span><Link href={`/creator?post=${post.id}`}>Open in Qeixova <span aria-hidden="true">→</span></Link></footer>
      </article>
    </main>
  );
}
