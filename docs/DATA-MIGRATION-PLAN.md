# Production data migration plan (Lovable → new Supabase project)

**Status: LOADED into the new project (2026-10-31); all automated checks pass. Waiting on Chad's sign-in, logo re-upload and the payroll CSV comparison before go/no-go.** Lovable stays live until go-live.

## Chad's decisions (2026-10-31)

| Question | Decision |
| --- | --- |
| Export | Lovable database backup `tip-tally-pro_261031-DatabaseBK.backup` (pg_dump custom format, taken 2026-10-31 12:36 UTC from PostgreSQL 17.6). It is the export for the load: "current for now". Kept only in the session's scratch folder, never the repo. |
| Locations | Only Carson's Table. The export also has a second location, "Kevin's" (created 07-30, settings and a logo, no staff or shifts); it is **left behind**. |
| Logins | All three production logins (same ids), plus Chad's login, which joins Carson's Table as a **manager**. Production roles are copied as they are (two admins). |
| Passwords | **Carried over:** the export holds the password hashes, so everyone keeps their current password and no "set your password" emails are needed for the switch. |
| Texting | Not set up; on hold. |
| Address | Keep `tip-tally-pro.onrender.com`. |
| Cutover | Load the current backup now. |

### What the export showed
- All 210 shifts match `fixtures/inputs.json` input for input (tips, cash, sales, overrides, split modes, support hours). Production staff ids sorted ascending are S01–S24, which lets the check compare the migrated payroll directly with `expected_v1.json`.
- Raw credit tips $66,220.80 (as in the fixtures). The $66,220.83 printed by the checks is the engine's allocated total, a different number.
- 4,404 override-history rows, 1 settings-history row, 0 texts, 2 expired invites (not copied).
- Logo images are not in a database dump (only their storage records). After the load, re-upload the Carson's Table logo in Admin.
- Not copied: sessions and tokens, `vault.secrets`, Lovable's export bucket, the other location.

## The loader: `harness/db/remote-migrate.sh`

| Command | What it does |
| --- | --- |
| `inspect <backup>` | Locations, login count and row counts in the export |
| `load <backup> <location-id> <operator-email>` | One transaction. Refuses if any location exists or any export login (id or email) exists. Copies the location and everything under it plus all logins, same ids and every column; pauses app triggers on the public tables and turns them back on before commit; replaces the profile and role rows the `auth.users` triggers create with the exported ones; adds the operator as manager; sets `app_settings_id_seq`; checks every row count before committing. |
| `check <backup> <location-id> <operator-email>` | Row counts and checksums per table against the export, then the payroll engine on the migrated rows against `fixtures/expected_v1.json` (per shift and period totals to the cent) |
| `wipe <backup> <location-id>` | Removes the migrated location and logins (no-go or redo) |

The backup is unpacked with PostgreSQL 17's `pg_restore` into a private temp folder that is deleted on exit. The generator is `harness/db/migrate-export.ts`.

### Local rehearsal (2026-10-31)
On `supabase/postgres:17.4.1.020` + snapshot + logo storage + an operator login + seeded fixtures, i.e. the hosted project's state:
- `load` while the fixtures are present: refused. After `remote-seed.sh reset`: loaded.
- `check`: every table matches the export (19 tables incl. `auth.users`, `auth.identities`); 210 of 210 shifts and 240 of 240 period totals equal `expected_v1.json`; credit tips $66,220.83, take-home $65,883.01.
- `remote-baseline.sh verify` and `remote-storage.sh verify` still match (triggers back on).
- Negative control: one server's credit tips +$0.01 makes `check` fail on `shift_servers`.
- `wipe` leaves 0 locations, staff and audit rows and only the operator login; a second `load` + `check` pass again.

### Hosted steps
1. `harness/db/remote-seed.sh reset` (removes the fixture location; Chad's login stays).
2. `harness/db/remote-migrate.sh load <backup> <Carson's Table location id> chadhowell11@gmail.com`
3. `harness/db/remote-migrate.sh check …`, `remote-baseline.sh verify`, `remote-storage.sh verify`.
4. Chad: sign in, re-upload the logo in Admin, download the payroll CSV for a recent pay period from both Lovable and the new app; Claude diffs them (must match to the cent). Then go/no-go.

### Hosted load (done 2026-10-31)
- Before: `remote-baseline.sh check` (Tip-Tally-Pro, PG17, 17 tables), `remote-baseline.sh verify`, `remote-storage.sh verify` and `remote-seed.sh check` all passed.
- `remote-seed.sh reset`, then `remote-migrate.sh load`: loaded in one transaction.
- `remote-migrate.sh check`: every table matches the export (row counts and checksums, incl. the 3 logins and their identities); 210 of 210 shifts and 240 of 240 period totals equal `expected_v1.json`; credit tips $66,220.83, take-home $65,883.01.
- After: `remote-baseline.sh verify` and `remote-storage.sh verify` match; no app trigger left disabled; 4 logins (3 production + Chad), 1 location (Carson's Table) with its owner and Chad as manager.
- Left over: one file in the `logos` bucket from Chad's earlier test upload under the removed fixture location's folder. Harmless, nothing points to it.
- The local rehearsal database and unpacked copies are deleted. The backup file stays in the session's scratch folder until go/no-go (`wipe` needs it), then is deleted.

Still to do (acceptance test 2): Chad signs in, re-uploads the logo in Admin, and downloads the payroll CSV for a recent pay period from Lovable and from the new app; the two files must match to the cent. Then go/no-go.

## Goal and acceptance test

Move Carson's Table's live data from Lovable's production database into the new project (`mmutdqklchnftziikqpq`), then switch staff over.

The migration is accepted only if all three hold:
1. **Row counts and checksums:** every migrated table has the same row count and the same per-table checksum as the export.
2. **Payroll CSV to the cent:** for one recent pay period, the new app's "Download CSV" file is identical to Lovable's file for the same dates. Every staff row and the TOTAL row must match, and every column must agree to the cent.
3. **Engine check over all history:** the payroll engine run over all migrated shifts gives the same totals as Lovable's report for the full date range.

If any check fails, we don't switch. Nothing is ever written to Lovable, so the fallback is simply to keep using it.

## What moves

| Data | Rows (approx.) | How |
| --- | --- | --- |
| `locations`, `app_settings` | 1 + 1 | Same ids. Settings exactly as in Lovable, including pay-period and SMS settings. |
| `staff`, `staff_positions` | 24 + any | Same ids. Real names, server numbers, emails and phones go into the **database only**, never the repo. |
| `shifts`, `shift_servers`, `shift_server_members`, `shift_bartenders`, `shift_bartender_members`, `shift_support` | 210 / 370 / … / 202 / … / 146 as of 10-30 | Same ids and every column, including `total_sales`, overrides and `created_at`. |
| `tip_override_audit`, `settings_audit` | as exported | History copied as is, so the audit panel shows the same past edits. |
| `sms_sends` | as exported | Sent-text history. |
| `location_members`, `user_roles`, `profiles`, `location_invites` | small | Re-pointed to the new logins (see "Logins"). Open invites are not copied; re-send any that are still needed. |
| Logo file | 1 | Download from the Lovable app and upload to the same path in the new `logos` bucket (`app_settings.logo_url` keeps its value). |

Production's `database_export_31_10_26` bucket is a Lovable export artifact and is not copied.

**Keeping every id** means the shift ↔ entry ↔ staff links, the audit history and the logo path all carry over unchanged.

## Logins

Lovable doesn't export passwords, so nobody's old password works in the new system.

- **Plan:** create each manager/owner login in the new project with the **same user id** as in Lovable, with no password. Then send each person a "set your password" email. The same id means memberships, roles, profiles and audit "changed by" references need no rewriting.
- **How:** the Supabase Admin API (create user with a given id, email confirmed). This is checked in the rehearsal. If the API won't accept a given id, the fallback is new ids plus a mapping table that rewrites the 8 columns that hold user ids (`locations.owner_user_id`, `location_members.user_id`, `user_roles.user_id`, `profiles.user_id`, `location_invites.invited_by`, `settings_audit.changed_by`, `tip_override_audit.changed_by`, `sms_sends.sent_by`).
- **Your current test login** (`chadhowell11@gmail.com`) is removed with the fixture data before the load. If the same email is also a production login, the production one replaces it.
- **Depends on:** a real email-sending service connected to Supabase (see "Before the migration"). Without it, the "set your password" emails hit Supabase's test limit of a few emails an hour.

## How the load works

1. **Remove the fixture data:** `harness/db/remote-seed.sh reset`, and delete the test login. The new project then has the production schema and nothing else.
2. **One transaction, all or nothing.** Rows are inserted in dependency order: logins, then location, settings, staff, shifts, entries, members, support rows, audits, texts.
3. **App triggers are paused inside that transaction** and turned back on before it commits (`ALTER TABLE … DISABLE TRIGGER USER`). Otherwise the database would invent rows that don't belong in the copy:
   - default settings for the new location
   - an automatic admin grant for the first login
   - an override-audit row for every override
   - a settings-audit row for the settings
   - fresh `updated_at` timestamps

   Foreign-key checks stay on the whole time.
4. **Sequence:** `app_settings_id_seq` is set past the highest migrated id.
5. **Afterwards:** `remote-baseline.sh verify` and `remote-storage.sh verify` must still match production, which confirms the triggers are back on. Then come the counts, checksums and payroll checks above.

The load runs through the same Management API path as the baseline and seed: a short-lived access token that you revoke afterwards. The production export passes through this cloud session only: it lives in the session's scratch folder, never in the repo, and is deleted after the load.

## Steps and timeline

| # | Step | Who |
| --- | --- | --- |
| 0 | Approve this plan. Answer the open questions below. | Chad |
| 1 | **Before the migration:** connect an email service to Supabase; upgrade the Supabase plan (see below). Logo storage: done. | Chad + Claude |
| 2 | Take a **rehearsal export** from Lovable and give it to the session. | Chad |
| 3 | Write the loader and verification scripts, and rehearse on local Postgres. Then rehearse on the new project: load, run every check, then wipe it back to empty. Report the results. | Claude |
| 4 | Pick a cutover time when nobody enters shifts (after close). Tell managers: no entries in Lovable from that time. | Chad |
| 5 | **Cutover:** final export from Lovable; Chad downloads Lovable's payroll CSV for the most recent pay period. Claude loads and runs all checks. | Chad + Claude |
| 6 | Chad downloads the same CSV from the new app; Claude diffs the two files. Chad spot-checks 3 shifts side by side. | Chad + Claude |
| 7 | **Go/no-go.** Go: send password emails, share the new address, and Lovable becomes read-only reference. No-go: wipe the new project; staff keep using Lovable. | Chad |

## Before the migration

- **Email service:** Resend, Postmark or SendGrid, set in Supabase → Authentication → SMTP, with a sender address you control. This is needed for "set your password" emails.
- **Supabase plan:** free projects pause after a week of inactivity and have no point-in-time backups. Live payroll needs the Pro plan, with backups on.
- **Logo storage:** done 2026-10-31 (`remote-storage.sh apply` + `verify` match production).
- **Texting:** if Carson's Table sends shift texts, switch to Twilio directly before cutover.
- **Address:** `tip-tally-pro.onrender.com` or a custom domain. Today staff use `tip-tally-pro.lovable.app`.

## Open questions for Chad

1. **The export:** what do you have, or what can Lovable produce? The fixtures came from a "production backup 2026-10-31". The loader needs every row of the 17 public tables (SQL dump, CSV per table or JSON are all fine), plus the list of logins (user id, email).
2. **Logins:** who needs to sign in after cutover? Owners and managers only, or staff too?
3. **Texting:** used at Carson's Table? Before or after cutover?
4. **Cutover window:** which day and time works for a pause in shift entry?
5. **Address:** keep the Render address or set up a custom domain?

## Rules this plan follows

- No production rows in the repo or in fixtures; credentials stay in environment secrets.
- No schema, RLS or calculation change. The database is the production snapshot; triggers are paused only inside the load transaction.
- Nothing connects to Lovable's database. The export is something Chad provides.
