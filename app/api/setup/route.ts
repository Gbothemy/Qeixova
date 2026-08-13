import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureEmailVerificationSchema } from "@/lib/emailVerification";
import { ensurePasswordResetSchema } from "@/lib/passwordReset";
import { ensureUniversalCampaignTables } from "@/lib/universalCampaignEngine";
import { ensureContributorNotificationsTable } from "@/lib/contributorNotifications";
import { ensureMissionExpiryColumns } from "@/lib/missionExpiry";
import { ensureMilestoneIntegrity } from "@/lib/missionEngine";

function setupAllowed(req: Request) {
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(process.env.SETUP_SECRET) && req.headers.get("x-setup-key") === process.env.SETUP_SECRET;
}

export async function GET(req: Request) {
  if (!setupAllowed(req)) {
    return NextResponse.json({ error: "Setup is not enabled" }, { status: 403 });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        email         TEXT UNIQUE NOT NULL,
        phone         TEXT,
        full_name     TEXT NOT NULL,
        password      TEXT NOT NULL,
        referral_code TEXT UNIQUE,
        referred_by   INT REFERENCES users(id),
        balance       INTEGER NOT NULL DEFAULT 0,
        streak        INTEGER NOT NULL DEFAULT 0,
        last_active   DATE,
        level         INTEGER NOT NULL DEFAULT 1,
        email_verified BOOLEAN NOT NULL DEFAULT TRUE,
        email_verified_at TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id           SERIAL PRIMARY KEY,
        title        TEXT NOT NULL,
        category     TEXT NOT NULL,
        reward       INTEGER NOT NULL,
        duration     TEXT NOT NULL,
        icon         TEXT NOT NULL,
        color        TEXT NOT NULL,
        instructions TEXT NOT NULL DEFAULT '',
        steps        TEXT[] NOT NULL DEFAULT '{}',
        proof_type   TEXT NOT NULL DEFAULT 'screenshot'
          CHECK (proof_type IN ('screenshot','url','text','none')),
        proof_label  TEXT NOT NULL DEFAULT 'Upload screenshot as proof',
        is_active    BOOLEAN DEFAULT TRUE,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS completions (
        id           SERIAL PRIMARY KEY,
        user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_id      INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        proof_value  TEXT,
        completed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    /* Ensure permanent unique constraint — one completion per task per user ever */
    await sql`DROP INDEX IF EXISTS completions_user_task_day_idx`;
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'completions_user_id_task_id_key'
        ) THEN
          ALTER TABLE completions ADD CONSTRAINT completions_user_id_task_id_key UNIQUE (user_id, task_id);
        END IF;
      END $$
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id         SERIAL PRIMARY KEY,
        user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       TEXT NOT NULL CHECK (type IN ('credit','debit')),
        amount     INTEGER NOT NULL,
        label      TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'completed'
          CHECK (status IN ('completed','pending','failed')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    /* ── Add new columns to existing tasks table if upgrading ── */
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS instructions TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS steps TEXT[] NOT NULL DEFAULT '{}'`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS proof_type TEXT NOT NULL DEFAULT 'screenshot'`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS proof_label TEXT NOT NULL DEFAULT 'Upload screenshot as proof'`;
    await sql`ALTER TABLE completions ADD COLUMN IF NOT EXISTS proof_value TEXT`;
    await sql`ALTER TABLE completions ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1`;
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'completions_attempt_count_check') THEN
          ALTER TABLE completions
          ADD CONSTRAINT completions_attempt_count_check CHECK (attempt_count BETWEEN 1 AND 2);
        END IF;
      END $$
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS community_posts (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        topic TEXT NOT NULL DEFAULT 'General',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS community_post_comments (
        id SERIAL PRIMARY KEY,
        post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS community_post_reactions (
        post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (post_id, user_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS community_posts_created_idx ON community_posts(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS community_comments_post_idx ON community_post_comments(post_id, created_at)`;
    await sql`ALTER TABLE completions ADD COLUMN IF NOT EXISTS reward_released_at TIMESTAMPTZ`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS max_screenshots INT NOT NULL DEFAULT 1`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_budget INT NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS budget_used INT NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_link TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS campaign_status TEXT NOT NULL DEFAULT 'pending_review'`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS campaign_goal TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS campaign_pricing JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS campaign_metadata JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Nigeria'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_earned_qlt BIGINT NOT NULL DEFAULT 0`;
    await ensureMissionExpiryColumns();
    await ensureUniversalCampaignTables();
    await ensureMilestoneIntegrity();
    await ensureEmailVerificationSchema();
    await ensurePasswordResetSchema();
    await ensureContributorNotificationsTable();

    await sql`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id             SERIAL PRIMARY KEY,
        user_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_name      TEXT NOT NULL,
        account_number TEXT NOT NULL,
        account_name   TEXT NOT NULL,
        is_default     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, account_number)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS notification_prefs (
        user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        prefs   JSONB NOT NULL DEFAULT '{}'
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS password_resets (
        user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        task_alerts BOOLEAN NOT NULL DEFAULT TRUE,
        reward_updates BOOLEAN NOT NULL DEFAULT TRUE,
        referral_alerts BOOLEAN NOT NULL DEFAULT TRUE,
        weekly_summary BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    /* ── Seed / re-seed tasks ── */
    await sql`DELETE FROM tasks`;

    await sql`
      INSERT INTO tasks
        (title, category, reward, duration, icon, color, instructions, steps, proof_type, proof_label, max_screenshots)
      VALUES
      (
        'Follow 3 Instagram accounts',
        'Social Media', 15000, '2 min', '📸', '#e8f5e9',
        'Help grow Instagram communities by following three specified accounts. Make sure you are logged into your Instagram account before starting.',
        ARRAY[
          'Open Instagram and log into your account',
          'Search for and follow: @qeixova_official',
          'Search for and follow: @earnwithqeixova',
          'Search for and follow: @qeixova_nigeria',
          'Take a screenshot showing all 3 accounts followed'
        ],
        'screenshot',
        'Upload screenshots showing all 3 accounts followed',
        3
      ),
      (
        'Like & share a Facebook post',
        'Social Media', 10000, '1 min', '👍', '#e8f5e9',
        'Boost engagement on a Facebook post by liking and sharing it to your timeline. Your account must be at least 30 days old.',
        ARRAY[
          'Open Facebook and log into your account',
          'Visit the post link: facebook.com/profile.php?id=61568026449468',
          'Click the Like button on the post',
          'Click Share and share to your own timeline',
          'Take a screenshot showing the post liked and shared'
        ],
        'screenshot',
        'Upload a screenshot showing the liked and shared post',
        1
      ),
      (
        'Retweet 2 posts on X',
        'Social Media', 12000, '1 min', '🐦', '#e8f5e9',
        'Increase reach of posts on X (formerly Twitter) by retweeting two specified posts from your account.',
        ARRAY[
          'Log into your X (Twitter) account',
          'Find and retweet the first post: x.com/QeixovaTech',
          'Find and retweet the second post: x.com/QeixovaTech',
          'Take a screenshot of each retweet'
        ],
        'screenshot',
        'Upload 2 screenshots showing each retweet',
        2
      ),
      (
        'Watch a YouTube video (60s)',
        'Content', 20000, '1 min', '▶️', '#fdf8e1',
        'Watch a YouTube video for at least 60 seconds to boost its watch time. Do not skip or fast-forward.',
        ARRAY[
          'Click this link to open the video: youtube.com/watch?v=qeixova_demo',
          'Watch the video for at least 60 seconds without skipping',
          'Like the video after watching',
          'Paste the video URL below as proof'
        ],
        'url',
        'Paste the YouTube video URL you watched',
        1
      ),
      (
        'Comment on a TikTok video',
        'Content', 18000, '2 min', '🎬', '#fdf8e1',
        'Leave a meaningful comment (at least 10 words) on a TikTok video. Generic or spam comments will be rejected.',
        ARRAY[
          'Open TikTok and log into your account',
          'Find the video: tiktok.com/@qeixova/video/latest',
          'Write a genuine comment of at least 10 words about the video content',
          'Post the comment',
          'Take a screenshot showing your comment posted'
        ],
        'screenshot',
        'Upload a screenshot showing your comment on the TikTok video',
        1
      ),
      (
        'Complete product survey',
        'Survey', 50000, '5 min', '📋', '#fdf8e1',
        'Share your honest opinion about a product in this short survey. All questions are required. Your responses help brands improve their products.',
        ARRAY[
          'Click the survey link: forms.qeixova.com/survey/product-001',
          'Answer all questions honestly — takes about 5 minutes',
          'Submit the survey form',
          'Copy the confirmation code shown after submission',
          'Paste the confirmation code below'
        ],
        'text',
        'Paste your survey confirmation code here',
        1
      ),
      (
        'Fill lifestyle questionnaire',
        'Survey', 35000, '4 min', '📝', '#fdf8e1',
        'Complete a lifestyle questionnaire about your daily habits, preferences and interests. Your data is anonymised and used for market research.',
        ARRAY[
          'Open the questionnaire: forms.qeixova.com/survey/lifestyle-002',
          'Fill in all sections — takes about 4 minutes',
          'Submit the form',
          'Note the submission ID shown on the confirmation page',
          'Enter the submission ID below'
        ],
        'text',
        'Enter your questionnaire submission ID',
        1
      ),
      (
        'Test FoodApp & rate it',
        'App Testing', 120000, '10 min', '🧪', '#e8f5e9',
        'Download and test FoodApp, a new food delivery app. Explore the main features, place a test order (no payment required), and leave an honest rating on the app store.',
        ARRAY[
          'Download FoodApp from the Play Store or App Store',
          'Create a free account using any email',
          'Browse at least 3 restaurant menus',
          'Add items to cart and go through the checkout flow (no payment needed)',
          'Rate the app 4-5 stars on the store and write a short review',
          'Take a screenshot of your published review and the app home screen'
        ],
        'screenshot',
        'Upload 2 screenshots: app home screen + your published review',
        2
      ),
      (
        'Review a mobile game',
        'App Testing', 80000, '8 min', '🎮', '#e8f5e9',
        'Play a mobile game for at least 5 minutes and leave a detailed review on the app store. Your review must be at least 30 words to qualify.',
        ARRAY[
          'Download PuzzleKing from the Play Store or App Store',
          'Play the game for at least 5 minutes',
          'Go to the app store listing for PuzzleKing',
          'Write a review of at least 30 words describing your experience',
          'Submit the review',
          'Take a screenshot of your published review'
        ],
        'screenshot',
        'Upload a screenshot of your published game review',
        1
      )
    `;
    return NextResponse.json({ ok: true, message: "Database setup complete — tasks seeded with instructions" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
