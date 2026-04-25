# RandTracker Quick Start

## 1. Install

```bash
cd rand_tracker
npm install
```

## 2. Configure Supabase

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Apply the SQL files in `supabase/migrations/` to your Supabase project.

## 3. Run the App

```bash
npm run dev
```

Open `http://localhost:3000`.

## 4. Sign In

- Open `/auth/login`
- Sign in with email/password or Google
- You’ll be redirected to `/dashboard`

## Available Pages

- `/dashboard`
- `/dashboard/accounts`
- `/dashboard/transactions`
- `/dashboard/budgets`
- `/dashboard/analytics`
- `/dashboard/settings`

## Notes

- The app no longer uses Dexie or IndexedDB for app data.
- Dashboard access now requires authentication.
- Supabase is the source of truth for user profiles, accounts, categories, and transactions.
