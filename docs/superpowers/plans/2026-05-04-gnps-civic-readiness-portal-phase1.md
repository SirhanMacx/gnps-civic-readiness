# GNPS Civic Readiness Portal — Phase 1 Implementation Plan

> **Archived prototype implementation plan.** This plan preserves the original build sequence and may mention prototype vendors/services. It is not the current production recommendation. For current meeting and IT guidance, use `docs/meeting-brief.md`, `docs/go-live-checklist.md`, `docs/deployment-guide.md`, and `docs/it-handoff-brief.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Apply @superpowers:test-driven-development discipline throughout.

**Goal:** Ship the four-week Phase 1 of the GNPS Civic Readiness Portal — public submission flows for all six pathway types, two-tier verification (supervisor email + counselor approval + SCRC project review), GNPS-themed admin roster with CSV-imported IC data, and NYSED audit-pack export. Demo-able on a public Vercel URL by end of week 4 at $0/mo.

**Architecture:** SvelteKit (frontend, server endpoints, Vercel adapter) + Supabase (Postgres, Storage, Auth) + Resend (transactional email). Magic-link auth for staff; no student auth in Phase 1. Pathway eligibility math is a pure-TS package (`packages/pathway-rules`) imported by both UI and server. NYSED export is a separate package (`packages/nysed-export`) that produces per-student PDFs + roster CSV. Brand tokens live in `apps/web/src/lib/theme/` so peer districts can fork by editing one config file.

**Tech Stack:** SvelteKit 2.x · TypeScript (strict) · Vitest · Playwright · Supabase CLI 1.x · @supabase/supabase-js · Resend SDK · Zod (input validation) · pdf-lib (PDF generation) · Tailwind CSS (constrained to GNPS tokens) · pnpm workspaces.

---

## Reference

- **Spec:** `docs/superpowers/specs/2026-05-04-gnps-civic-readiness-portal-design.md` (single source of truth — when this plan and spec disagree, spec wins)
- **NYSED handbook:** see spec §6 + appendices for verbatim rule text and rubric citations

---

## File structure

Each file has one clear responsibility. Files that change together live together.

```
gnps_seal_civic_readiness/
├── package.json                          ← root workspace config (pnpm)
├── pnpm-workspace.yaml                   ← workspace member glob
├── tsconfig.base.json                    ← shared TS config
├── .env.example                          ← env var contract (no secrets)
├── .gitignore                            ← node_modules, .env, .superpowers, build/, coverage/
│
├── apps/web/                             ← SvelteKit application
│   ├── package.json
│   ├── svelte.config.js                  ← @sveltejs/adapter-vercel
│   ├── vite.config.ts                    ← test config (Vitest); aliases
│   ├── playwright.config.ts              ← E2E config
│   ├── tailwind.config.ts                ← restricted to GNPS tokens
│   ├── src/
│   │   ├── app.html                      ← Outfit + Roboto + Literata Google Fonts
│   │   ├── app.css                       ← @tailwind directives, base styles
│   │   ├── hooks.server.ts               ← Supabase server client per request; audit-log helper
│   │   ├── lib/
│   │   │   ├── theme/tokens.ts           ← navy/coral, fonts, spacing scale
│   │   │   ├── theme/Logo.svelte         ← GNPS round logo
│   │   │   ├── theme/AppShell.svelte     ← top nav + footer
│   │   │   ├── server/supabase.ts        ← admin client (service role)
│   │   │   ├── server/audit.ts           ← writeAudit(actor, action, target, data)
│   │   │   ├── server/email.ts           ← Resend wrapper + signed-link helpers
│   │   │   └── components/               ← form fields, buttons, tables (typed)
│   │   └── routes/
│   │       ├── +layout.svelte            ← AppShell wrapper
│   │       ├── +layout.server.ts         ← role detection from session
│   │       ├── +page.svelte              ← public landing
│   │       ├── submit/+page.svelte       ← pathway picker
│   │       ├── submit/service/+page.svelte
│   │       ├── submit/wbl/+page.svelte
│   │       ├── submit/civic-project/+page.svelte
│   │       ├── submit/research/+page.svelte
│   │       ├── submit/capstone/+page.svelte
│   │       ├── submit/civic-elective/+page.svelte
│   │       ├── submit/+page.server.ts    ← form actions (one per pathway via slug param)
│   │       ├── confirm/[token]/+page.svelte    ← supervisor confirm landing
│   │       ├── confirm/[token]/+page.server.ts
│   │       ├── login/+page.svelte        ← magic-link request
│   │       ├── login/callback/+server.ts ← Supabase auth callback
│   │       ├── counselor/+layout.server.ts ← role gate
│   │       ├── counselor/+page.svelte    ← dashboard (caseload roster)
│   │       ├── counselor/queue/+page.svelte ← approval queue
│   │       ├── counselor/queue/+page.server.ts
│   │       ├── counselor/student/[id]/+page.svelte ← student detail
│   │       ├── scrc/+layout.server.ts    ← role gate
│   │       ├── scrc/+page.svelte         ← project proposals queue
│   │       ├── scrc/proposal/[id]/+page.svelte
│   │       ├── admin/+layout.server.ts   ← role gate
│   │       ├── admin/+page.svelte        ← cohort roster
│   │       ├── admin/import/+page.svelte ← CSV import UI
│   │       ├── admin/import/+page.server.ts
│   │       ├── admin/courses/+page.svelte ← course catalog editor
│   │       ├── admin/users/+page.svelte  ← invite staff
│   │       └── admin/export/+server.ts   ← NYSED audit pack zip
│   ├── static/
│   │   └── gnps-logo.png                 ← cached district logo
│   └── tests/
│       ├── unit/                          ← Vitest, colocated with src/lib/
│       └── e2e/                           ← Playwright
│
├── packages/pathway-rules/               ← NYSED logic, framework-free
│   ├── package.json
│   ├── src/
│   │   ├── index.ts                      ← public API
│   │   ├── pathways.ts                   ← pathway type registry
│   │   ├── points.ts                     ← computePoints(student, evidence)
│   │   ├── eligibility.ts                ← isEligible(points)
│   │   └── caps.ts                       ← apply 2a 3-pt cap, etc.
│   └── tests/
│       └── points.spec.ts
│
├── packages/nysed-export/                ← audit pack generator
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── student-pdf.ts                ← pdf-lib renderer
│   │   ├── roster-csv.ts
│   │   └── zip-bundle.ts                 ← assembles per-cohort zip
│   └── tests/
│
├── supabase/
│   ├── config.toml                       ← Supabase CLI config
│   ├── seed.sql                          ← dev seed: sample students, courses
│   └── migrations/
│       ├── 0001_users_and_audit.sql
│       ├── 0002_students.sql
│       ├── 0003_course_catalog.sql
│       ├── 0004_course_enrollment.sql
│       ├── 0005_regents_scores.sql
│       ├── 0006_pathway_submissions.sql
│       ├── 0007_hours_log.sql
│       ├── 0008_evidence_files.sql
│       ├── 0009_storage_buckets.sql
│       └── 0010_rls_policies.sql
│
├── scripts/
│   └── ic-csv-import/
│       ├── parse.ts                      ← reusable parser used by admin UI
│       └── parse.spec.ts
│
├── .github/workflows/
│   ├── ci.yml                             ← typecheck + tests on PR
│   └── deploy-prod.yml                    ← Vercel + Supabase migration on tag
│
├── docs/
│   ├── superpowers/specs/                 ← (already exists)
│   ├── superpowers/plans/                 ← (this file)
│   ├── deployment-guide.md                ← stub from week 4
│   ├── data-import-guide.md               ← stub from week 3
│   └── customization.md                   ← stub from week 4
│
├── README.md                              ← week 4 deliverable
├── LICENSE                                ← MIT
├── CONTRIBUTING.md                        ← week 4
└── config/district.yaml                   ← district-specific (GNPS defaults)
```

**Why this layout:**
- pnpm workspaces let pathway-rules and nysed-export be tested + versioned independently of the SvelteKit app, which keeps the rule engine pure and easy to reason about.
- Migrations are numbered in dependency order; each migration is small and reversible.
- Routes mirror the user-flow taxonomy from spec §5 — student paths under `/submit`, staff paths under role-named segments — so role-based access controls have one obvious place to live (`+layout.server.ts` per role).

---

## Conventions

- **Strict TypeScript everywhere.** `tsconfig` has `strict: true`, `noUncheckedIndexedAccess: true`.
- **Zod at every boundary.** Form actions, server endpoints, and parsers validate inputs with Zod schemas. Don't trust shapes anywhere data crosses a process boundary.
- **No business logic in Svelte components.** Components render and dispatch; logic lives in `lib/server/*` (server-only) or `packages/pathway-rules` (shared).
- **Audit log on every state change.** Every form action that writes data calls `writeAudit()`. Tests verify the audit row exists.
- **Commit after every passing test set.** Granularity: one task = one commit minimum, often more.
- **No mocking the database in integration tests.** Tests run against a local Supabase instance booted by `supabase start`.

---

## Milestone 1 — Foundation (Week 1)

End-of-milestone state: developer can `pnpm dev`, see a GNPS-themed landing page, and the database schema is fully migrated locally with seed data. CI is green on the empty pipeline.

### Task 1: Repository scaffold + pnpm workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize pnpm workspace root**

```bash
cd /Users/mind_uploaded_crustacean/Desktop/gnps_seal_civic_readiness
corepack enable
pnpm init
```

Replace generated `package.json` with:

```json
{
  "name": "gnps-civic-readiness",
  "version": "0.1.0",
  "private": true,
  "license": "MIT",
  "engines": { "node": ">=20", "pnpm": ">=9" },
  "scripts": {
    "dev": "pnpm --filter ./apps/web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "lint": "prettier --check . && eslint ."
  },
  "devDependencies": {
    "prettier": "^3.3.0",
    "eslint": "^9.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Add workspace config**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "scripts/*"
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 3: Create `.env.example`**

```
# Supabase (local dev defaults from `supabase start` output)
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Resend (leave blank for tests; emails go to a test inbox via Mailpit in CI)
RESEND_API_KEY=
EMAIL_FROM="GNPS Civic Readiness <civicseal-gnps@resend.dev>"

# App
PUBLIC_APP_URL=http://localhost:5173
SIGNED_LINK_SECRET=change-me-32-bytes-min
```

- [ ] **Step 4: Update `.gitignore`**

Append to existing `.gitignore`:

```
node_modules/
.env
.env.local
.svelte-kit/
.vercel/
build/
coverage/
*.log
.DS_Store
supabase/.branches
supabase/.temp
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .env.example .gitignore
git commit -m "feat: pnpm workspace scaffold + env contract"
```

---

### Task 2: SvelteKit app inside the workspace

**Files:**
- Create: `apps/web/` (via SvelteKit CLI)
- Modify: `apps/web/package.json`
- Modify: `apps/web/svelte.config.js`
- Modify: `apps/web/tsconfig.json` (extends base)

- [ ] **Step 1: Generate SvelteKit app**

```bash
mkdir -p apps && cd apps
pnpm create svelte@latest web
# Choices: Skeleton project · TypeScript · Add Prettier · Add ESLint · Add Vitest · Add Playwright · Add Tailwind
cd web && pnpm install
```

- [ ] **Step 2: Install Vercel adapter**

```bash
pnpm add -D @sveltejs/adapter-vercel
```

Edit `apps/web/svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ runtime: 'nodejs20.x' }),
    alias: {
      '$theme': 'src/lib/theme',
      '$server': 'src/lib/server',
      '$components': 'src/lib/components'
    }
  }
};
```

- [ ] **Step 3: Extend base tsconfig**

Replace `apps/web/tsconfig.json` with:

```json
{
  "extends": ["./.svelte-kit/tsconfig.json", "../../tsconfig.base.json"],
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "sourceMap": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 4: Verify the dev server boots**

```bash
pnpm dev
```

Expected: server prints `Local: http://localhost:5173`. Open it; you should see the SvelteKit skeleton homepage. Stop with Ctrl-C.

- [ ] **Step 5: Run the placeholder test to confirm Vitest works**

```bash
pnpm test
```

Expected: 1 test passes (Vitest's auto-generated example).

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat: SvelteKit app with Vercel adapter + Vitest scaffold"
```

---

### Task 3: Supabase local environment

**Files:**
- Create: `supabase/config.toml` (via CLI)

- [ ] **Step 1: Install Supabase CLI**

```bash
brew install supabase/tap/supabase
supabase --version
```

Expected: prints version `1.x` or higher.

- [ ] **Step 2: Initialize Supabase in the repo**

```bash
cd /Users/mind_uploaded_crustacean/Desktop/gnps_seal_civic_readiness
supabase init
```

Expected: creates `supabase/config.toml` and `supabase/migrations/`.

- [ ] **Step 3: Boot local Supabase stack**

```bash
supabase start
```

Expected: ~2 minutes; prints `API URL`, `anon key`, `service_role key`. Copy these into `apps/web/.env.local` (matching the `.env.example` keys).

- [ ] **Step 4: Verify Studio is reachable**

Open `http://127.0.0.1:54323` in a browser. Expected: Supabase Studio loads, no tables yet.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml
git commit -m "chore: supabase CLI initialized"
```

---

### Task 4: First migration — users + audit_log (TDD via SQL test)

**Files:**
- Create: `supabase/migrations/0001_users_and_audit.sql`
- Create: `supabase/tests/0001_users_and_audit.test.sql`

- [ ] **Step 1: Write a failing migration test**

Create `supabase/tests/0001_users_and_audit.test.sql`:

```sql
begin;
select plan(4);

select has_table('public', 'users', 'users table exists');
select has_table('public', 'audit_log', 'audit_log table exists');
select col_is_pk('public', 'users', 'id', 'users.id is primary key');
select col_not_null('public', 'audit_log', 'occurred_at', 'audit_log.occurred_at NOT NULL');

select * from finish();
rollback;
```

Run it (will fail — migration doesn't exist):

```bash
supabase test db
```

Expected: failures because tables don't exist.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/0001_users_and_audit.sql`:

```sql
create extension if not exists "uuid-ossp";

create type user_role as enum ('counselor', 'scrc_member', 'admin');

create table public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  full_name text not null,
  role user_role not null,
  caseload_filter jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table public.audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.users(id),
  actor_kind text not null,
  action text not null,
  target_type text,
  target_id text,
  ip inet,
  user_agent text,
  data jsonb not null default '{}'::jsonb
);

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index audit_log_target_idx on public.audit_log (target_type, target_id);

comment on table public.audit_log is 'Append-only. Never UPDATE or DELETE rows. Required for NYSED audit defensibility.';
```

- [ ] **Step 3: Apply + verify the migration**

```bash
supabase db reset
supabase test db
```

Expected: `4 tests passed`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_users_and_audit.sql supabase/tests/0001_users_and_audit.test.sql
git commit -m "feat(db): users and audit_log tables"
```

---

### Task 5: Migration — students table

**Files:**
- Create: `supabase/migrations/0002_students.sql`
- Create: `supabase/tests/0002_students.test.sql`

- [ ] **Step 1: Failing test**

```sql
-- supabase/tests/0002_students.test.sql
begin;
select plan(5);
select has_table('public', 'students');
select col_is_pk('public', 'students', 'id');
select col_not_null('public', 'students', 'last_name');
select col_not_null('public', 'students', 'grad_year');
select col_type_is('public', 'students', 'accommodations_flag', 'boolean');
select * from finish();
rollback;
```

```bash
supabase test db
```

Expected: failures.

- [ ] **Step 2: Migration**

```sql
-- supabase/migrations/0002_students.sql
create type student_status as enum ('active','awarded','withdrawn','graduated_without_seal');

create table public.students (
  id text primary key,
  last_name text not null,
  first_name text not null,
  grad_year smallint not null,
  counselor_id uuid references public.users(id),
  accommodations_flag boolean not null default false,
  transferred_in_date date,
  status student_status not null default 'active',
  created_at timestamptz not null default now()
);

create index students_grad_year_idx on public.students (grad_year);
create index students_counselor_idx on public.students (counselor_id);
create unique index students_lookup_idx on public.students (id, lower(last_name), grad_year);

comment on column public.students.id is 'External SIS identifier (e.g. GN20271234). Not a UUID — comes from Infinite Campus.';
```

- [ ] **Step 3: Apply + test**

```bash
supabase db reset && supabase test db
```

Expected: tests from migration 0001 + 0002 all pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_students.sql supabase/tests/0002_students.test.sql
git commit -m "feat(db): students table"
```

---

### Task 6: Migrations — course_catalog + course_enrollment + regents_scores

**Files:**
- Create: `supabase/migrations/0003_course_catalog.sql`
- Create: `supabase/migrations/0004_course_enrollment.sql`
- Create: `supabase/migrations/0005_regents_scores.sql`
- Create: `supabase/tests/0003_sis.test.sql`

- [ ] **Step 1: Failing test (combined for 3 tables)**

```sql
-- supabase/tests/0003_sis.test.sql
begin;
select plan(6);
select has_table('public', 'course_catalog');
select has_table('public', 'course_enrollment');
select has_table('public', 'regents_scores');
select col_type_is('public', 'course_catalog', 'counts_for', 'text[]');
select col_type_is('public', 'regents_scores', 'score', 'smallint');
select col_type_is('public', 'regents_scores', 'safety_net_applied', 'boolean');
select * from finish();
rollback;
```

- [ ] **Step 2: Three migrations**

```sql
-- 0003_course_catalog.sql
create table public.course_catalog (
  id bigserial primary key,
  course_code text unique not null,
  title text not null,
  counts_for text[] not null default '{}',  -- e.g. {'1a','1d'}
  credits numeric(3,1) not null default 1.0,
  scrc_approved boolean not null default false,
  scrc_approved_at timestamptz,
  scrc_approved_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
create index course_catalog_counts_for_idx on public.course_catalog using gin (counts_for);
```

```sql
-- 0004_course_enrollment.sql
create type credit_status as enum ('passed','failed','in_progress');

create table public.course_enrollment (
  id bigserial primary key,
  student_id text not null references public.students(id) on delete cascade,
  course_id bigint not null references public.course_catalog(id),
  school_year text not null,           -- 'YYYY-YYYY'
  term text,
  final_grade smallint,
  credit_status credit_status not null,
  imported_at timestamptz not null default now(),
  unique (student_id, course_id, school_year, term)
);
create index course_enrollment_student_idx on public.course_enrollment (student_id);
```

```sql
-- 0005_regents_scores.sql
create type regents_exam as enum ('GLOBAL_II','US_HISTORY');
create type proficiency_level as enum ('mastery','proficiency','safety_net_pass','below');

create table public.regents_scores (
  id bigserial primary key,
  student_id text not null references public.students(id) on delete cascade,
  exam_code regents_exam not null,
  score smallint not null check (score between 0 and 100),
  exam_date date not null,
  safety_net_applied boolean not null default false,
  imported_at timestamptz not null default now(),
  unique (student_id, exam_code, exam_date)
);

create or replace function public.regents_proficiency(score smallint, safety_net boolean)
returns proficiency_level language sql immutable as $$
  select case
    when score >= 85 then 'mastery'::proficiency_level
    when score between 65 and 84 then 'proficiency'::proficiency_level
    when safety_net and score between 55 and 64 then 'safety_net_pass'::proficiency_level
    else 'below'::proficiency_level
  end;
$$;
```

- [ ] **Step 3: Apply + test**

```bash
supabase db reset && supabase test db
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_*.sql supabase/migrations/0004_*.sql supabase/migrations/0005_*.sql supabase/tests/0003_*.test.sql
git commit -m "feat(db): SIS-side tables (catalog, enrollment, regents)"
```

---

### Task 7: Migrations — pathway_submissions + hours_log + evidence_files

**Files:**
- Create: `supabase/migrations/0006_pathway_submissions.sql`
- Create: `supabase/migrations/0007_hours_log.sql`
- Create: `supabase/migrations/0008_evidence_files.sql`
- Create: `supabase/migrations/0009_storage_buckets.sql`
- Create: `supabase/tests/0006_evidence.test.sql`

- [ ] **Step 1: Failing test**

```sql
-- supabase/tests/0006_evidence.test.sql
begin;
select plan(8);
select has_table('public', 'pathway_submissions');
select has_table('public', 'hours_log');
select has_table('public', 'evidence_files');
select col_type_is('public', 'pathway_submissions', 'pathway_type', 'pathway_type');
select col_type_is('public', 'pathway_submissions', 'status', 'submission_status');
select col_type_is('public', 'hours_log', 'service_type', 'service_type');
select col_type_is('public', 'hours_log', 'confirmation_status', 'confirmation_status');
select col_type_is('public', 'evidence_files', 'kind', 'evidence_kind');
select * from finish();
rollback;
```

- [ ] **Step 2: Migrations**

```sql
-- 0006_pathway_submissions.sql
create type pathway_type as enum (
  'research_project','hs_civic_project','service_learning',
  'civic_elective_essay','wbl_extracurr','ms_capstone','hs_capstone'
);

create type submission_status as enum (
  'draft','proposed','topic_approved','in_progress',
  'submitted','scored','awarded','rejected','revoked'
);

create table public.pathway_submissions (
  id bigserial primary key,
  student_id text not null references public.students(id) on delete cascade,
  pathway_type pathway_type not null,
  status submission_status not null default 'draft',
  points_awarded numeric(3,1),
  instance_number smallint not null default 1,
  domain_tags text[] not null default '{}',  -- knowledge|skills|mindsets|experiences
  proposed_at timestamptz,
  topic_approved_at timestamptz,
  topic_approved_by uuid references public.users(id),
  submitted_at timestamptz,
  scored_at timestamptz,
  scored_by uuid references public.users(id),
  awarded_at timestamptz,
  proposed_by_text text,                     -- name only; student has no account
  rubric_scores jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ps_student_idx on public.pathway_submissions (student_id);
create index ps_status_idx on public.pathway_submissions (status);
create index ps_pathway_idx on public.pathway_submissions (pathway_type);
```

```sql
-- 0007_hours_log.sql
create type service_type as enum ('direct','indirect','advocacy');
create type confirmation_status as enum ('pending','confirmed','disputed','expired');

create table public.hours_log (
  id bigserial primary key,
  submission_id bigint not null references public.pathway_submissions(id) on delete cascade,
  activity_name text not null,
  organization text,
  service_type service_type,                  -- only for service_learning
  hours numeric(5,1) not null check (hours > 0),
  date_start date not null,
  date_end date not null,
  description text,
  supervisor_name text not null,
  supervisor_email text not null,
  supervisor_org text,
  confirmation_token uuid not null default uuid_generate_v4(),
  confirmation_status confirmation_status not null default 'pending',
  confirmation_sent_at timestamptz,
  confirmation_responded_at timestamptz,
  confirmer_ip inet,
  confirmation_dispute_reason text,
  created_at timestamptz not null default now()
);

create unique index hours_log_token_idx on public.hours_log (confirmation_token);
create index hours_log_submission_idx on public.hours_log (submission_id);
create index hours_log_supervisor_email_idx on public.hours_log (supervisor_email);
```

```sql
-- 0008_evidence_files.sql
create type evidence_kind as enum (
  'reflection_essay','artifact','presentation',
  'supervisor_receipt','rubric_scoresheet','application_essay'
);

create table public.evidence_files (
  id bigserial primary key,
  submission_id bigint not null references public.pathway_submissions(id) on delete cascade,
  storage_path text not null,                 -- e.g. evidence/<submission_id>/<uuid>.pdf
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  kind evidence_kind not null,
  domain_tags text[] not null default '{}',
  uploaded_at timestamptz not null default now(),
  uploaded_by_text text                       -- student has no account
);
create index evidence_files_submission_idx on public.evidence_files (submission_id);
```

```sql
-- 0009_storage_buckets.sql
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict do nothing;
```

- [ ] **Step 3: Apply + test**

```bash
supabase db reset && supabase test db
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_*.sql supabase/migrations/0007_*.sql supabase/migrations/0008_*.sql supabase/migrations/0009_*.sql supabase/tests/0006_*.test.sql
git commit -m "feat(db): pathway submissions, hours log, evidence files"
```

---

### Task 8: Pathway-rules package — point computation (TDD)

**Files:**
- Create: `packages/pathway-rules/package.json`
- Create: `packages/pathway-rules/src/pathways.ts`
- Create: `packages/pathway-rules/src/points.ts`
- Create: `packages/pathway-rules/src/eligibility.ts`
- Create: `packages/pathway-rules/tests/points.spec.ts`
- Create: `packages/pathway-rules/tests/eligibility.spec.ts`

- [ ] **Step 1: Package skeleton**

```bash
mkdir -p packages/pathway-rules/{src,tests}
cd packages/pathway-rules
pnpm init
pnpm add -D typescript vitest @types/node
```

Replace `packages/pathway-rules/package.json` with:

```json
{
  "name": "@gnps-civic/pathway-rules",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

Create `packages/pathway-rules/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "tests"] }
```

- [ ] **Step 2: Failing test for `pathways.ts` registry**

Create `packages/pathway-rules/tests/pathways.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PATHWAYS, columnOf, capOf } from '../src/pathways.js';

describe('PATHWAYS registry', () => {
  it('lists all 11 NYSED pathways with point values', () => {
    expect(PATHWAYS.length).toBe(11);
  });
  it('classifies hs_civic_project under participation column', () => {
    expect(columnOf('hs_civic_project')).toBe('participation');
  });
  it('caps hs_civic_project at 3 points (2 instances)', () => {
    expect(capOf('hs_civic_project')).toEqual({ maxInstances: 2, maxPoints: 3 });
  });
  it('does not cap service_learning (repeatable, no cap)', () => {
    expect(capOf('service_learning')).toBeNull();
  });
});
```

```bash
cd packages/pathway-rules && pnpm test
```

Expected: fails — module doesn't exist.

- [ ] **Step 3: Minimal `pathways.ts`**

```ts
// packages/pathway-rules/src/pathways.ts
export type PathwayId =
  | 'four_ss_credits'        // 1a (SIS-derived)
  | 'regents_mastery'        // 1b (SIS, repeatable)
  | 'regents_proficiency'    // 1c (SIS, repeatable)
  | 'advanced_ss_course'     // 1d (SIS, repeatable)
  | 'research_project'       // 1e
  | 'hs_civic_project'       // 2a (max 2x, 3pt cap)
  | 'service_learning'       // 2b (repeatable)
  | 'civic_elective'         // 2c — proficiency from SIS + essay
  | 'ms_capstone'            // grades 7-8 only
  | 'wbl_extracurr'          // 2e (repeatable)
  | 'hs_capstone';           // 2f — 4 points

export type Column = 'knowledge' | 'participation';

export interface Pathway {
  id: PathwayId;
  column: Column;
  pointsEach: number;
  cap: { maxInstances: number; maxPoints: number } | null;
  sisDerived: boolean;        // true → no pathway_submissions row
}

export const PATHWAYS: readonly Pathway[] = [
  { id: 'four_ss_credits',     column: 'knowledge',     pointsEach: 1,   cap: { maxInstances: 1, maxPoints: 1 }, sisDerived: true },
  { id: 'regents_mastery',     column: 'knowledge',     pointsEach: 1.5, cap: null, sisDerived: true },
  { id: 'regents_proficiency', column: 'knowledge',     pointsEach: 1,   cap: null, sisDerived: true },
  { id: 'advanced_ss_course',  column: 'knowledge',     pointsEach: 0.5, cap: null, sisDerived: true },
  { id: 'research_project',    column: 'knowledge',     pointsEach: 1,   cap: { maxInstances: 1, maxPoints: 1 }, sisDerived: false },
  { id: 'hs_civic_project',    column: 'participation', pointsEach: 1.5, cap: { maxInstances: 2, maxPoints: 3 }, sisDerived: false },
  { id: 'service_learning',    column: 'participation', pointsEach: 1,   cap: null, sisDerived: false },
  { id: 'civic_elective',      column: 'participation', pointsEach: 0.5, cap: null, sisDerived: true /* essay component is non-SIS but counts when paired */ },
  { id: 'ms_capstone',         column: 'participation', pointsEach: 1,   cap: { maxInstances: 1, maxPoints: 1 }, sisDerived: false },
  { id: 'wbl_extracurr',       column: 'participation', pointsEach: 0.5, cap: null, sisDerived: false },
  { id: 'hs_capstone',         column: 'participation', pointsEach: 4,   cap: { maxInstances: 1, maxPoints: 4 }, sisDerived: false },
] as const;

export function columnOf(id: PathwayId): Column {
  const p = PATHWAYS.find(p => p.id === id);
  if (!p) throw new Error(`unknown pathway: ${id}`);
  return p.column;
}

export function capOf(id: PathwayId): Pathway['cap'] {
  const p = PATHWAYS.find(p => p.id === id);
  if (!p) throw new Error(`unknown pathway: ${id}`);
  return p.cap;
}
```

- [ ] **Step 4: Run tests, expect green**

```bash
pnpm test
```

Expected: 4 passing.

- [ ] **Step 5: Failing test for `points.ts`**

```ts
// packages/pathway-rules/tests/points.spec.ts
import { describe, expect, it } from 'vitest';
import { computePoints, type StudentEvidence } from '../src/points.js';

describe('computePoints', () => {
  it('awards 1pt for 4 SS credits passed', () => {
    const ev: StudentEvidence = { ssCreditsPassed: 4, regents: [], advancedSsCount: 0, awarded: [] };
    expect(computePoints(ev).knowledge).toBe(1);
  });
  it('awards 1.5pt mastery + 1pt proficiency for two Regents', () => {
    const ev: StudentEvidence = {
      ssCreditsPassed: 0, advancedSsCount: 0, awarded: [],
      regents: [
        { exam: 'GLOBAL_II', score: 87, safetyNet: false },
        { exam: 'US_HISTORY', score: 72, safetyNet: false },
      ],
    };
    expect(computePoints(ev).knowledge).toBe(2.5);
  });
  it('caps hs_civic_project at 3 points even with 3 instances', () => {
    const ev: StudentEvidence = { ssCreditsPassed: 0, regents: [], advancedSsCount: 0,
      awarded: [
        { pathway: 'hs_civic_project', points: 1.5 },
        { pathway: 'hs_civic_project', points: 1.5 },
        { pathway: 'hs_civic_project', points: 1.5 },  // would be 4.5; cap = 3
      ],
    };
    expect(computePoints(ev).participation).toBe(3);
  });
  it('hs_capstone alone gives 4pt participation', () => {
    const ev: StudentEvidence = { ssCreditsPassed: 0, regents: [], advancedSsCount: 0,
      awarded: [{ pathway: 'hs_capstone', points: 4 }] };
    expect(computePoints(ev).participation).toBe(4);
  });
});
```

```bash
pnpm test
```

Expected: fails.

- [ ] **Step 6: Implement `points.ts`**

```ts
// packages/pathway-rules/src/points.ts
import { PATHWAYS, type PathwayId, capOf, columnOf } from './pathways.js';

export interface StudentEvidence {
  ssCreditsPassed: number;
  regents: { exam: 'GLOBAL_II' | 'US_HISTORY'; score: number; safetyNet: boolean }[];
  advancedSsCount: number;
  awarded: { pathway: PathwayId; points: number }[];
}

export interface PointTotals { knowledge: number; participation: number; total: number; }

export function computePoints(ev: StudentEvidence): PointTotals {
  let knowledge = 0;
  let participation = 0;

  if (ev.ssCreditsPassed >= 4) knowledge += 1;
  knowledge += ev.advancedSsCount * 0.5;

  for (const r of ev.regents) {
    if (r.score >= 85) knowledge += 1.5;
    else if (r.score >= 65 || (r.safetyNet && r.score >= 55)) knowledge += 1;
  }

  // group awarded by pathway, apply caps
  const grouped = new Map<PathwayId, number>();
  for (const a of ev.awarded) {
    grouped.set(a.pathway, (grouped.get(a.pathway) ?? 0) + a.points);
  }
  for (const [pathway, raw] of grouped) {
    const cap = capOf(pathway);
    const capped = cap ? Math.min(raw, cap.maxPoints) : raw;
    if (columnOf(pathway) === 'knowledge') knowledge += capped;
    else participation += capped;
  }

  return { knowledge, participation, total: knowledge + participation };
}
```

```bash
pnpm test
```

Expected: 8 passing.

- [ ] **Step 7: Eligibility test + impl**

```ts
// packages/pathway-rules/tests/eligibility.spec.ts
import { describe, expect, it } from 'vitest';
import { isEligible } from '../src/eligibility.js';

describe('isEligible', () => {
  it('not eligible at 5.5 total', () =>
    expect(isEligible({ knowledge: 2, participation: 3.5, total: 5.5 })).toBe(false));
  it('not eligible at 6 total but 1.5 knowledge', () =>
    expect(isEligible({ knowledge: 1.5, participation: 4.5, total: 6 })).toBe(false));
  it('eligible at exactly 2/2/6', () =>
    expect(isEligible({ knowledge: 2, participation: 4, total: 6 })).toBe(true));
});
```

```ts
// packages/pathway-rules/src/eligibility.ts
import type { PointTotals } from './points.js';
export function isEligible(p: PointTotals): boolean {
  return p.knowledge >= 2 && p.participation >= 2 && p.total >= 6;
}
```

```ts
// packages/pathway-rules/src/index.ts
export * from './pathways.js';
export * from './points.js';
export * from './eligibility.js';
```

```bash
pnpm test
```

Expected: 11 passing.

- [ ] **Step 8: Commit**

```bash
git add packages/pathway-rules
git commit -m "feat(rules): pathway registry + point computation + eligibility"
```

---

### Task 9: GNPS theme tokens + AppShell

**Files:**
- Create: `apps/web/src/lib/theme/tokens.ts`
- Create: `apps/web/src/lib/theme/Logo.svelte`
- Create: `apps/web/src/lib/theme/AppShell.svelte`
- Modify: `apps/web/src/app.html`
- Modify: `apps/web/src/app.css`
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/src/routes/+page.svelte`
- Create: `apps/web/tests/unit/AppShell.spec.ts`

- [ ] **Step 1: Theme tokens**

```ts
// apps/web/src/lib/theme/tokens.ts
export const gnps = {
  colors: {
    primary: '#204A97',
    primaryDark: '#1a3d80',
    secondary: '#FE8158',
    bg: '#ffffff',
    surface: '#f7f9fc',
    text: '#1a1a1a',
    textMuted: '#555555',
    border: '#d4d8e0',
    success: '#1f5c2c',
    warning: '#8a6500',
    error: '#8a2820',
  },
  fonts: {
    display: '"Outfit", "Helvetica Neue", Arial, sans-serif',
    body: '"Roboto", "Helvetica Neue", Arial, sans-serif',
    serif: '"Literata", Georgia, serif',
  },
  logoUrl: 'https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_2/v1719848341/greatneckk12nyus/mapstlq0ll8etgbkht69/NewGNPSLogoRound.png',
};
```

- [ ] **Step 2: Tailwind config restricted to GNPS palette**

```ts
// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss';
import { gnps } from './src/lib/theme/tokens.js';

export default {
  content: ['./src/**/*.{html,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: gnps.colors.primary, dark: gnps.colors.primaryDark },
        secondary: gnps.colors.secondary,
        surface: gnps.colors.surface,
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Roboto', 'system-ui', 'sans-serif'],
        serif: ['Literata', 'Georgia', 'serif'],
      },
    },
  },
} satisfies Config;
```

- [ ] **Step 3: app.html — load fonts**

```html
<!-- apps/web/src/app.html -->
<!doctype html>
<html lang="en" class="font-body text-[15px] leading-relaxed text-[#1a1a1a]">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Literata:opsz,wght@7..72,400&display=swap">
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 4: AppShell component (top nav + footer + logo)**

```svelte
<!-- apps/web/src/lib/theme/Logo.svelte -->
<script lang="ts">
  import { gnps } from './tokens.js';
  export let size: number = 36;
</script>
<img src={gnps.logoUrl} alt="GNPS" width={size} height={size}
     class="rounded-full bg-white p-0.5" loading="eager" />
```

```svelte
<!-- apps/web/src/lib/theme/AppShell.svelte -->
<script lang="ts">
  import Logo from './Logo.svelte';
</script>
<div class="min-h-screen flex flex-col bg-white">
  <header class="bg-primary text-white px-6 py-3 flex items-center gap-3 font-display">
    <Logo />
    <div class="flex flex-col leading-tight">
      <span class="font-semibold">Great Neck Public Schools</span>
      <span class="text-xs opacity-80">Seal of Civic Readiness Portal</span>
    </div>
    <nav class="ml-auto flex gap-4 text-sm">
      <a href="/" class="hover:underline">Home</a>
      <a href="/submit" class="hover:underline">Submit Evidence</a>
      <a href="/login" class="hover:underline">Staff Login</a>
    </nav>
  </header>
  <main class="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
    <slot />
  </main>
  <footer class="bg-surface border-t border-[#d4d8e0] px-6 py-4 text-xs text-[#555] flex justify-between">
    <span>© Great Neck Public Schools · Open-source on GitHub (MIT)</span>
    <span>Questions: civicseal@greatneck.k12.ny.us</span>
  </footer>
</div>
```

- [ ] **Step 5: Wire into +layout + landing page**

```svelte
<!-- apps/web/src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  import AppShell from '$theme/AppShell.svelte';
</script>
<AppShell><slot /></AppShell>
```

```svelte
<!-- apps/web/src/routes/+page.svelte -->
<svelte:head><title>NYS Seal of Civic Readiness — Great Neck Public Schools</title></svelte:head>

<h1 class="font-display text-3xl font-bold text-primary mb-3">Seal of Civic Readiness</h1>
<p class="font-serif text-lg text-[#555] mb-6 max-w-2xl">
  Great Neck Public Schools' portal for tracking the New York State Seal of Civic Readiness — a transcript and diploma distinction earned across grades 9–12 through civic knowledge and civic participation.
</p>
<div class="flex gap-3">
  <a href="/submit" class="bg-secondary text-white px-5 py-2.5 rounded font-display font-semibold uppercase tracking-wide text-sm">Submit Evidence</a>
  <a href="/login" class="border-2 border-primary text-primary px-5 py-2.5 rounded font-display font-semibold uppercase tracking-wide text-sm">Staff Login</a>
</div>
```

- [ ] **Step 6: Smoke test that AppShell renders**

```ts
// apps/web/tests/unit/AppShell.spec.ts
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import AppShell from '$theme/AppShell.svelte';

describe('AppShell', () => {
  it('renders header with district name', () => {
    const { getByText } = render(AppShell);
    expect(getByText('Great Neck Public Schools')).toBeTruthy();
    expect(getByText('Seal of Civic Readiness Portal')).toBeTruthy();
  });
});
```

```bash
pnpm add -D @testing-library/svelte
pnpm test
```

Expected: passing.

- [ ] **Step 7: Boot the dev server, eyeball the page**

```bash
pnpm dev
```

Expected: navy header with the GNPS round logo at the top, coral "Submit Evidence" button. Open `http://localhost:5173` and verify visually.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(theme): GNPS brand tokens, AppShell, themed landing page"
```

---

## Milestone 2 — Public submission slice (Week 2)

End-of-milestone state: a student can submit service-learning hours, a supervisor receives an email and confirms via signed link, a counselor (later) sees a queue. Audit log captures every step. All six pathway-type submission forms work end-to-end with appropriate evidence requirements.

### Task 10: Audit-log helper (TDD)

**Files:**
- Create: `apps/web/src/lib/server/supabase.ts`
- Create: `apps/web/src/lib/server/audit.ts`
- Create: `apps/web/tests/unit/audit.spec.ts`

- [ ] **Step 1: Failing test**

```ts
// apps/web/tests/unit/audit.spec.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { writeAudit } from '$server/audit.js';
import { supabaseAdmin } from '$server/supabase.js';

describe('writeAudit', () => {
  beforeEach(async () => {
    await supabaseAdmin.from('audit_log').delete().neq('id', 0);
  });
  it('writes a row with action and target', async () => {
    await writeAudit({ actorKind: 'student', action: 'student_submitted', targetType: 'pathway_submissions', targetId: '42', data: { foo: 'bar' } });
    const { data } = await supabaseAdmin.from('audit_log').select('*').single();
    expect(data?.action).toBe('student_submitted');
    expect(data?.target_id).toBe('42');
    expect(data?.data).toEqual({ foo: 'bar' });
  });
});
```

```bash
pnpm test
```

Expected: fails — `writeAudit` doesn't exist.

- [ ] **Step 2: Supabase admin client**

```bash
pnpm --filter ./apps/web add @supabase/supabase-js
```

```ts
// apps/web/src/lib/server/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

- [ ] **Step 3: writeAudit**

```ts
// apps/web/src/lib/server/audit.ts
import { supabaseAdmin } from './supabase.js';

export interface AuditEvent {
  actorId?: string | null;
  actorKind: 'student' | 'supervisor' | 'counselor' | 'scrc_member' | 'admin' | 'system';
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string | null;
  userAgent?: string | null;
  data?: Record<string, unknown>;
}

export async function writeAudit(e: AuditEvent): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_log').insert({
    actor_id: e.actorId ?? null,
    actor_kind: e.actorKind,
    action: e.action,
    target_type: e.targetType ?? null,
    target_id: e.targetId ?? null,
    ip: e.ip ?? null,
    user_agent: e.userAgent ?? null,
    data: e.data ?? {},
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/server/supabase.ts apps/web/src/lib/server/audit.ts apps/web/tests/unit/audit.spec.ts
git commit -m "feat(server): supabase admin client + writeAudit helper"
```

---

### Task 11: Student lookup endpoint

**Files:**
- Create: `apps/web/src/lib/server/students.ts`
- Create: `apps/web/tests/unit/students.spec.ts`

- [ ] **Step 1: Failing test**

```ts
// apps/web/tests/unit/students.spec.ts
import { describe, expect, it, beforeAll } from 'vitest';
import { lookupStudent } from '$server/students.js';
import { supabaseAdmin } from '$server/supabase.js';

beforeAll(async () => {
  await supabaseAdmin.from('students').upsert({
    id: 'GN20271234', last_name: 'Goldberg', first_name: 'Maya', grad_year: 2027,
  });
});

describe('lookupStudent', () => {
  it('matches by id + lower-cased last_name + grad_year', async () => {
    const s = await lookupStudent({ id: 'GN20271234', lastName: 'goldberg', gradYear: 2027 });
    expect(s?.first_name).toBe('Maya');
  });
  it('returns null when last_name does not match', async () => {
    const s = await lookupStudent({ id: 'GN20271234', lastName: 'wrong', gradYear: 2027 });
    expect(s).toBeNull();
  });
});
```

- [ ] **Step 2: Implementation**

```ts
// apps/web/src/lib/server/students.ts
import { z } from 'zod';
import { supabaseAdmin } from './supabase.js';

export const StudentLookupSchema = z.object({
  id: z.string().min(3),
  lastName: z.string().min(1),
  gradYear: z.number().int().min(2024).max(2040),
});
export type StudentLookup = z.infer<typeof StudentLookupSchema>;

export async function lookupStudent(input: StudentLookup) {
  const { data } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('id', input.id)
    .eq('grad_year', input.gradYear)
    .ilike('last_name', input.lastName)
    .maybeSingle();
  return data;
}
```

```bash
pnpm add zod
pnpm test
```

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/server/students.ts apps/web/tests/unit/students.spec.ts
git commit -m "feat(server): student lookup by id + last_name + grad_year"
```

---

### Task 12: Resend email wrapper + signed-link helper

**Files:**
- Create: `apps/web/src/lib/server/email.ts`
- Create: `apps/web/tests/unit/email.spec.ts`

- [ ] **Step 1: Failing test for signed-link helpers**

```ts
// apps/web/tests/unit/email.spec.ts
import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '$server/email.js';

describe('signToken / verifyToken', () => {
  it('round-trips a UUID', () => {
    const tok = signToken('11111111-2222-3333-4444-555555555555');
    expect(verifyToken(tok)).toBe('11111111-2222-3333-4444-555555555555');
  });
  it('rejects tampered token', () => {
    const tok = signToken('aaaa') + 'X';
    expect(verifyToken(tok)).toBeNull();
  });
});
```

- [ ] **Step 2: Implementation**

```bash
pnpm --filter ./apps/web add resend
```

```ts
// apps/web/src/lib/server/email.ts
import { Resend } from 'resend';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { RESEND_API_KEY, SIGNED_LINK_SECRET, EMAIL_FROM } from '$env/static/private';
import { PUBLIC_APP_URL } from '$env/static/public';

const resend = new Resend(RESEND_API_KEY);

export function signToken(uuid: string): string {
  const sig = createHmac('sha256', SIGNED_LINK_SECRET).update(uuid).digest('hex').slice(0, 32);
  return `${uuid}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const [uuid, sig] = token.split('.');
  if (!uuid || !sig) return null;
  const expected = createHmac('sha256', SIGNED_LINK_SECRET).update(uuid).digest('hex').slice(0, 32);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return uuid;
  } catch { return null; }
}

export interface SupervisorEmailInput {
  to: string;
  supervisorName: string;
  studentName: string;
  studentSchool: string;
  hours: number;
  organization: string;
  dateRange: string;
  confirmToken: string;
}

export async function sendSupervisorConfirmation(i: SupervisorEmailInput) {
  const url = `${PUBLIC_APP_URL}/confirm/${signToken(i.confirmToken)}`;
  const html = `
    <p>Hi ${i.supervisorName},</p>
    <p>${i.studentName}, a student at ${i.studentSchool}, is pursuing the New York State Seal of Civic Readiness. They listed you as their supervisor for <strong>${i.hours} hours</strong> at <strong>${i.organization}</strong> on ${i.dateRange}.</p>
    <p><a href="${url}" style="background:#FE8158;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;font-family:sans-serif">Confirm ${i.hours} hours</a> &nbsp; <a href="${url}?dispute=1" style="color:#204A97">Hours don't match</a></p>
    <p style="color:#888;font-size:12px">If you didn't supervise this student, ignore this email. Link expires in 14 days.</p>
  `;
  return resend.emails.send({ from: EMAIL_FROM, to: i.to, subject: `Please confirm ${i.hours} service hours for ${i.studentName}`, html });
}
```

```bash
pnpm test
```

Expected: signature tests green. (sendSupervisorConfirmation is integration-tested in Task 14.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/server/email.ts apps/web/tests/unit/email.spec.ts
git commit -m "feat(email): Resend wrapper + signed-link round-trip"
```

---

### Task 13: Service-learning submission form + form action

**Files:**
- Create: `apps/web/src/routes/submit/+page.svelte` (pathway picker)
- Create: `apps/web/src/routes/submit/service/+page.svelte`
- Create: `apps/web/src/routes/submit/service/+page.server.ts`
- Create: `apps/web/src/lib/server/submissions.ts`
- Create: `apps/web/tests/unit/submissions.spec.ts`

- [ ] **Step 1: Failing test for `createServiceSubmission`**

```ts
// apps/web/tests/unit/submissions.spec.ts
import { describe, expect, it, beforeAll } from 'vitest';
import { createServiceSubmission } from '$server/submissions.js';
import { supabaseAdmin } from '$server/supabase.js';

beforeAll(async () => {
  await supabaseAdmin.from('students').upsert({
    id: 'GN20271234', last_name: 'Goldberg', first_name: 'Maya', grad_year: 2027 });
});

describe('createServiceSubmission', () => {
  it('writes pathway_submissions + hours_log + audit row', async () => {
    const result = await createServiceSubmission({
      studentId: 'GN20271234',
      activityName: 'Long Island Cares', organization: 'Long Island Cares',
      serviceType: 'direct', hours: 8,
      dateStart: '2026-04-15', dateEnd: '2026-04-22',
      description: 'Sorted donations',
      supervisorName: 'J. Patel', supervisorEmail: 'jpatel@licares.org', supervisorOrg: 'LI Cares',
    });
    expect(result.submissionId).toBeGreaterThan(0);
    expect(result.confirmationToken).toMatch(/[0-9a-f-]{36}/);

    const { data: sub } = await supabaseAdmin.from('pathway_submissions')
      .select('*').eq('id', result.submissionId).single();
    expect(sub?.pathway_type).toBe('service_learning');
    expect(sub?.status).toBe('submitted');

    const { data: log } = await supabaseAdmin.from('hours_log')
      .select('*').eq('submission_id', result.submissionId).single();
    expect(log?.hours).toBe('8.0');
    expect(log?.confirmation_status).toBe('pending');

    const { count } = await supabaseAdmin.from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'student_submitted_service_hours');
    expect(count).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implementation**

```ts
// apps/web/src/lib/server/submissions.ts
import { z } from 'zod';
import { supabaseAdmin } from './supabase.js';
import { writeAudit } from './audit.js';

export const ServiceSubmissionSchema = z.object({
  studentId: z.string(),
  activityName: z.string().min(2),
  organization: z.string().min(2),
  serviceType: z.enum(['direct','indirect','advocacy']),
  hours: z.number().positive().max(200),
  dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional().default(''),
  supervisorName: z.string().min(2),
  supervisorEmail: z.string().email(),
  supervisorOrg: z.string().optional().default(''),
});
export type ServiceSubmission = z.infer<typeof ServiceSubmissionSchema>;

export async function createServiceSubmission(input: ServiceSubmission) {
  const data = ServiceSubmissionSchema.parse(input);

  const { data: sub, error: e1 } = await supabaseAdmin
    .from('pathway_submissions')
    .insert({ student_id: data.studentId, pathway_type: 'service_learning', status: 'submitted',
              proposed_by_text: data.studentId, submitted_at: new Date().toISOString() })
    .select().single();
  if (e1 || !sub) throw e1 ?? new Error('insert failed');

  const { data: log, error: e2 } = await supabaseAdmin
    .from('hours_log')
    .insert({
      submission_id: sub.id, activity_name: data.activityName, organization: data.organization,
      service_type: data.serviceType, hours: data.hours,
      date_start: data.dateStart, date_end: data.dateEnd, description: data.description,
      supervisor_name: data.supervisorName, supervisor_email: data.supervisorEmail,
      supervisor_org: data.supervisorOrg,
    })
    .select().single();
  if (e2 || !log) throw e2 ?? new Error('insert failed');

  await writeAudit({
    actorKind: 'student', action: 'student_submitted_service_hours',
    targetType: 'pathway_submissions', targetId: String(sub.id),
    data: { hours: data.hours, supervisor_email: data.supervisorEmail },
  });

  return { submissionId: sub.id, confirmationToken: log.confirmation_token };
}
```

```bash
pnpm test
```

Expected: green.

- [ ] **Step 3: Pathway picker page**

```svelte
<!-- apps/web/src/routes/submit/+page.svelte -->
<svelte:head><title>Submit Evidence — GNPS Civic Readiness</title></svelte:head>
<h1 class="font-display text-2xl text-primary mb-4">Submit Evidence</h1>
<p class="mb-6 text-[#555]">Choose the pathway you're submitting evidence for.</p>
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  {#each [
    { href: '/submit/service', label: 'Service-Learning Hours', sub: '2b · 25+ hrs + reflection' },
    { href: '/submit/wbl', label: 'Extra-curricular / Work-Based Learning', sub: '2e · 40+ hrs + essay' },
    { href: '/submit/civic-project', label: 'High School Civic Project', sub: '2a · 1.5 pts (max 2 instances)' },
    { href: '/submit/research', label: 'Research Project', sub: '1e · 1 pt' },
    { href: '/submit/capstone', label: 'Civics Capstone Project', sub: '2f · 4 pts' },
    { href: '/submit/civic-elective', label: 'Civic-Engagement Elective Essay', sub: '2c · 0.5 pt' },
  ] as p}
    <a href={p.href} class="block border border-[#d4d8e0] rounded-lg p-4 hover:border-primary hover:shadow-sm">
      <div class="font-display font-semibold text-primary">{p.label}</div>
      <div class="text-xs text-[#555] mt-1">{p.sub}</div>
    </a>
  {/each}
</div>
```

- [ ] **Step 4: Service-learning page + action**

```svelte
<!-- apps/web/src/routes/submit/service/+page.svelte -->
<script lang="ts">
  import type { ActionData } from './$types';
  export let form: ActionData;
</script>
<svelte:head><title>Service-Learning Hours — GNPS Civic Readiness</title></svelte:head>
<h1 class="font-display text-2xl text-primary mb-2">Service-Learning Hours</h1>
<p class="text-sm text-[#555] mb-6">Pathway 2b · 25+ hours required for 1 point · reflection required at end.</p>

{#if form?.success}
  <div class="bg-green-50 border-l-4 border-green-600 p-4 rounded mb-4">
    <p class="font-semibold text-green-800">Hours submitted.</p>
    <p class="text-sm text-green-900 mt-1">We've emailed your supervisor a confirmation link. Once they confirm, your hours count toward the 25-hour threshold.</p>
  </div>
{/if}

<form method="POST" class="space-y-4 max-w-2xl">
  <fieldset class="grid grid-cols-2 gap-4">
    <label class="block">
      <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Student ID</span>
      <input name="studentId" required class="w-full mt-1 px-3 py-2 border border-[#c4c8d0] rounded text-sm" />
    </label>
    <label class="block">
      <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Last name</span>
      <input name="lastName" required class="w-full mt-1 px-3 py-2 border border-[#c4c8d0] rounded text-sm" />
    </label>
    <label class="block">
      <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Graduation year</span>
      <input name="gradYear" type="number" required class="w-full mt-1 px-3 py-2 border border-[#c4c8d0] rounded text-sm" />
    </label>
  </fieldset>
  <label class="block">
    <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Activity / organization</span>
    <input name="activityName" required class="w-full mt-1 px-3 py-2 border border-[#c4c8d0] rounded text-sm" placeholder="Long Island Cares — food bank" />
  </label>
  <fieldset class="grid grid-cols-2 gap-4">
    <label class="block">
      <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Date start</span>
      <input name="dateStart" type="date" required class="w-full mt-1 px-3 py-2 border border-[#c4c8d0] rounded text-sm" />
    </label>
    <label class="block">
      <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Date end</span>
      <input name="dateEnd" type="date" required class="w-full mt-1 px-3 py-2 border border-[#c4c8d0] rounded text-sm" />
    </label>
    <label class="block">
      <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Hours</span>
      <input name="hours" type="number" step="0.5" min="0.5" max="200" required class="w-full mt-1 px-3 py-2 border border-[#c4c8d0] rounded text-sm" />
    </label>
    <label class="block">
      <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Service type</span>
      <select name="serviceType" required class="w-full mt-1 px-3 py-2 border border-[#c4c8d0] rounded text-sm">
        <option value="direct">Direct — face-to-face with people you serve</option>
        <option value="indirect">Indirect — meets a need without direct contact</option>
        <option value="advocacy">Advocacy — educating others about an issue</option>
      </select>
    </label>
  </fieldset>
  <label class="block">
    <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Supervisor name &amp; email <span class="text-secondary normal-case">(will receive a confirmation link)</span></span>
    <input name="supervisorName" required class="w-full mt-1 px-3 py-2 border border-[#c4c8d0] rounded text-sm" placeholder="J. Patel" />
    <input name="supervisorEmail" type="email" required class="w-full mt-2 px-3 py-2 border border-[#c4c8d0] rounded text-sm" placeholder="jpatel@licares.org" />
  </label>
  <label class="block">
    <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Description (1–3 sentences)</span>
    <textarea name="description" rows="2" class="w-full mt-1 px-3 py-2 border border-[#c4c8d0] rounded text-sm"></textarea>
  </label>
  <button class="bg-secondary text-white px-6 py-2.5 rounded font-display font-semibold uppercase tracking-wide text-sm">Submit hours</button>
  {#if form?.error}<p class="text-red-700 text-sm">{form.error}</p>{/if}
</form>
```

```ts
// apps/web/src/routes/submit/service/+page.server.ts
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { lookupStudent } from '$server/students.js';
import { createServiceSubmission, ServiceSubmissionSchema } from '$server/submissions.js';
import { sendSupervisorConfirmation } from '$server/email.js';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const studentId = String(form.get('studentId'));
    const lastName = String(form.get('lastName'));
    const gradYear = Number(form.get('gradYear'));
    const student = await lookupStudent({ id: studentId, lastName, gradYear });
    if (!student) return fail(400, { error: 'No student found with that ID + last name + grad year.' });

    const parsed = ServiceSubmissionSchema.safeParse({
      studentId,
      activityName: form.get('activityName'),
      organization: form.get('activityName'),
      serviceType: form.get('serviceType'),
      hours: Number(form.get('hours')),
      dateStart: form.get('dateStart'),
      dateEnd: form.get('dateEnd'),
      description: form.get('description') ?? '',
      supervisorName: form.get('supervisorName'),
      supervisorEmail: form.get('supervisorEmail'),
      supervisorOrg: '',
    });
    if (!parsed.success) return fail(400, { error: parsed.error.errors[0]?.message ?? 'Invalid input' });

    const result = await createServiceSubmission(parsed.data);
    await sendSupervisorConfirmation({
      to: parsed.data.supervisorEmail,
      supervisorName: parsed.data.supervisorName,
      studentName: `${student.first_name} ${student.last_name}`,
      studentSchool: 'Great Neck Public Schools',
      hours: parsed.data.hours,
      organization: parsed.data.organization,
      dateRange: `${parsed.data.dateStart} to ${parsed.data.dateEnd}`,
      confirmToken: result.confirmationToken,
    });
    return { success: true };
  },
};
```

- [ ] **Step 5: E2E smoke**

```ts
// apps/web/tests/e2e/service-submit.spec.ts
import { test, expect } from '@playwright/test';

test('student submits service hours and sees confirmation banner', async ({ page }) => {
  await page.goto('/submit/service');
  await page.fill('[name=studentId]', 'GN20271234');
  await page.fill('[name=lastName]', 'Goldberg');
  await page.fill('[name=gradYear]', '2027');
  await page.fill('[name=activityName]', 'Long Island Cares');
  await page.fill('[name=dateStart]', '2026-04-15');
  await page.fill('[name=dateEnd]', '2026-04-22');
  await page.fill('[name=hours]', '8');
  await page.selectOption('[name=serviceType]', 'direct');
  await page.fill('[name=supervisorName]', 'J. Patel');
  await page.fill('[name=supervisorEmail]', 'jpatel@licares.org');
  await page.click('button:has-text("Submit hours")');
  await expect(page.locator('text=Hours submitted')).toBeVisible();
});
```

```bash
pnpm exec playwright install chromium
pnpm --filter ./apps/web exec playwright test
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/server/submissions.ts apps/web/src/routes/submit apps/web/tests
git commit -m "feat(submit): service-learning submission with supervisor email"
```

---

### Task 14: Supervisor confirmation page

**Files:**
- Create: `apps/web/src/routes/confirm/[token]/+page.svelte`
- Create: `apps/web/src/routes/confirm/[token]/+page.server.ts`
- Create: `apps/web/tests/unit/confirm.spec.ts`

- [ ] **Step 1: Failing test for confirmation handler**

```ts
// apps/web/tests/unit/confirm.spec.ts
import { describe, expect, it } from 'vitest';
import { confirmHours, disputeHours } from '$server/confirmations.js';
import { supabaseAdmin } from '$server/supabase.js';
import { signToken } from '$server/email.js';

describe('confirmHours', () => {
  it('marks hours_log row as confirmed and writes audit', async () => {
    const { data: sub } = await supabaseAdmin.from('pathway_submissions').insert({
      student_id: 'GN20271234', pathway_type: 'service_learning', status: 'submitted',
    }).select().single();
    const { data: log } = await supabaseAdmin.from('hours_log').insert({
      submission_id: sub!.id, activity_name: 'X', hours: 5,
      date_start: '2026-04-01', date_end: '2026-04-02',
      supervisor_name: 'A', supervisor_email: 'a@b.com',
    }).select().single();
    const token = signToken(log!.confirmation_token);
    const res = await confirmHours({ token, ip: '127.0.0.1' });
    expect(res.ok).toBe(true);
    const { data: after } = await supabaseAdmin.from('hours_log').select('confirmation_status').eq('id', log!.id).single();
    expect(after?.confirmation_status).toBe('confirmed');
  });
});
```

- [ ] **Step 2: Implementation**

```ts
// apps/web/src/lib/server/confirmations.ts
import { supabaseAdmin } from './supabase.js';
import { verifyToken } from './email.js';
import { writeAudit } from './audit.js';

export async function confirmHours(input: { token: string; ip: string | null }) {
  const uuid = verifyToken(input.token);
  if (!uuid) return { ok: false, reason: 'invalid_token' as const };

  const { data: log } = await supabaseAdmin
    .from('hours_log')
    .select('*')
    .eq('confirmation_token', uuid)
    .maybeSingle();
  if (!log) return { ok: false, reason: 'not_found' as const };
  if (log.confirmation_status !== 'pending') return { ok: false, reason: 'already_resolved' as const };

  await supabaseAdmin.from('hours_log').update({
    confirmation_status: 'confirmed',
    confirmation_responded_at: new Date().toISOString(),
    confirmer_ip: input.ip,
  }).eq('id', log.id);

  await writeAudit({
    actorKind: 'supervisor', action: 'supervisor_confirmed_hours',
    targetType: 'hours_log', targetId: String(log.id),
    ip: input.ip, data: { hours: log.hours, supervisor_email: log.supervisor_email },
  });
  return { ok: true as const };
}

export async function disputeHours(input: { token: string; reason: string; ip: string | null }) {
  const uuid = verifyToken(input.token);
  if (!uuid) return { ok: false, reason: 'invalid_token' as const };
  const { data: log } = await supabaseAdmin
    .from('hours_log').select('*').eq('confirmation_token', uuid).maybeSingle();
  if (!log) return { ok: false, reason: 'not_found' as const };
  await supabaseAdmin.from('hours_log').update({
    confirmation_status: 'disputed',
    confirmation_responded_at: new Date().toISOString(),
    confirmer_ip: input.ip,
    confirmation_dispute_reason: input.reason,
  }).eq('id', log.id);
  await writeAudit({
    actorKind: 'supervisor', action: 'supervisor_disputed_hours',
    targetType: 'hours_log', targetId: String(log.id), ip: input.ip,
    data: { reason: input.reason },
  });
  return { ok: true as const };
}
```

- [ ] **Step 3: Confirmation page**

```svelte
<!-- apps/web/src/routes/confirm/[token]/+page.svelte -->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;
</script>

<svelte:head><title>Confirm hours — GNPS Civic Readiness</title></svelte:head>

{#if data.invalid}
  <h1 class="font-display text-xl text-primary mb-2">Link expired or invalid</h1>
  <p>This confirmation link is not valid. Please contact civicseal@greatneck.k12.ny.us if you believe this is an error.</p>
{:else if form?.confirmed || data.alreadyConfirmed}
  <h1 class="font-display text-xl text-primary mb-2">Hours confirmed</h1>
  <p>Thank you. The hours have been recorded toward {data.studentName}'s Seal of Civic Readiness.</p>
{:else if form?.disputed}
  <h1 class="font-display text-xl text-primary mb-2">Dispute recorded</h1>
  <p>A counselor will follow up. Thank you.</p>
{:else}
  <h1 class="font-display text-xl text-primary mb-2">Please confirm {data.hours} hours</h1>
  <p class="mb-4">{data.studentName} listed you as their supervisor for {data.hours} hours at {data.organization} on {data.dateRange}.</p>
  <form method="POST" action="?/confirm" class="inline">
    <button class="bg-secondary text-white px-5 py-2 rounded font-display font-semibold uppercase tracking-wide text-sm">Confirm {data.hours} hours</button>
  </form>
  <details class="mt-4">
    <summary class="text-sm text-primary cursor-pointer">Hours don't match?</summary>
    <form method="POST" action="?/dispute" class="mt-2 max-w-lg">
      <textarea name="reason" placeholder="Correct hours, or describe the discrepancy" rows="2" required class="w-full px-3 py-2 border border-[#c4c8d0] rounded text-sm"></textarea>
      <button class="mt-2 border border-primary text-primary px-4 py-2 rounded font-display font-semibold text-sm">Submit correction</button>
    </form>
  </details>
{/if}
```

```ts
// apps/web/src/routes/confirm/[token]/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { confirmHours, disputeHours } from '$server/confirmations.js';
import { verifyToken } from '$server/email.js';
import { supabaseAdmin } from '$server/supabase.js';

export const load: PageServerLoad = async ({ params }) => {
  const uuid = verifyToken(params.token);
  if (!uuid) return { invalid: true };
  const { data: log } = await supabaseAdmin
    .from('hours_log')
    .select('*, pathway_submissions!inner(student_id, students!inner(first_name, last_name))')
    .eq('confirmation_token', uuid).maybeSingle();
  if (!log) return { invalid: true };
  return {
    invalid: false,
    alreadyConfirmed: log.confirmation_status !== 'pending',
    hours: Number(log.hours),
    organization: log.organization ?? log.activity_name,
    dateRange: `${log.date_start} to ${log.date_end}`,
    studentName: `${(log as any).pathway_submissions.students.first_name} ${(log as any).pathway_submissions.students.last_name}`,
  };
};

export const actions: Actions = {
  confirm: async ({ params, getClientAddress }) => {
    const r = await confirmHours({ token: params.token!, ip: getClientAddress() });
    return { confirmed: r.ok };
  },
  dispute: async ({ params, request, getClientAddress }) => {
    const reason = String((await request.formData()).get('reason') ?? '');
    const r = await disputeHours({ token: params.token!, reason, ip: getClientAddress() });
    return { disputed: r.ok };
  },
};
```

- [ ] **Step 4: Run + test**

```bash
pnpm test && pnpm --filter ./apps/web exec playwright test
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/server/confirmations.ts apps/web/src/routes/confirm
git commit -m "feat(confirm): supervisor confirmation page + audit trail"
```

---

### Task 15: Reflection upload (file storage)

**Files:**
- Create: `apps/web/src/routes/submit/reflection/+page.svelte`
- Create: `apps/web/src/routes/submit/reflection/+page.server.ts`
- Create: `apps/web/src/lib/server/evidence.ts`
- Create: `apps/web/tests/unit/evidence.spec.ts`

- [ ] **Step 1: Failing test for `uploadEvidence`**

```ts
// apps/web/tests/unit/evidence.spec.ts
import { describe, expect, it } from 'vitest';
import { uploadEvidence } from '$server/evidence.js';
import { supabaseAdmin } from '$server/supabase.js';

describe('uploadEvidence', () => {
  it('stores a file in evidence bucket and writes evidence_files row', async () => {
    const { data: sub } = await supabaseAdmin.from('pathway_submissions').insert({
      student_id: 'GN20271234', pathway_type: 'service_learning', status: 'submitted',
    }).select().single();
    const buf = new Uint8Array([0x25,0x50,0x44,0x46]);  // "%PDF" header bytes
    const result = await uploadEvidence({
      submissionId: sub!.id, filename: 'reflection.pdf',
      mimeType: 'application/pdf', kind: 'reflection_essay', bytes: buf, domainTags: ['mindsets','experiences'],
    });
    expect(result.id).toBeGreaterThan(0);
    expect(result.storagePath).toMatch(/^evidence\//);
  });
});
```

- [ ] **Step 2: Implementation**

```ts
// apps/web/src/lib/server/evidence.ts
import { supabaseAdmin } from './supabase.js';
import { writeAudit } from './audit.js';

export interface EvidenceUpload {
  submissionId: number;
  filename: string;
  mimeType: string;
  kind: 'reflection_essay'|'artifact'|'presentation'|'application_essay';
  bytes: Uint8Array;
  domainTags: string[];
}

export async function uploadEvidence(input: EvidenceUpload) {
  const ext = input.filename.split('.').pop() ?? 'bin';
  const path = `evidence/${input.submissionId}/${crypto.randomUUID()}.${ext}`;
  const { error: e1 } = await supabaseAdmin.storage.from('evidence').upload(path, input.bytes, {
    contentType: input.mimeType,
  });
  if (e1) throw e1;
  const { data, error: e2 } = await supabaseAdmin.from('evidence_files').insert({
    submission_id: input.submissionId, storage_path: path, filename: input.filename,
    mime_type: input.mimeType, size_bytes: input.bytes.byteLength, kind: input.kind,
    domain_tags: input.domainTags,
  }).select().single();
  if (e2 || !data) throw e2 ?? new Error('insert failed');
  await writeAudit({
    actorKind: 'student', action: 'student_uploaded_evidence',
    targetType: 'evidence_files', targetId: String(data.id),
    data: { kind: input.kind, size: input.bytes.byteLength },
  });
  return { id: data.id, storagePath: path };
}
```

- [ ] **Step 3: Reflection page (a single textarea, saved as PDF or text)**

(Implementation pattern: form posts the textarea, server endpoint converts to a `text/plain` upload via `uploadEvidence`, OR student uploads a PDF directly. Implement the file-upload path; the typed-textarea path can be added later.)

```svelte
<!-- apps/web/src/routes/submit/reflection/+page.svelte -->
<script lang="ts">
  import type { ActionData } from './$types';
  export let form: ActionData;
</script>
<svelte:head><title>Upload Reflection — GNPS Civic Readiness</title></svelte:head>
<h1 class="font-display text-2xl text-primary mb-2">Upload reflection</h1>
<p class="text-sm text-[#555] mb-4">Required for service-learning, civic projects, and capstone pathways.</p>
{#if form?.success}<p class="text-green-700 mb-4">Reflection uploaded.</p>{/if}
<form method="POST" enctype="multipart/form-data" class="space-y-4 max-w-xl">
  <label class="block">
    <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Submission ID</span>
    <input name="submissionId" required class="w-full mt-1 px-3 py-2 border border-[#c4c8d0] rounded text-sm" />
  </label>
  <label class="block">
    <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Reflection PDF</span>
    <input name="file" type="file" accept=".pdf,.docx" required class="w-full mt-1" />
  </label>
  <fieldset>
    <legend class="text-xs uppercase tracking-wider font-display font-medium text-primary mb-1">Domains addressed (NYSED)</legend>
    {#each ['knowledge','skills','mindsets','experiences'] as d}
      <label class="inline-flex items-center mr-4"><input type="checkbox" name="domains" value={d} class="mr-1" />{d}</label>
    {/each}
  </fieldset>
  <button class="bg-secondary text-white px-5 py-2 rounded font-display font-semibold uppercase tracking-wide text-sm">Upload</button>
</form>
```

```ts
// apps/web/src/routes/submit/reflection/+page.server.ts
import type { Actions } from './$types';
import { uploadEvidence } from '$server/evidence.js';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const submissionId = Number(form.get('submissionId'));
    const file = form.get('file') as File;
    const domains = form.getAll('domains').map(String);
    const buf = new Uint8Array(await file.arrayBuffer());
    await uploadEvidence({
      submissionId, filename: file.name, mimeType: file.type || 'application/octet-stream',
      kind: 'reflection_essay', bytes: buf, domainTags: domains,
    });
    return { success: true };
  },
};
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/server/evidence.ts apps/web/src/routes/submit/reflection
git commit -m "feat(submit): reflection upload with domain tagging"
```

---

### Task 16: Remaining pathway forms (WBL hours, civic project, research, capstone, civic-elective essay)

**Files:**
- Create: 5 sets of `+page.svelte` + `+page.server.ts` under `apps/web/src/routes/submit/{wbl,civic-project,research,capstone,civic-elective}`
- Modify: `apps/web/src/lib/server/submissions.ts` — add `createWblSubmission`, `createProjectProposal` (handles civic-project, research, capstone uniformly), `createCivicElectiveEssay`
- Add: tests

These follow the patterns already established in tasks 13–15:

- WBL = same shape as service-learning but with 40-hour threshold, no service_type field, `pathway_type='wbl_extracurr'`
- civic-project / research / capstone = "proposal" submissions: only the topic-proposal fields (issue, scope, civic-experience plan, advisor, domains). On submit, status = `proposed` (awaiting SCRC approval).
- civic-elective essay = uploads an essay file linked to a course year; pathway_type=`civic_elective_essay`.

- [ ] **Step 1: Add `createWblSubmission` (mirror of `createServiceSubmission`, no service_type)**
- [ ] **Step 2: Add WBL submission page (copy of service form, drop service-type field)**
- [ ] **Step 3: Add `createProjectProposal` for civic-project, research, capstone**

```ts
// excerpt added to submissions.ts
export const ProjectProposalSchema = z.object({
  studentId: z.string(),
  pathwayType: z.enum(['hs_civic_project','research_project','hs_capstone','ms_capstone']),
  issueIdentified: z.string().min(20),
  scope: z.enum(['local','state','national','global']),
  civicExperiencePlan: z.string().min(20),
  advisorName: z.string().min(2),
  domainTags: z.array(z.enum(['knowledge','skills','mindsets','experiences'])).min(1),
});
```

The proposal goes into `pathway_submissions` with `status='proposed'`, fields stored in `notes` as a structured JSON (issue, scope, plan, advisor) — or an additional column if preferred. (Plan: add a `proposal_data jsonb` column via migration `0011_proposal_data.sql`.)

- [ ] **Step 4: Add submission pages for each project type (~3 forms, near-identical structure)**
- [ ] **Step 5: Add civic-elective essay upload (uses `uploadEvidence` with `kind='application_essay'`)**
- [ ] **Step 6: E2E tests for one form per pathway type**
- [ ] **Step 7: Commit**

```bash
git add apps/web supabase/migrations/0011_proposal_data.sql
git commit -m "feat(submit): WBL hours, civic/research/capstone proposals, elective essays"
```

---

## Milestone 3 — Staff portal (Week 3)

End-of-milestone state: counselors and SCRC committee log in via magic link, see queues, approve/reject items. Admin can import IC roster from CSV and edit course catalog.

### Task 17: Magic-link auth + role gates

**Files:**
- Create: `apps/web/src/routes/login/+page.svelte`
- Create: `apps/web/src/routes/login/+page.server.ts`
- Create: `apps/web/src/routes/login/callback/+server.ts`
- Create: `apps/web/src/lib/server/auth.ts`
- Create: `apps/web/src/routes/{counselor,scrc,admin}/+layout.server.ts`

- [ ] **Step 1: Failing role-gate test**
- [ ] **Step 2: Login form (email-only)** — Supabase Auth `signInWithOtp({ email })`
- [ ] **Step 3: Callback handler** — exchanges magic-link code for session
- [ ] **Step 4: Per-role `+layout.server.ts`** — checks `users.role` matches the route segment; on mismatch returns 403
- [ ] **Step 5: E2E test for 403 when wrong role**
- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/login apps/web/src/lib/server/auth.ts apps/web/src/routes/counselor/+layout.server.ts apps/web/src/routes/scrc/+layout.server.ts apps/web/src/routes/admin/+layout.server.ts
git commit -m "feat(auth): magic-link login + per-role route gates"
```

---

### Task 18: Counselor dashboard + roster view

**Files:**
- Create: `apps/web/src/routes/counselor/+page.svelte`
- Create: `apps/web/src/routes/counselor/+page.server.ts`
- Create: `apps/web/src/lib/server/roster.ts` — assembles per-student point totals using `@gnps-civic/pathway-rules`
- Create tests

- [ ] **Step 1: Failing test for `getCohortRoster`**
- [ ] **Step 2: Implement `getCohortRoster` — joins students, course_enrollment (computed for SIS pathways), pathway_submissions (awarded), and runs `computePoints` from pathway-rules**
- [ ] **Step 3: Counselor dashboard renders the table from §3 mockup (name, ID, knowledge col, participation col, total, status pill)**
- [ ] **Step 4: Filtering by counselor caseload (only students where `students.counselor_id = current_user.id`)**
- [ ] **Step 5: Per-student detail page `/counselor/student/[id]` shows full pathway breakdown**
- [ ] **Step 6: E2E test: counselor logs in, sees roster, clicks student, sees breakdown**
- [ ] **Step 7: Commit**

---

### Task 19: Approval queue (counselor)

**Files:**
- Create: `apps/web/src/routes/counselor/queue/+page.svelte`
- Create: `apps/web/src/routes/counselor/queue/+page.server.ts`
- Create: `apps/web/src/lib/server/approvals.ts` — `approveSubmission`, `requestRevision`, `declineSubmission`
- Tests

- [ ] **Step 1: Failing test for `approveSubmission` — sets status='awarded', sets points_awarded, writes audit**
- [ ] **Step 2: Implement approvals.ts**
- [ ] **Step 3: Queue UI: list pending submissions for caseload, inline reflection text, three actions per item**
- [ ] **Step 4: E2E: counselor approves, status updates, audit row exists**
- [ ] **Step 5: Commit**

---

### Task 20: SCRC project proposal review

**Files:**
- Create: `apps/web/src/routes/scrc/+page.svelte`
- Create: `apps/web/src/routes/scrc/proposal/[id]/+page.svelte`
- Create: `apps/web/src/lib/server/scrc.ts` — `approveTopic`, `rejectTopic`, `requestRevisions`, `scoreCompletedProject`
- Tests

- [ ] **Step 1: Test `approveTopic` — status='proposed' → 'topic_approved'**
- [ ] **Step 2: Implement**
- [ ] **Step 3: Review UI: shows proposal_data fields + advisor + domain tags + 4 NYSED essential elements checklist**
- [ ] **Step 4: Score-completed-project flow: rubric form (Appendix F/G/P fields stored in `rubric_scores` JSONB)**
- [ ] **Step 5: E2E**
- [ ] **Step 6: Commit**

---

### Task 21: Admin — CSV import for IC roster + Regents

**Files:**
- Create: `scripts/ic-csv-import/parse.ts`
- Create: `scripts/ic-csv-import/parse.spec.ts`
- Create: `apps/web/src/routes/admin/import/+page.svelte`
- Create: `apps/web/src/routes/admin/import/+page.server.ts`

- [ ] **Step 1: Failing test for CSV parser** — accepts the 5-column shape from spec §4.4, returns typed records (course | regents | demographic)
- [ ] **Step 2: Implement parser using `papaparse`**
- [ ] **Step 3: Server endpoint runs parser → upsert into students/course_enrollment/regents_scores → returns diff (new/updated/unchanged counts)**
- [ ] **Step 4: Admin import UI — file picker, preview table, "Commit import" button (which writes audit row)**
- [ ] **Step 5: E2E: upload sample.csv → see counts → commit → verify rows**
- [ ] **Step 6: Commit**

---

### Task 22: Admin — course catalog editor

**Files:**
- Create: `apps/web/src/routes/admin/courses/+page.svelte`
- Create: `apps/web/src/routes/admin/courses/+page.server.ts`
- Create: `apps/web/src/lib/server/courses.ts`

- [ ] **Step 1: Test `addCourse` writes to course_catalog with `scrc_approved=false`**
- [ ] **Step 2: Implement add/edit/approve actions**
- [ ] **Step 3: UI: table + add-course form + per-course "approve" button (SCRC role only)**
- [ ] **Step 4: Tests for role gate (counselor cannot approve)**
- [ ] **Step 5: Commit**

---

### Task 23: Admin — invite staff users

**Files:**
- Create: `apps/web/src/routes/admin/users/+page.svelte`
- Create: `apps/web/src/routes/admin/users/+page.server.ts`

- [ ] **Step 1: `inviteUser({ email, role, fullName })` test — creates `users` row + sends Supabase Auth invite email**
- [ ] **Step 2: Implement using `supabaseAdmin.auth.admin.inviteUserByEmail`**
- [ ] **Step 3: UI: list staff, invite form, role dropdown**
- [ ] **Step 4: Commit**

---

## Milestone 4 — Export & polish (Week 4)

End-of-milestone state: NYSED audit pack export works end-to-end. README + deployment guide written. Production deployed on Vercel + Supabase under district-paid (or Jon's) accounts. Sample seed for evaluators.

### Task 24: Per-student NYSED PDF generator (TDD)

**Files:**
- Create: `packages/nysed-export/package.json`
- Create: `packages/nysed-export/src/student-pdf.ts`
- Create: `packages/nysed-export/tests/student-pdf.spec.ts`

- [ ] **Step 1: Failing test — `renderStudentPdf({ student, evidence })` returns a `Uint8Array` whose first 4 bytes are `%PDF`**

```ts
import { describe, expect, it } from 'vitest';
import { renderStudentPdf } from '../src/student-pdf.js';

describe('renderStudentPdf', () => {
  it('produces a PDF with the magic header', async () => {
    const buf = await renderStudentPdf({
      student: { id: 'GN20271234', firstName: 'Maya', lastName: 'Goldberg', gradYear: 2027 },
      knowledge: 2.5, participation: 3.5, total: 6,
      submissions: [],
      regents: [],
      enrollment: [],
      auditExcerpt: [],
    });
    expect(buf[0]).toBe(0x25); expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x44); expect(buf[3]).toBe(0x46);
  });
});
```

- [ ] **Step 2: Implementation using `pdf-lib`** — single-page layout: header (district + logo), student block, knowledge column, participation column, evidence list, audit-log excerpt
- [ ] **Step 3: Test that page count ≥ 1 and student name appears in extracted text** (use `pdf-parse` for text extraction)
- [ ] **Step 4: Commit**

---

### Task 25: Roster CSV + zip bundler

**Files:**
- Create: `packages/nysed-export/src/roster-csv.ts`
- Create: `packages/nysed-export/src/zip-bundle.ts`
- Create: `apps/web/src/routes/admin/export/+server.ts`
- Tests

- [ ] **Step 1: Test `rosterCsv(students)` returns RFC 4180 CSV with header `student_id,last_name,first_name,grad_year,knowledge,participation,total,status`**
- [ ] **Step 2: Implement using a lightweight CSV writer (no dependency)**
- [ ] **Step 3: Test `bundleZip({ pdfMap, rosterCsv, awardedCsv, evidenceFiles, auditCsv })` returns a Uint8Array zip**
- [ ] **Step 4: Implement using `fflate` (zero-dep, fast)**
- [ ] **Step 5: Server route `/admin/export?cohort=2027` — auth-gates as admin, streams the zip to the browser**
- [ ] **Step 6: E2E: admin clicks export, gets a `nysed_audit_pack_class_of_2027.zip`**
- [ ] **Step 7: Commit**

---

### Task 26: README + onboarding docs

**Files:**
- Create: `README.md`
- Create: `LICENSE` (MIT)
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `docs/deployment-guide.md`
- Create: `docs/data-import-guide.md`
- Create: `docs/customization.md`
- Create: `config/district.yaml`

- [ ] **Step 1: README** — what this is · screenshots · quick-start · NYSED handbook reference · where to look for what
- [ ] **Step 2: LICENSE** — boilerplate MIT
- [ ] **Step 3: CONTRIBUTING** — peer-district fork instructions, focus on `config/district.yaml`
- [ ] **Step 4: SECURITY** — disclosure email + 90-day window
- [ ] **Step 5: deployment-guide** — `supabase login → supabase link → supabase db push` + `vercel deploy` + env vars to set
- [ ] **Step 6: data-import-guide** — CSV column reference + sample row + how the IC export gets shaped
- [ ] **Step 7: customization** — explains district.yaml fields (logo URL, primary color, secondary color, district name, support email, course-catalog seed)
- [ ] **Step 8: config/district.yaml** — GNPS defaults populated; comment block at top explaining
- [ ] **Step 9: Commit**

```bash
git add README.md LICENSE CONTRIBUTING.md SECURITY.md docs/deployment-guide.md docs/data-import-guide.md docs/customization.md config/district.yaml
git commit -m "docs: README, LICENSE, district customization config + deployment + import guides"
```

---

### Task 27: Vercel + Supabase prod deploy

**Files:**
- Modify: `apps/web/svelte.config.js` (already configured for Vercel)
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-prod.yml`

- [ ] **Step 1: Create Vercel project (one-time)**

```bash
pnpm dlx vercel link
pnpm dlx vercel env add PUBLIC_SUPABASE_URL production
pnpm dlx vercel env add PUBLIC_SUPABASE_ANON_KEY production
pnpm dlx vercel env add SUPABASE_SERVICE_ROLE_KEY production
pnpm dlx vercel env add RESEND_API_KEY production
pnpm dlx vercel env add EMAIL_FROM production
pnpm dlx vercel env add SIGNED_LINK_SECRET production
pnpm dlx vercel env add PUBLIC_APP_URL production
```

- [ ] **Step 2: Create Supabase project (one-time), link locally**

```bash
supabase login
supabase projects create gnps-civic-readiness
supabase link --project-ref <ref>
supabase db push
```

- [ ] **Step 3: GitHub Actions CI**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start
      - run: supabase test db
      - run: pnpm typecheck
      - run: pnpm test
```

- [ ] **Step 4: Deploy production**

```bash
pnpm dlx vercel deploy --prod
```

Expected: prints production URL.

- [ ] **Step 5: Smoke test production**

E2E test against the deployed URL — student submission → email lands → confirm link works.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows
git commit -m "chore: CI workflow + production deploy notes"
```

---

### Task 28: Final smoke test pass

- [ ] **Step 1: Run full test suite**

```bash
pnpm typecheck && pnpm test && pnpm --filter ./apps/web exec playwright test
```

Expected: all green.

- [ ] **Step 2: Manual end-to-end run-through on production URL**

- Land on home page (themed) ✓
- Submit service-learning hours (using a seeded test student) ✓
- Receive supervisor confirmation email at a real address ✓
- Click confirm link, confirmation banner shows ✓
- Counselor logs in via magic link ✓
- Counselor sees the submission in queue, approves it ✓
- Admin imports a sample CSV, sees diff, commits ✓
- Admin exports class of 2027 audit pack, opens the zip ✓

- [ ] **Step 3: Tag release**

```bash
git tag v0.1.0-phase1 -m "Phase 1 pilot release"
git push --tags
```

- [ ] **Step 4: Commit final notes**

```bash
echo "Phase 1 shipped $(date)" >> docs/RELEASE-NOTES.md
git add docs/RELEASE-NOTES.md
git commit -m "chore: Phase 1 release notes"
```

---

## Done definition for Phase 1

✅ Public landing page is themed and live on a public URL
✅ All 6 pathway-type submission flows work end-to-end
✅ Supervisor email confirmation round-trip works
✅ Counselor approval queue works end-to-end
✅ SCRC project review (proposal + scoring) works end-to-end
✅ Admin can import IC CSV and edit course catalog
✅ Admin can invite staff users
✅ NYSED audit pack export produces zip with per-student PDFs + roster CSV + evidence files + audit log
✅ Audit log captures every state transition
✅ All migrations versioned and tested
✅ CI green; production deployment automated
✅ README + deployment + import + customization docs present
✅ MIT license file in repo

## Phase 2 deferral list

These are explicitly OUT of scope for Phase 1. Phase 2 plans will pick up from here:

- Student-facing portal (live progress, self-service)
- District SSO (ClassLink / Google / Azure)
- Live Infinite Campus integration (OneRoster API or nightly export)
- Family-visible read-only progress
- Mobile-first redesign pass
- Migrating from Supabase free tier to district-paid Supabase or self-hosted Postgres
- Custom domain CNAME (`civicseal.greatneck.k12.ny.us`) — that's a 5-min IT task triggered when leadership approves promotion
- SPF/DKIM on `civicseal@greatneck.k12.ny.us` — Phase 2 IT brief item #6
