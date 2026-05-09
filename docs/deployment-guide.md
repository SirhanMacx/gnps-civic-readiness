# Deployment guide

This walks an engineer from a clean clone to a working production URL on **district-owned or district-approved infrastructure**. ~30–60 minutes once the prerequisites (Linux host, DNS, SMTP) are in place.

> **Recommended production path:** the self-hosted Docker Compose stack described below, on infrastructure your district owns or has formally approved.
>
> **Infinite Campus remains the system of record.** This portal is a workflow and evidence-tracking layer.
>
> Demo-live, pilot-live, and production-live are different things. Technically deployable does not mean institutionally approved. See [`docs/go-live-checklist.md`](go-live-checklist.md) for the readiness distinction before any district uses this with real student data.

## Architecture summary

The self-hosted stack ships in this repository:

- **Postgres 16** — single relational store
- **Migration runner** — applies `supabase/migrations/*.sql` idempotently on each `make up`
- **SvelteKit app on Node 22** — application server
- **Caddy** — reverse proxy with automatic Let's Encrypt SSL
- **District SMTP** — outbound transactional email (supervisor confirmations, magic-link sign-in, progress reports)
- **Filesystem (default) or S3-compatible** evidence storage

Everything inside the Docker network is private. Only Caddy is on the public interface.

## Prerequisites

### Server
- Linux host (Ubuntu 22.04 LTS / Debian 12 / Rocky 9 — district preference)
- 2+ vCPU, 4+ GB RAM, 50+ GB disk
- Public IPv4 reachable on TCP 80 and 443
- Docker Engine 24+ and Docker Compose v2

### DNS
- An A record (and optional AAAA) for the chosen subdomain (e.g. `civicseal.your-district.k12.ny.us`) pointing at the server's public IP. Caddy uses HTTP-01 ACME, so the record must be live before first deploy.

### SMTP
- District SMTP host, port (usually 587 with STARTTLS, sometimes 465 with implicit TLS), and credentials authorized to send from the chosen `EMAIL_FROM` address.

### Tooling on your laptop
- `git`, `ssh`, and an editor.

## Step 1 · Clone and configure

```bash
ssh you@your-host
git clone https://github.com/<owner>/gnps-civic-readiness
cd gnps-civic-readiness
cp .env.example .env
chmod 600 .env
```

Edit `.env`. The required values are:

| Variable | Notes |
|---|---|
| `CIVICSEAL_DOMAIN` | Must match the DNS A record |
| `POSTGRES_PASSWORD` | 32+ chars · `openssl rand -base64 32` |
| `SESSION_SECRET` | 32+ chars · `openssl rand -hex 32` |
| `SIGNED_LINK_SECRET` | 32+ chars · `openssl rand -hex 32` (different from `SESSION_SECRET`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | From your mail admin |
| `EMAIL_FROM` | An address the SMTP relay is authorized to send from |
| `PGSSL` | `false` (default) for the internal Docker Postgres; `true` only if you point `DATABASE_URL` at a managed Postgres that requires TLS |

Production refuses to boot if `SESSION_SECRET` or `SIGNED_LINK_SECRET` is missing or under 32 characters.

## Step 2 · First boot

```bash
make up
```

This builds the app image, starts Postgres, runs the migration container, starts the app, and starts Caddy. Caddy obtains a Let's Encrypt cert on first try (~30–60 sec).

Tail logs while it warms up:

```bash
make logs
```

## Step 3 · Smoke tests

Two endpoints expose health:

```bash
curl https://${CIVICSEAL_DOMAIN}/health   # app liveness — 200 if the Node process is up
curl https://${CIVICSEAL_DOMAIN}/ready    # database readiness — 200 if the DB is reachable
```

Both should return JSON. `/ready` returns 503 if the DB is unavailable.

## Step 4 · Bootstrap the first admin

```bash
make admin EMAIL=you@your-district.k12.ny.us
```

Then visit `https://${CIVICSEAL_DOMAIN}/login`, enter that email, and sign in via the magic link. From there, invite the rest of the staff (counselors, SCRC committee members, teachers, admins) at `/admin/users`.

## Step 5 · Walk the golden paths

1. Anonymous visitor hits `/` → branded landing page
2. Visitor hits `/about` → full pathway breakdown
3. Admin logs in via magic link → lands on `/admin`
4. Admin visits `/admin/import` → uploads `docs/sample-ic-data.csv` → preview → commit → roster shows auto-counted Knowledge points
5. Anonymous visitor hits `/submit/service` → fills the form → submits → success banner

## Operations

The full operational runbook (logs, backups, restore, updates, rollback, security checklist, troubleshooting) lives in [`docs/it-runbook.md`](it-runbook.md).

## Phase 2 (deferred until IT review)

- Live Infinite Campus integration (OneRoster API or nightly SFTP-export)
- District SSO (ClassLink / Google Workspace / Azure AD)
- Student-facing portal with live progress
- Family-visible read-only progress view
- Transcript write-back

These require district IT involvement and are scoped in the [IT-handoff brief](../dist/GNPS-IT-Handoff-Brief.pdf).

---

## Demo / prototype deployments

The live demo at `gnps-civic-readiness.vercel.app` runs on Vercel + Supabase + Resend. Those were useful **prototype/demo choices** — fast to stand up for evaluators — but they are **not required vendors** and not the recommended production architecture.

If your district policy permits a non-production demo against managed services, the historical Phase 1 design (Vercel + Supabase + Resend) is documented in `docs/superpowers/specs/` and `docs/superpowers/plans/`. **Do not put real student data into an unapproved demo or prototype environment.** For any pilot or production use, follow the self-hosted procedure above (or a district-approved equivalent) and the [`docs/go-live-checklist.md`](go-live-checklist.md).
