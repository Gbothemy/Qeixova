# Qeixova — Earn by Doing

Qeixova is a Nigerian micro-task platform where users earn **QLT (Qeixova Loyalty Token)** points by completing simple online tasks — social media engagement, surveys, app testing, and content interactions. Points convert to Naira at a rate of **100 QLT = ₦1** and can be withdrawn to any Nigerian bank account.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | Neon (serverless Postgres) |
| Auth | JWT (httpOnly cookies) + bcryptjs |
| Styling | Inline styles (no Tailwind dependency) |
| Deployment | Vercel (auto-deploy from GitHub) |

---

## Production Readiness Notes

Before deploying to production, configure these environment variables in Vercel or your hosting provider:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Neon/Postgres connection string |
| `JWT_SECRET` | Yes | Signs contributor, business, and password-reset tokens |
| `ADMIN_SECRET` | Yes | Signs and validates the admin session cookie |
| `ADMIN_EMAIL` | Yes | Admin login email |
| `ADMIN_PASSWORD` | Yes | Admin login password |
| `SETUP_SECRET` | Yes | Protects `/api/setup` in production |
| `NEXT_PUBLIC_APP_URL` | Recommended | Absolute URL used in emails and redirects |
| `GMAIL_USER` | Optional | Gmail sender account |
| `GMAIL_APP_PASSWORD` | Optional | Gmail app password |
| `FLUTTERWAVE_SECRET_KEY` | Required for payments | Flutterwave server-side secret key (`FLWSECK...`) for wallet and Premium checkout |
| `FLUTTERWAVE_WEBHOOK_SECRET_HASH` | Recommended | Verifies Flutterwave webhook signatures |
| `FLUTTERWAVE_V3_API_BASE_URL` | Optional | Overrides the Flutterwave V3 API endpoint |

Use `.env.example` as the safe template. Never commit real `.env`, `.env.local`, or `.env.production` secrets.

### UI Maintenance Recommendation

The app currently uses inline styles across most screens. This is functional and build-safe, but future polish should extract repeated page shells, cards, buttons, form fields, and status badges into shared components. Some older files also contain mojibake artifacts from legacy encoded emoji/text. They do not block builds, but a dedicated copy/icon cleanup pass would improve consistency, accessibility, and long-term maintainability.

---

## Project Structure

```
tazksapp/
├── app/
│   ├── (marketing)/          # Public pages — no auth required
│   │   ├── page.tsx          # Landing page (/)
│   │   ├── login/            # User login
│   │   ├── register/         # User registration (referral code required)
│   │   ├── forgot-password/  # Password reset request
│   │   ├── reset-password/   # Password reset form
│   │   └── admin-login/      # Admin portal login
│   │
│   ├── (app)/                # Authenticated user app
│   │   ├── layout.tsx        # App shell with sidebar + bottom nav
│   │   ├── dashboard/        # Home dashboard
│   │   ├── tasks/            # Task browser
│   │   ├── wallet/           # Balance, withdraw, transactions
│   │   └── profile/          # User profile & settings
│   │
│   ├── (admin)/              # Admin portal (cookie-protected)
│   │   ├── layout.tsx        # Admin shell with responsive sidebar
│   │   ├── AdminSidebar.tsx  # Sidebar with mobile hamburger
│   │   ├── DataManagement.tsx# Danger zone data clear buttons
│   │   └── admin/
│   │       ├── page.tsx      # Dashboard stats
│   │       ├── users/        # User management
│   │       ├── tasks/        # Task management
│   │       ├── withdrawals/  # Withdrawal approvals
│   │       └── completions/  # Proof submissions
│   │
│   └── api/
│       ├── auth/             # login, register, logout, me, forgot/reset password
│       ├── tasks/            # GET tasks, POST complete
│       ├── wallet/           # GET wallet stats, POST withdraw
│       ├── profile/          # GET/PATCH profile
│       ├── bank-accounts/    # CRUD bank accounts
│       ├── notifications/    # GET/POST notification prefs
│       └── admin/            # Admin-only APIs (login, users, tasks, withdrawals, completions, clear-data)
│
├── components/
│   ├── BalanceCard.tsx       # Dashboard balance card with stats grid
│   ├── TaskCard.tsx          # Task list item with budget progress bar
│   ├── TaskModal.tsx         # Task detail sheet with proof upload
│   ├── BankAccountsModal.tsx # Add/manage bank accounts
│   ├── BottomNav.tsx         # Mobile bottom navigation
│   └── Sidebar.tsx           # Desktop left sidebar (user app)
│
└── lib/
    ├── db.ts                 # Neon SQL client
    ├── auth.ts               # JWT sign/verify, getSession
    ├── adminAuth.ts          # Admin cookie check
    ├── useAuth.ts            # Client-side auth hook
    └── verifyProof.ts        # Auto proof verification logic
```

---

## Database Schema

```sql
users               — accounts, balance (QLT), streak, level, referral_code, banned
tasks               — title, category, reward, steps[], proof_type, task_link, total_budget, budget_used
completions         — user_id, task_id, proof_value  (UNIQUE per user+task)
transactions        — user_id, type (credit/debit), amount, label, status
bank_accounts       — user_id, bank_name, account_number, account_name, is_default
notification_prefs  — user_id, prefs (JSONB)
password_resets     — user_id, token, expires_at
```

---

## Points System

| Action | QLT Earned |
|--------|-----------|
| Social Media task | 10,000 – 15,000 |
| Content task | 18,000 – 20,000 |
| Survey | 35,000 – 50,000 |
| App Testing | 80,000 – 120,000 |
| Referral bonus (referrer) | 5,000 |
| Welcome bonus (new user) | 2,000 |
| Minimum withdrawal | 100,000 QLT = ₦1,000 |
| Conversion rate | 100 QLT = ₦1 |

---

## User Features

- **Register** — requires a referral code from an existing member
- **Login / Logout** — JWT session, 7-day cookie
- **Forgot / Reset Password** — token-based reset flow
- **Dashboard** — live balance card (available QLT, cash value, today's earnings, tasks today, total accumulated, total withdrawn, total tasks)
- **Tasks** — browse by category, filter tabs, progress bar, budget indicator per task
- **Task Modal** — full instructions, numbered steps with clickable links, "Go to Task →" button, multi-screenshot upload, URL/text proof, auto-verification
- **Wallet** — QLT balance, live ₦ conversion preview, withdraw to saved bank account, full transaction history
- **Profile** — edit name/phone, change password, bank accounts (add/remove/set default), notification preferences, referral code copy, support contact, terms & privacy
- **Streak tracking** — daily login streak shown on dashboard and profile
- **Level progression** — Level 1–5 based on total tasks completed (5/15/30/50)

---

## Admin Portal

**URL:** `/admin-login`
**Credentials:** `admin@qeixova.com` / `Qeixova@Admin2025`

| Section | Features |
|---------|---------|
| Dashboard | Platform stats: users, QLT earned/withdrawn, pending withdrawals, completions, active tasks |
| Users | Search, paginated table, ban/unban |
| Tasks | Add/edit/deactivate tasks, set budget, task link, proof type, max screenshots |
| Withdrawals | Filter by status, approve (mark completed) / reject (refund QLT), full bank details shown |
| Completions | View all proof submissions, filter by proof type, clickable URL proofs |
| Data Management | Granular clear options with typed confirmation (completions, transactions, users, tasks, all) |

---

## Task Budget System

Admin can set a `total_budget` (QLT) per task. Once the total QLT paid out to users reaches that budget, the task auto-deactivates and disappears from the user task list. A progress bar on each task card shows how full the budget is.

---

## Proof Verification

| Proof Type | Auto-check |
|-----------|-----------|
| URL | Domain validation (must match expected platform) |
| Text | Non-empty, min 4 chars, rejects obvious fakes |
| Screenshot | Accepts upload, flags for spot-check |
| None | Auto-pass |

---

## Setup & Running

### 1. Install dependencies
```bash
cd tazksapp
npm install
```

### 2. Configure environment
Create `.env.local`:
```env
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
JWT_SECRET=your-secret-key
ADMIN_SECRET=qeixova-admin-2025
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run development server
```bash
npm run dev
```

### 4. Initialize database
Visit `http://localhost:3000/api/setup` once — creates all tables and seeds 9 tasks.

### 5. Access the app
| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Landing page |
| `http://localhost:3000/login` | User login |
| `http://localhost:3000/register` | User registration |
| `http://localhost:3000/dashboard` | User dashboard |
| `http://localhost:3000/admin-login` | Admin login |
| `http://localhost:3000/admin` | Admin dashboard |

---

## Deployment (Vercel)

1. Push to GitHub (`github.com/Gbothemy/tazksapp`)
2. Import repo on [vercel.com/new](https://vercel.com/new)
3. Add environment variables: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_SECRET`, `NEXT_PUBLIC_APP_URL`
4. Deploy — auto-deploys on every `git push` to `master`
5. Visit `https://your-app.vercel.app/api/setup` once to initialize the production DB

---

## Contact

- Email: qeixova@gmail.com
- Facebook: [facebook.com/profile.php?id=61568026449468](https://www.facebook.com/profile.php?id=61568026449468)
- Twitter/X: [@QeixovaTech](https://x.com/QeixovaTech)
