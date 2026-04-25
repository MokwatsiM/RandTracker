# RandTracker

RandTracker is a personal finance app for South Africans. It helps you track accounts and transactions in ZAR with Supabase-backed authentication and data storage.

## Features

- Fast account and transaction management
- South African category presets
- ZAR-first money formatting
- Supabase auth and database persistence
- Responsive dashboard for desktop and mobile

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Zustand
- Supabase
- Recharts
- dinero.js

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Supabase project

### Environment Variables

Create a `.env.local` file with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database Setup

Run the SQL migrations in `supabase/migrations/` against your Supabase project:

- `001_initial_schema.sql`
- `002_fix_auth_signup_trigger.sql`

These create the app tables, RLS policies, and signup profile trigger.

## Project Structure

```text
src/
├── app/
├── components/
├── contexts/
├── lib/
│   ├── calculations/
│   ├── currency.ts
│   ├── db/
│   └── supabase/
├── stores/
└── ...
supabase/
└── migrations/
```

## Current App Model

- App data is stored in Supabase, not IndexedDB/local storage.
- Users must sign in to use the dashboard.
- Supabase auth session persistence is handled by `@supabase/ssr`.

## Useful Commands

```bash
npm run dev
npm run build
npm start
```

## Notes

- See [QUICKSTART.md](./QUICKSTART.md) for a shorter setup flow.
- See [RandTracker-Project-Plan.md](./RandTracker-Project-Plan.md) for the broader roadmap.
