import { sql } from "@/lib/db";

let creatorSchemaReady: Promise<void> | null = null;
let messagingSchemaReady: Promise<void> | null = null;

export function ensureCreatorSchema() {
  if (!creatorSchemaReady) creatorSchemaReady = (async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS creator_posts (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK (char_length(body) BETWEEN 3 AND 1200),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS creator_posts_created_idx ON creator_posts(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS creator_posts_user_idx ON creator_posts(user_id, created_at DESC)`;
  await sql`ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_post_likes (
      post_id BIGINT NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_post_views (
      post_id BIGINT NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
      viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, viewer_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_follows (
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, creator_id),
      CHECK (follower_id <> creator_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_post_comments (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS creator_post_comments_idx ON creator_post_comments(post_id, created_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_post_reposts (
      post_id BIGINT NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_post_bookmarks (
      post_id BIGINT NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
  `;
  })().catch((error) => { creatorSchemaReady = null; throw error; });
  return creatorSchemaReady;
}

export function ensureMessagingSchema() {
  if (!messagingSchemaReady) messagingSchemaReady = (async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS contributor_conversations (
      id BIGSERIAL PRIMARY KEY,
      participant_low INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      participant_high INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT contributor_conversation_distinct_users CHECK (participant_low < participant_high),
      CONSTRAINT contributor_conversation_pair_unique UNIQUE (participant_low, participant_high)
    )
  `;
  await sql`ALTER TABLE contributor_conversations ADD COLUMN IF NOT EXISTS initiated_by INTEGER REFERENCES users(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE contributor_conversations ADD COLUMN IF NOT EXISTS source_post_id BIGINT`;
  await sql`ALTER TABLE contributor_conversations ADD COLUMN IF NOT EXISTS request_status TEXT NOT NULL DEFAULT 'accepted'`;
  await sql`
    CREATE TABLE IF NOT EXISTS contributor_user_blocks (
      blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id),
      CHECK (blocker_id <> blocked_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS contributor_messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id BIGINT NOT NULL REFERENCES contributor_conversations(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS contributor_messages_conversation_idx ON contributor_messages(conversation_id, created_at)`;
  })().catch((error) => { messagingSchemaReady = null; throw error; });
  return messagingSchemaReady;
}
