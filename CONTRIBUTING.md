# Contributing

Welcome — and especially welcome to other New York districts evaluating, adopting, or improving this portal.

## Code of conduct

Short version of [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) applies. Be respectful. Be patient with anyone whose first PR this is.

## Development setup

See [Quick start in the README](README.md#quick-start-local-development).

## Project structure

```
apps/web/                   SvelteKit application — UI + server endpoints
packages/pathway-rules/     NYSED point-computation engine (pure TS, no SvelteKit)
packages/nysed-export/      Year-end audit-pack generator (PDF + CSV + zip)
supabase/migrations/        Versioned SQL schema migrations
scripts/ic-csv-import/      Reference CSV importer for IC data
config/district.yaml        District-specific branding & seed config
docs/                       Design specs, plans, deployment + customization guides
dist/                       Polished forwardable PDFs/DOCX of the design and IT brief
```

## Branch model

- All work in feature branches off `main`
- PRs require CI green + at least one review
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Commit messages should describe the *why*, not the *what*

## Testing

- Pathway-rules logic: Vitest, full TDD expected
- Submission flows: server-action tests + Playwright E2E for one happy path
- Run: `pnpm test` at the root

## For non-engineers

Open an issue. Use the issue templates if available. We read every issue.

## For other districts

The cleanest path to adoption is:

1. Fork the repo
2. Edit `config/district.yaml` — colors, logo URL, support email, course catalog seed, SCRC committee emails
3. Follow [docs/deployment-guide.md](docs/deployment-guide.md) for your own Supabase + Vercel projects
4. Submit a PR back if you build something other districts could reuse (e.g., a new SIS importer beyond Infinite Campus, a new export format, a translation)

Improvements that are district-agnostic should always go upstream. District-specific things stay in your fork's `config/district.yaml`.
