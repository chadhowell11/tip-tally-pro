## What exists today

Signup is a single email/password form, then a one-field "Establishment name" screen that drops you straight into Admin. Two problems for paying customers:

- No place to add a logo, other admins/managers, pay periods, or basic tip rules — they have to hunt for them later.
- Settings are still stored as one shared row (`app_settings` id = 1) rather than one per establishment, so a second customer signing up would overwrite the first one's percentages. This has to be fixed as part of the signup work.

## The signup flow

A six-step wizard with a progress bar. Every step after the first has **Skip for now**, and the wizard remembers where you left off so a skipped step can be finished later from Admin (a "Finish setup" banner appears until all steps are done).

```text
1  Create account      email + password (or Google)
2  Your establishment   company name, type (restaurant/bar/hotel),
                        timezone, address (optional)
3  Branding             logo upload (optional) — shows on printed
                        daily reports and payroll reports
4  Your team            invite admins and managers by email, each
                        with a role: Owner / Admin / Manager
5  Pay periods          weekly / bi-weekly / semi-monthly / monthly,
                        plus period start date
6  Tip rules            bar %, support %, bartender %, payout cap,
                        rounding — prefilled with sensible defaults
   -> Finish            lands on Admin with the staff importer open
```

## What I'd add beyond your list

- **Timezone** — this is what makes "today's shift" and nightly reports land on the right day. Worth capturing up front.
- **Establishment type** — lets the wizard preload a sensible role set and percentages (a bar doesn't need bussers by default).
- **Roles step** if we do the custom-roles work: confirm/adjust the role list right in the wizard rather than after.
- **Staff roster import as the finish line** — the last screen offers "Import from Excel" or "Add staff manually" so a new customer ends setup with a usable app, not an empty one.
- **Invite links rather than password creation** — you enter a manager's email, they get a link, they set their own password. Safer than an owner typing passwords for staff.
- **A "Setup checklist" card on Admin** showing what's still unfinished (logo, pay period, staff) with a link to each step.
- **Free-trial framing** — the wizard is the natural place to say "14-day trial, no card needed", which sets you up for the Stripe billing step later.

## Technical details

Migration:
- Move `app_settings` off the singleton row: drop the `id = 1` assumption, make `location_id` NOT NULL and unique, and create a settings row per location. Backfill the existing row to the current location.
- Add to `locations`: `logo_url`, `timezone` (default `America/New_York`), `establishment_type`, `address`, `setup_completed_at`, and `setup_steps jsonb` for tracking which steps were skipped.
- Add `pay_period_type` (`weekly` | `biweekly` | `semimonthly` | `monthly`) and `pay_period_anchor date` to `app_settings`.
- New `location_invites` table: `id, location_id, email, role, token, invited_by, accepted_at, expires_at`, with GRANTs and RLS so only admins of that location can create or view invites.
- Trigger on `locations` insert that creates the matching `app_settings` row (and, later, the default roles), so new signups are never missing config.

Storage:
- New public `logos` bucket for logo uploads, with an upload policy restricted to admins of the owning location.

Code:
- Replace `src/routes/_authenticated/onboarding.tsx` with a wizard: one component per step under `src/components/onboarding/`, shared state in the parent, each step writing its slice on Next so progress survives a refresh.
- Public `/invite/$token` route that accepts an invite, creates the `location_members` row, and routes into the app.
- `SetupChecklist` component rendered on Admin until `setup_completed_at` is set.
- All existing reads of `app_settings` (`admin.tsx`, `shift.new.tsx`, `reports.tsx`, `daily.tsx`) switch from `.eq("id", 1)` to filtering by the caller's `location_id`.

## Rollout order

1. Migration: per-location settings, new location fields, pay periods, invites table, logo bucket, auto-create trigger
2. Point all existing settings reads at the caller's location
3. The wizard itself (steps 2-6) with skip + resume
4. Invite emails and the `/invite/$token` acceptance route
5. Setup checklist on Admin
6. Logo on printed daily and payroll reports
