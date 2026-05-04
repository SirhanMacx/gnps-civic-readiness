# Deployment guide

This walks a district from a clean fork to a working production URL. ~30–60 minutes if you have all the prerequisites in place.

## Prerequisites

- Node 22+ (Phase 1 requires Node 22 or later because of native WebSocket support in supabase-js)
- pnpm 9+
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- [Vercel CLI](https://vercel.com/docs/cli)
- Git
- A GitHub account (Supabase and Vercel both support GitHub-based signin)

## Step 1 · Fork or clone

```bash
git clone https://github.com/<owner>/gnps-civic-readiness
cd gnps-civic-readiness
pnpm install
```

## Step 2 · Create a Supabase project

```bash
supabase login    # browser-based auth, takes ~30 sec
supabase projects create <your-district>-civic-readiness \
  --org-id <your-org-id> \
  --db-password '<strong-password>' \
  --region us-east-1   # or whatever's closest to your district
```

Take note of the project ref printed by the CLI; you'll need it.

## Step 3 · Link locally and push migrations

```bash
SUPABASE_DB_PASSWORD='<strong-password>' \
  supabase link --project-ref <ref>

SUPABASE_DB_PASSWORD='<strong-password>' \
  supabase db push --include-all
```

Migrations 0001–0006 will apply (~30 seconds). Verify in the Supabase dashboard that the `students`, `pathway_submissions`, `hours_log`, `audit_log`, `users`, `course_catalog`, `course_enrollment`, `regents_scores`, `evidence_files` tables exist.

Get your API keys:

```bash
supabase projects api-keys --project-ref <ref>
```

Save the `anon` and `service_role` keys — you'll set them as Vercel env vars next.

## Step 4 · Create a Vercel project

```bash
vercel login
cd apps/web
vercel link --yes --project <your-district>-civic-readiness
```

Vercel auto-detects SvelteKit.

## Step 5 · Set environment variables

```bash
echo 'https://<ref>.supabase.co' | vercel env add PUBLIC_SUPABASE_URL production
echo '<anon-key>'                | vercel env add PUBLIC_SUPABASE_ANON_KEY production
echo '<service-role-key>'        | vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Optional — Phase 1 works without these (supervisor emails skip gracefully)
echo 'https://your-domain.example.com' | vercel env add PUBLIC_APP_URL production
echo '<32-char-random-string>'         | vercel env add SIGNED_LINK_SECRET production
echo 're_<your-resend-key>'            | vercel env add RESEND_API_KEY production
echo 'GNPS Civic Readiness <civicseal-gnps@resend.dev>' | vercel env add EMAIL_FROM production
```

You can also set these in the Vercel dashboard (Settings → Environment Variables) if you prefer a web UI.

## Step 6 · Deploy

```bash
vercel deploy --prod
```

The CLI prints a production URL like `https://<your-district>-civic-readiness.vercel.app`.

## Step 7 · (Optional) Custom subdomain

Point `civicseal.your-district.k12.ny.us` at the Vercel deployment via DNS CNAME. Add the custom domain in Vercel's dashboard (Settings → Domains). Vercel handles SSL automatically.

## Step 8 · Smoke test

1. Visit your URL — landing page should load with your district's brand
2. Click **Submit Evidence** → **Service-Learning Hours**
3. Fill the form with a test student. Submit.
4. Open the [Supabase Studio](https://supabase.com/dashboard) → Table Editor — confirm rows landed in `students`, `pathway_submissions`, `hours_log`, and `audit_log`

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Form returns 500 with "Node.js 20 detected without native WebSocket support" | Vercel adapter is set to `nodejs20.x`; bump to `nodejs22.x` in `apps/web/svelte.config.js` |
| Form returns 403 | SvelteKit CSRF check; this only happens for non-browser POSTs (curl). Browsers work fine because the Origin header matches the host |
| "Save failed: …" with a Supabase error | Schema mismatch or RLS issue. Re-run `supabase db push` and verify the service-role key is set correctly |
| Empty response on landing page | Tailwind not built; rerun `pnpm install && pnpm --filter ./apps/web build` |

## Phase 2 (deferred)

- District SSO (ClassLink / Google Workspace / Azure AD via Supabase Auth providers)
- Live Infinite Campus integration (OneRoster API or SFTP-delivered nightly export)
- Student portal with live progress
- Family-visible read-only progress view
- Custom domain on district infrastructure (CNAME, iframe embed in Finalsite, or reverse-proxy options — see [§10 of the design doc](../dist/GNPS-Civic-Readiness-Portal-Design.pdf))

These require district IT involvement and are scoped in the [IT-handoff brief](../dist/GNPS-IT-Handoff-Brief.pdf).
