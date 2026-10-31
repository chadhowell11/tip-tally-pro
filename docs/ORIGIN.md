# Origin of this repository

- Seeded 2026-10-31 from `tip-tally-pro-CodeBK.zip`, a full code export of the Lovable project behind the live Carson's Table app. Lovable commit history was not included.
- `.env` was removed. It pointed at the production Supabase project on Lovable Cloud.
- `supabase/config.toml` `project_id` was replaced with a placeholder so the Supabase CLI cannot be linked to production by accident.
- `src/lib/calculations.ts` sha256 at import: `481e6d903211fecb1749cefca19016fcfedc0e7c5222347b23806eb4ad7443d7`. It matches Lovable's `docs/handoff/SOURCE_MANIFEST.json`.
- The production database backup is NOT in this repo. `fixtures/` holds a scrubbed derivative: staff are pseudonymized S01–S24, and there are no names, emails, or phones.
- `docs/handoff/` is Lovable's own handoff package. Treat it as a description, not as truth. Where it disagrees with the code, the code wins.
