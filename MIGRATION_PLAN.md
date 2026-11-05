# RandTracker — Migration Plan: Supabase Cloud → Self-Hosted Supabase on Coolify (Hostinger VPS)

## 1. Why this is much simpler than raw Postgres

The original plan (raw PostgreSQL) required rebuilding the API layer and auth from scratch, because browsers can't talk to Postgres directly. **Self-hosted Supabase removes that entire problem**: you get the exact same stack you use today —

- **PostgREST** auto-API (your `supabase-js` browser queries keep working)
- **GoTrue** auth (email/password, OAuth, password reset emails)
- **RLS policies** keep being your security boundary
- **Dashboard** for admin

**Result: zero application-code rewrites.** The migration is infrastructure setup + data transfer + DNS/env cutover. The only code-adjacent work is regenerating API keys and updating environment variables.

### What you keep vs. what changes

| Component | Today | After | Change needed |
|---|---|---|---|
| Data access (`src/lib/supabase/data.ts`, stores) | supabase-js → PostgREST | Same | None |
| Auth (`AuthContext.tsx`, `/auth/callback`) | Supabase Auth | Self-hosted GoTrue | None (users must be migrated) |
| RLS security model | Policies in DB | Same policies | None |
| Database | Supabase cloud Postgres | Postgres container on VPS | pg_dump / restore |
| Hosting of app | Vercel | Vercel (recommended) or same VPS | Env vars only |
| Emails (verification/reset) | Supabase built-in | Must configure SMTP yourself | ⚠️ Required |

---

## 2. Target Architecture

```
┌──────────────┐  HTTPS   ┌──────────────── Hostinger VPS ────────────────┐
│  Next.js     │ ───────► │  Coolify (Docker management, TLS via Traefik) │
│  (Vercel or  │          │    ├─ supabase-kong (API gateway :8000)       │
│   same VPS)  │          │    ├─ supabase-auth (GoTrue)                  │
└──────────────┘          │    ├─ supabase-rest (PostgREST)               │
                          │    ├─ supabase-db  (Postgres 15/16)           │
                          │    ├─ supabase-studio (admin dashboard)       │
                          │    └─ imgproxy / storage / edge-runtime       │
                          └───────────────────────────────────────────────┘
```

**Recommended VPS sizing** (Supabase's full stack is ~10 containers): 4 vCPU / 8 GB RAM / 80 GB NVMe (Hostinger KVM 2 or KVM 4). 2 GB RAM VPSes will struggle.

---

## 3. Phased Migration Plan

### Phase 0 — Preparation & safety nets

- [ ] Full logical backup of the cloud project:
  ```bash
  pg_dump -h db.<project-ref>.supabase.co -U postgres -F c \
    -f randtracker_backup_$(date +%Y%m%d).dump postgres
  ```
- [ ] Export **auth users** separately (password hashes live in `auth.users`, not in a plain dump of public schema):
  ```bash
  # From Supabase Dashboard, or via SQL:
  # COPY (SELECT * FROM auth.users) TO ... — full table incl. encrypted_password
  ```
- [ ] Download/copy storage objects if any (you currently use none — verify).
- [ ] Note current settings: redirect URLs, SMTP config, OAuth provider keys.
- [ ] Verify no Supabase-specific extensions beyond standard ones are used (check `supabase/migrations/*.sql`).

### Phase 1 — Provision Hostinger VPS + Coolify

1. Order a Hostinger **KVM 2/4** VPS, Ubuntu 24.04 LTS.
2. Point a subdomain at it, e.g. `supabase.yourdomain.com` (A record → VPS IP).
3. Install Coolify (one command, as root):
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```
4. Complete Coolify setup wizard in the browser (`https://<vps-ip>:8000`), create your admin account, enable **instantly**:
   - SSH key-only login + disabled root password auth
   - UFW firewall: allow only 22, 80, 443 (Coolify manages its own proxy ports)
   - Automatic security updates

### Phase 2 — Deploy Supabase in Coolify

Coolify ships a maintained **Supabase service template** (one-click). Steps:

1. In Coolify: **+ New Resource → Docker Compose → search "Supabase"** → select the official template.
2. Before deploying, fill in the required environment variables. The critical ones are the JWT secret and derived API keys — see §4 for the generation script.
3. Set these in the template's env editor:

   | Variable | Value |
   |---|---|
   | `POSTGRES_PASSWORD` | strong random password |
   | `JWT_SECRET` | 64-char random string (script below) |
   | `ANON_KEY` | generated JWT (script below) |
   | `SERVICE_ROLE_KEY` | generated JWT (script below) |
   | `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` | your Studio login |
   | `SITE_URL` | `https://your-domain.com` (the RandTracker app URL) |
   | `API_EXTERNAL_URL` | `https://supabase.yourdomain.com` |
   | `ADDITIONAL_REDIRECT_URLS` | `https://your-domain.com/auth/callback/**` |
   | `SMTP_*` variables | your SMTP provider creds (see §5) |

4. Deploy. Coolify pulls all images, wires the internal network, and issues Let's Encrypt TLS via its Traefik proxy for `supabase.yourdomain.com`.
5. Verify: open Studio at `https://supabase.yourdomain.com`, log in with dashboard credentials.
6. **Lock down**: ensure only Kong (:8000 behind the proxy) is publicly reachable; Postgres, Studio internals etc. stay on the Docker network. If the template exposes extra ports, remove those mappings.

### Phase 3 — Restore schema & data into the new instance

```bash
# 1. Restore the full dump into the new Postgres container
docker exec -i <coolify-postgres-container> psql -U postgres \
  -c "CREATE DATABASE postgres;"   # usually already exists

pg_restore -h supabase.yourdomain.com -p 5432 -U postgres -d postgres \
  --no-owner --no-privileges randtracker_backup_YYYYMMDD.dump
```

Notes & gotchas:

- If direct port 5432 isn't exposed (good!), run `pg_restore` from inside the server piping through `docker exec -i … pg_restore`.
- The dump includes `auth.users` rows, so **user accounts come across with their password hashes** — unlike the raw-Postgres plan, nobody needs to reset passwords. ✅
- Re-create project-level settings that don't live in the dump:
  - [ ] Re-run any RLS policy statements if your dump tool skipped them (verify with `\d transactions` in Studio).
  - [ ] Recreate the auth signup trigger hook (from `002_fix_auth_signup_trigger.sql`) if not present.
  - [ ] Re-add extensions if flagged: `pgcrypto` etc.
- Sanity checks in Studio: row counts per table match the old project; test user can log in; RLS blocks cross-user access.

### Phase 4 — Cutover the application

1. Generate new API keys (anon/service_role) — done in Phase 2; copy them.
2. Update environment variables wherever the app runs:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://supabase.yourdomain.com
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<new-anon-key>
   ```
   (If any server-side code uses the service role key, update it too.)
3. Update Supabase auth config (in Studio → Auth): Site URL, redirect URLs (`/auth/callback`, `/dashboard`), email templates.
4. Downtime window (~minutes): enable maintenance banner → final incremental `pg_dump`/restore → flip env vars → redeploy → smoke test → disable maintenance.
5. Keep the old Supabase cloud project **paused (not deleted)** for 30 days as a rollback path.

### Phase 5 — Decommission & harden ongoing ops

- [ ] After 2+ stable weeks: final backup archived off-site; delete cloud project.
- [ ] Remove unused Supabase services from the stack if you don't need them (e.g., edge-runtime, storage) to reduce memory footprint — optional, do it via the compose template.

---

## 4. Script: generate JWT secret + API keys

Self-hosted Supabase requires you to mint your own `ANON_KEY` and `SERVICE_ROLE_KEY` as HS256 JWTs signed with your `JWT_SECRET`. Run this once, before deploying:

**Step 1 — generate the secret:**
```bash
openssl rand -hex 32   # → use output as JWT_SECRET
```

**Step 2 — generate the keys** (Node.js, no extra deps beyond `jsonwebtoken`):

```js
// save as generate-keys.mjs — run: npm i jsonwebtoken && node generate-keys.mjs
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET; // paste the openssl output here

if (!JWT_SECRET) {
  console.error('Set JWT_SECRET env var first');
  process.exit(1);
}

const claims = {
  role: 'anon',        // will be overridden below
  iss: 'supabase',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60, // 10 years
};

const anonKey = jwt.sign({ ...claims, role: 'anon' }, JWT_SECRET, { algorithm: 'HS256' });
const serviceRoleKey = jwt.sign({ ...claims, role: 'service_role' }, JWT_SECRET, { algorithm: 'HS256' });

console.log('JWT_SECRET=' + JWT_SECRET);
console.log('ANON_KEY=' + anonKey);
console.log('SERVICE_ROLE_KEY=' + serviceRoleKey);
```

Or, without Node, using the Supabase CLI convention (any HS256 signer works — Python, openssl+bash, etc.). Paste the three outputs into the Coolify template env vars from Phase 2.

> ⚠️ Treat `SERVICE_ROLE_KEY` like a root password — it bypasses RLS. It must never appear in client-side code or git.

## 5. SMTP configuration (required!)

Cloud Supabase sends auth emails for you; self-hosted does **not** until you configure SMTP, otherwise signups/password resets silently fail. Use Resend, Postmark, Mailgun, or Brevo (free tiers fine for a personal app):

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<your-smtp-password>
SMTP_SENDER_NAME=RandTracker
SMTP_ADMIN_EMAIL=noreply@yourdomain.com
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false   # keep email verification
```

Also update the default email templates (Studio → Auth → Templates) to point links at `https://your-domain.com/auth/callback`.

---

## 6. Security Considerations

### VPS hardening

- [ ] SSH keys only, root password login disabled, fail2ban.
- [ ] UFW: allow 22/80/443 only. **Never expose Postgres (5432) or Studio internals publicly** — everything except Kong goes through the Docker network.
- [ ] Unattended security upgrades enabled.
- [ ] Coolify admin panel protected by strong credentials (+ ideally IP allowlist or VPN/Tailscale).
- [ ] TLS everywhere via Coolify's Traefik proxy (automatic Let's Encrypt); enable HSTS.

### Supabase-specific

- [ ] Fresh `JWT_SECRET` (never reuse the well-known demo secret from Supabase's docker examples!).
- [ ] Anon key is public by design — RLS remains your boundary; **audit every table has RLS enabled** before cutover (your `RLS_FIX.md` suggests past issues — re-verify policies 001–008 applied cleanly).
- [ ] Service role key only in server-side env vars, rotated if ever leaked (rotation = regenerate JWTs + restart stack).
- [ ] Rate limiting: put Cloudflare (free) in front of `supabase.yourdomain.com` and the app for DDoS/bot protection and caching — cheap win on a single VPS.
- [ ] Backups: Coolify has built-in scheduled backups for service databases — configure **daily Postgres dumps to S3-compatible storage** (Backblaze B3) plus a weekly manual restore drill. This replaces Supabase PITR.
- [ ] Monitoring: Coolify resource metrics + uptime monitoring (Uptime Kuma, also deployable in Coolify) alerting on `https://supabase.yourdomain.com/rest/v1/` health.

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Single VPS = single point of failure | Downtime/data loss | Daily off-site backups + tested restore; documented rebuild runbook (fresh VPS → install Coolify → restore backup ≈ 1–2 h recovery) |
| Missed RLS policy during restore | Cross-user data leak | Row-count + policy audit checklist in Phase 3; two-user integration test |
| SMTP misconfigured | Users can't sign up / reset passwords | Test full signup + reset flow on staging **before** cutover |
| Memory pressure on small VPS | OOM kills, slow queries | Size ≥ 8 GB RAM; trim unused Supabase services |
| Version drift between cloud & self-hosted Supabase | Subtle behavior differences | Pin image versions in the Coolify template; check release notes when upgrading |
| Old project deleted too early | No rollback | Keep cloud project paused ≥ 30 days |

## 8. Effort Estimate

| Phase | Duration |
|---|---|
| 0 — Prep & backups | 0.5 day |
| 1 — VPS + Coolify | 0.5 day |
| 2 — Supabase deployment | 0.5–1 day (incl. key generation, SMTP) |
| 3 — Schema/data restore + verification | 1 day |
| 4 — App cutover | 0.5 day |
| 5 — Hardening, backups, monitoring | 1 day |

**Total: roughly 3–5 days** — versus 5–7 weeks for the raw-Postgres route, because no application code changes.

## 9. Open Decisions

1. App hosting: stay on Vercel (recommended — zero change) or also move the Next.js app into Coolify on the same VPS?
2. Which SMTP provider for auth emails?
3. Put Cloudflare in front, or expose the VPS directly?
