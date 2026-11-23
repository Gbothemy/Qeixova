import { cache } from "react";
import { ensureCreatorSchema } from "@/lib/contributorFeatures";
import { sql } from "@/lib/db";

export const getPublicCreatorPost = cache(async (id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  await ensureCreatorSchema();
  const rows = await sql`
    SELECT p.id, p.body, p.media_url, p.media_type, p.created_at, u.id AS author_id, bu.id AS business_id,
      COALESCE(u.full_name, bu.name) AS author_name, COALESCE(u.bio, '') AS author_bio, u.avatar_url AS author_avatar_url
    FROM creator_posts p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN businesses bu ON bu.id = p.business_id
    WHERE p.id = ${id} AND ((p.user_id IS NOT NULL AND COALESCE(u.email_verified, false) = true) OR p.business_id IS NOT NULL)
    LIMIT 1
  `;
  const post = rows[0];
  if (!post) return null;
  return {
    id: Number(post.id),
    body: String(post.body),
    mediaUrl: post.media_url ? String(post.media_url) : null,
    mediaType: post.media_type ? String(post.media_type) : null,
    authorAvatarUrl: post.author_avatar_url ? String(post.author_avatar_url) : null,
    createdAt: new Date(post.created_at).toISOString(),
    authorId: post.author_id === null ? null : Number(post.author_id),
    isBusiness: post.business_id !== null,
    authorName: String(post.author_name || "Qeixova contributor"),
    authorBio: String(post.author_bio || ""),
  };
});
