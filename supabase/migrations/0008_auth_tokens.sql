-- Magic-link auth tokens for the self-hosted login flow.
--
-- Replaces the Supabase Auth dependency with a token table the SvelteKit
-- server owns end-to-end:
--
--   1. POST /login            → issueAuthToken(email)  → row inserted
--                              → SMTP sends link with the raw token
--   2. GET  /auth/callback?token=… → consumeAuthToken(token)
--                              → row marked consumed_at, JWT cookie set
--
-- Tokens are stored as a SHA-256 hash so a leaked DB row doesn't reveal a
-- usable token. Rows survive consumption for audit; the consume path checks
-- both `expires_at > now()` and `consumed_at IS NULL`.

create table if not exists public.auth_tokens (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  ip inet,
  user_agent text
);
create index if not exists auth_tokens_email_idx on public.auth_tokens (email);
create unique index if not exists auth_tokens_token_hash_idx on public.auth_tokens (token_hash);

alter table public.auth_tokens enable row level security;
