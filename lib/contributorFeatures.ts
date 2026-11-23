import { sql } from "@/lib/db";

let creatorSchemaReady: Promise<void> | null = null;
let messagingSchemaReady: Promise<void> | null = null;

export function ensureCreatorSchema() {
  if (!creatorSchemaReady) creatorSchemaReady = (async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS creator_posts (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1200),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS creator_posts_created_idx ON creator_posts(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS creator_posts_user_idx ON creator_posts(user_id, created_at DESC)`;
  await sql`ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS media_url TEXT`;
  await sql`ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS media_type TEXT`;
  await sql`ALTER TABLE creator_posts ALTER COLUMN user_id DROP NOT NULL`;
  await sql`ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE`;
  await sql`CREATE INDEX IF NOT EXISTS creator_posts_business_idx ON creator_posts(business_id, created_at DESC) WHERE business_id IS NOT NULL`;
  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_posts_one_author_check' AND conrelid = 'creator_posts'::regclass) THEN
      ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_one_author_check CHECK ((user_id IS NOT NULL AND business_id IS NULL) OR (user_id IS NULL AND business_id IS NOT NULL));
    END IF;
  END $$`;
  await sql`DO $$ BEGIN
    ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_body_check;
    ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_body_or_media_check;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'creator_posts_body_or_media_check'
        AND conrelid = 'creator_posts'::regclass
    ) THEN
      ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_body_or_media_check
        CHECK ((char_length(body) BETWEEN 1 AND 1200) OR media_url IS NOT NULL);
    END IF;
  END $$`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
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
  await sql`ALTER TABLE creator_post_likes DROP CONSTRAINT IF EXISTS creator_post_likes_pkey`;
  await sql`ALTER TABLE creator_post_likes ALTER COLUMN user_id DROP NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_post_likes_user_unique ON creator_post_likes(post_id, user_id) WHERE user_id IS NOT NULL`;
  await sql`ALTER TABLE creator_post_likes ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_post_likes_business_unique ON creator_post_likes(post_id, business_id) WHERE business_id IS NOT NULL`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='creator_post_likes_actor_check' AND conrelid='creator_post_likes'::regclass) THEN ALTER TABLE creator_post_likes ADD CONSTRAINT creator_post_likes_actor_check CHECK ((user_id IS NOT NULL AND business_id IS NULL) OR (user_id IS NULL AND business_id IS NOT NULL)); END IF; END $$`;
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
  await sql`ALTER TABLE creator_post_comments ALTER COLUMN user_id DROP NOT NULL`;
  await sql`ALTER TABLE creator_post_comments ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='creator_post_comments_actor_check' AND conrelid='creator_post_comments'::regclass) THEN ALTER TABLE creator_post_comments ADD CONSTRAINT creator_post_comments_actor_check CHECK ((user_id IS NOT NULL AND business_id IS NULL) OR (user_id IS NULL AND business_id IS NOT NULL)); END IF; END $$`;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_comment_reactions (
      comment_id BIGINT NOT NULL REFERENCES creator_post_comments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (comment_id, user_id)
    )
  `;
  await sql`ALTER TABLE creator_comment_reactions DROP CONSTRAINT IF EXISTS creator_comment_reactions_pkey`;
  await sql`ALTER TABLE creator_comment_reactions ALTER COLUMN user_id DROP NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_comment_reactions_user_unique ON creator_comment_reactions(comment_id, user_id) WHERE user_id IS NOT NULL`;
  await sql`ALTER TABLE creator_comment_reactions ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_comment_reactions_business_unique ON creator_comment_reactions(comment_id, business_id) WHERE business_id IS NOT NULL`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='creator_comment_reactions_actor_check' AND conrelid='creator_comment_reactions'::regclass) THEN ALTER TABLE creator_comment_reactions ADD CONSTRAINT creator_comment_reactions_actor_check CHECK ((user_id IS NOT NULL AND business_id IS NULL) OR (user_id IS NULL AND business_id IS NOT NULL)); END IF; END $$`;
  await sql`CREATE INDEX IF NOT EXISTS creator_comment_reactions_comment_idx ON creator_comment_reactions(comment_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_post_reposts (
      post_id BIGINT NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
  `;
  await sql`ALTER TABLE creator_post_reposts DROP CONSTRAINT IF EXISTS creator_post_reposts_pkey`;
  await sql`ALTER TABLE creator_post_reposts ALTER COLUMN user_id DROP NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_post_reposts_user_unique ON creator_post_reposts(post_id, user_id) WHERE user_id IS NOT NULL`;
  await sql`ALTER TABLE creator_post_reposts ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_post_reposts_business_unique ON creator_post_reposts(post_id, business_id) WHERE business_id IS NOT NULL`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='creator_post_reposts_actor_check' AND conrelid='creator_post_reposts'::regclass) THEN ALTER TABLE creator_post_reposts ADD CONSTRAINT creator_post_reposts_actor_check CHECK ((user_id IS NOT NULL AND business_id IS NULL) OR (user_id IS NULL AND business_id IS NOT NULL)); END IF; END $$`;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_post_bookmarks (
      post_id BIGINT NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
  `;
  await sql`ALTER TABLE creator_post_bookmarks DROP CONSTRAINT IF EXISTS creator_post_bookmarks_pkey`;
  await sql`ALTER TABLE creator_post_bookmarks ALTER COLUMN user_id DROP NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_post_bookmarks_user_unique ON creator_post_bookmarks(post_id, user_id) WHERE user_id IS NOT NULL`;
  await sql`ALTER TABLE creator_post_bookmarks ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_post_bookmarks_business_unique ON creator_post_bookmarks(post_id, business_id) WHERE business_id IS NOT NULL`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='creator_post_bookmarks_actor_check' AND conrelid='creator_post_bookmarks'::regclass) THEN ALTER TABLE creator_post_bookmarks ADD CONSTRAINT creator_post_bookmarks_actor_check CHECK ((user_id IS NOT NULL AND business_id IS NULL) OR (user_id IS NULL AND business_id IS NOT NULL)); END IF; END $$`;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_muted_users (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      muted_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, muted_user_id),
      CHECK (user_id <> muted_user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_business_follows (
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (business_id, creator_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS creator_business_muted_users (
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      muted_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (business_id, muted_user_id)
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
