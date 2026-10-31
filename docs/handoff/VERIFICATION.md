# Handoff verification and limitations

Created in project-root docs, as requested. No application source, financial behavior, schema or business rows were changed. All schema reads were read-only. SQL is a schema reconstruction for review, NOT executed against a destination.

## Deliverables
- ARCHITECTURE.md: all15 requested sections, full live catalog, core quoted implementation,19 executed worked examples, calculations and known defects.
- SCREENS.md:131 numbered state/capture-plan entries, plus exhaustive responsive/role variant matrices.
- schema.sql:17 public tables,161 columns,59 constraints,45 live indexes (constraint indexes implicit),5 enums,1 sequence,14 functions,15 triggers, public RLS and decoded grants. Managed storage policies reference-commented.
- DATABASE.md: catalog appendix with exact policies/functions/triggers/defaults/indexes.
- FINANCIAL_AUDIT.md: report/form/SMS calculations and confirmed inconsistencies.
- FINANCIAL_SOURCE.md: exact line-annotated relevant source including calculation consumers/print/download/audit.
- CALCULATION_EXAMPLES.json:19 real execution outputs against current module; synthetic inputs, not production records.
- SOURCE_MANIFEST.json: hashes for financial source snapshot.
- MIGRATIONS.md:31 local chronological migrations and32 live ledger versions. Historical record UUIDs/emails redacted in reference bodies; filename suffixes preserved. Not an executable migration concatenation.
- screenshots/:6 real PNG captures for entries01–06, individually opened and visually inspected; no browser page errors.

## UNVERIFIED — every category
1. Precise production hosting/runtime/publication, clean target build/deploy (§2).
2. Managed auth/storage internals, cluster roles/ownership/default privileges, storage objects/backup contents, target SQL execution (§5,11).
3. Hosted email/signup/Google settings, OAuth redirect allowlists, cross-role runtime enforcement, multi-location behavior (§6,11).
4. Nonfinite/negative persistence acceptance, intended biweekly missing-anchor semantics, timezone boundaries (§7).
5. Interrupted/unload saves, cross-user concurrency, rollback/return-order guarantees (§9).
6. Deployed edge-function inventory, SMS configuration/sender/connectivity/delivery/rate/abuse and billing (§10–11).
7. Signed-in desktop/mobile layouts, logo color extraction/canvas/CORS across browsers (§12).
8. Print dialog/pagination/physical printing/blank-report regression, CSV target-browser delivery and downstream spreadsheet behavior (§13).
9. Clean historical migration replay, missing original audit/hostess SQL and local-version/ledger mapping (§15).
10. All SCREENS entries07–131 are SKIPPED/UNVERIFIED, including authenticated, destructive, native-provider, installation and print states.

## Screenshot truthfulness
01–06 are real localhost Chromium captures: public home/signin/signup/password-toggle; desktop1280×1800, mobile390×844. No placeholder, generated or mocked images. Password field empty. Remaining captures skipped: no authenticated session for the requesting user; own-account session mint returned no matching account. No other user's session selected; no credentials requested or printed. Capture plans require isolated mocks/test setup because shift typing autosaves and invite opening accepts automatically. Authenticated flows were NOT verified.

## Migration portability and security
schema.sql relies on preexisting managed auth/storage schemas/functions/roles. Public grant MAINTAIN may require a compatible PostgreSQL version. Owner/internal diagnostic grants and object contents omitted intentionally. Missing catalog-only objects included directly. No credentials, live financial rows or storage binaries are exported. Generated schema must be reviewed in disposable destination first. Confirmed financial differences are documented, not silently repaired.
