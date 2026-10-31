# Production data migration plan (Lovable → new Supabase project)

**Status: DRAFT for Chad's approval (2026-10-31).** Nothing in this plan runs until Chad approves it in writing (CLAUDE.md, "New environment rules"). Lovable stays live, and Carson's Table keeps using it until cutover.

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
| 1 | **Before the migration:** connect an email service to Supabase; upgrade the Supabase plan (see below); logo storage applied (`remote-storage.sh`). | Chad + Claude |
| 2 | Take a **rehearsal export** from Lovable and give it to the session. | Chad |
| 3 | Write the loader and verification scripts, and rehearse on local Postgres. Then rehearse on the new project: load, run every check, then wipe it back to empty. Report the results. | Claude |
| 4 | Pick a cutover time when nobody enters shifts (after close). Tell managers: no entries in Lovable from that time. | Chad |
| 5 | **Cutover:** final export from Lovable; Chad downloads Lovable's payroll CSV for the most recent pay period. Claude loads and runs all checks. | Chad + Claude |
| 6 | Chad downloads the same CSV from the new app; Claude diffs the two files. Chad spot-checks 3 shifts side by side. | Chad + Claude |
| 7 | **Go/no-go.** Go: send password emails, share the new address, and Lovable becomes read-only reference. No-go: wipe the new project; staff keep using Lovable. | Chad |

## Before the migration

- **Email service:** Resend, Postmark or SendGrid, set in Supabase → Authentication → SMTP, with a sender address you control. This is needed for "set your password" emails.
- **Supabase plan:** free projects pause after a week of inactivity and have no point-in-time backups. Live payroll needs the Pro plan, with backups on.
- **Logo storage:** `harness/db/remote-storage.sh apply`, then `verify` (built; needs a token to run).
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
