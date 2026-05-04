# Customization — adopting this portal for your district

Districts can fork this portal, replace a small set of brand and seed values in `config/district.yaml`, and have a working portal under their own brand within a deploy cycle. No source-code changes required for ordinary customization.

## What you change in `config/district.yaml`

| Field | Example | Notes |
|---|---|---|
| `district_name` | `Seaford Union Free School District` | Shown in headers, footers, emails |
| `district_short_name` | `Seaford UFSD` | Shorter form for narrow contexts |
| `district_url` | `https://www.seaford.k12.ny.us/` | Footer link back to district homepage |
| `support_email` | `civicseal@seaford.k12.ny.us` | Listed in the footer and supervisor emails |
| `logo_url` | `https://your-cms.example.com/logo.png` | Round logo, ~512px square preferred |
| `colors.primary` | `#003366` | Used for the navy header bar |
| `colors.secondary` | `#FF7F50` | Used for primary CTAs and accent stripes |
| `fonts.display` | `Outfit` | Heading font; must be available on Google Fonts |
| `fonts.body` | `Roboto` | Body font; same constraint |
| `graduation_class_seed` | `2027` | Most senior class to seed on first deploy |
| `course_catalog_seed` | array | The civic-engagement-eligible courses you offer |
| `scrc_committee` | array of emails | The Civic Readiness Committee members for staff invites |

## Step-by-step

```bash
# 1. Fork on GitHub
# 2. Clone your fork locally
git clone https://github.com/<your-org>/gnps-civic-readiness
cd gnps-civic-readiness

# 3. Edit config/district.yaml — replace GNPS values with yours
nano config/district.yaml

# 4. Replace the cached logo (optional but recommended for offline branding)
# Place your district's round logo at apps/web/static/district-logo.png
# or update the logo_url in district.yaml

# 5. Follow the deployment guide
#    See docs/deployment-guide.md
```

## What you do NOT change

- Pathway logic in `packages/pathway-rules/` — this implements NYSED rules; do not modify
- NYSED export format in `packages/nysed-export/` — designed to match NYSED audit expectations
- Database schema in `supabase/migrations/` — keep migrations append-only

If you find a bug or a genuine improvement in any of the above, please open a PR to upstream rather than fork-modify — every district benefits.

## Translation

Phase 1 ships in English only. If your district has translation needs (Mandarin, Spanish, Korean for many Long Island districts including Great Neck), open an issue describing your translation strategy. We're open to upstreaming an i18n layer if more than one district needs it.

## Going further

If your district has needs that don't fit the model (e.g., a different SIS than Infinite Campus, a different state's seal program), the cleanest path is:

1. Open an issue describing your use case
2. We'll discuss whether the change belongs upstream (with a flag/option) or as a more substantive fork
3. If upstream, we'll review a PR; if fork, we'll point you at the right hooks to extend cleanly without diverging from the core
