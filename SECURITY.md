# Security policy

## Reporting a vulnerability

Please email **civicseal@greatneck.k12.ny.us** with details. Do not file a public GitHub issue.

We follow a 90-day responsible-disclosure window: we'll acknowledge within 5 business days, work on a fix, and publish an advisory + credit you (with permission) once the fix ships.

## In scope

- Authentication / authorization bypass (counselor / SCRC / admin role gates)
- FERPA-relevant data exposure (student records, evidence files, supervisor emails)
- Remote code execution
- SQL injection
- Cross-site scripting in submission or staff-facing UIs
- Insecure direct object references (e.g., predictable confirmation tokens)

## Out of scope

- Denial-of-service against the free-tier hosting (Vercel / Supabase / Resend)
- Social engineering of staff
- Issues that require physical access to a staff member's machine
- Reports against the design document or non-code artifacts
