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

## Self-hosted deployment

Runs at https://randtracker.mokwatsi.tech on the Hostinger VPS, in `/opt/randtracker/deploy` beside Coolify and the LGE stack. It's a plain Docker Compose project, so it doesn't appear in Coolify's dashboard. No ports are public: a Cloudflare Tunnel sends `randtracker.mokwatsi.tech` to `app:3000` and `randtracker-api.mokwatsi.tech` to `gateway:8000`, and the routes live in the tunnel's config in Cloudflare.

Supabase is cut down to Postgres, Auth, PostgREST and an nginx gateway, because the server has 1 vCPU and 3.8 GB of RAM. The app doesn't use Storage, Realtime or Functions.

Pushing to `dev` builds an image in GitHub Actions. The server pulls it, applies any new files in `supabase/migrations`, restarts the app and goes back to the previous image if the health check fails. Changes to other services in the compose file need a manual `up -d` on the server.

First-time setup, which is safe to re-run:

```bash
scripts/setup-server.sh root@your-server
```

```bash
scripts/install-deploy-key.sh root@your-server
```

Secrets are in `/opt/randtracker/deploy/.env` on the server and never in git. Compose commands there need `--env-file .env --env-file images.env -f docker-compose.yml`. Backups are manual:

```bash
scripts/backup-from-vps.sh root@your-server
```

### Email

No SMTP is configured yet, so new accounts are confirmed automatically and password reset emails can't be sent. To turn email on, add these to `.env` on the server, then run `up -d auth`:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-password
SMTP_ADMIN_EMAIL=noreply@mokwatsi.tech
ENABLE_EMAIL_AUTOCONFIRM=false
```

### Database admin

Supabase Studio is off by default to save memory. Start it on the server with `--profile admin up -d studio`, then open a tunnel and go to http://localhost:13210. Stop it afterwards with `--profile admin stop studio meta`.

```bash
ssh -N -L 13210:localhost:13210 root@your-server
```
