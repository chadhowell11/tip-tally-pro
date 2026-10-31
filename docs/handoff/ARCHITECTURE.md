# Tip Share — technical handoff

Snapshot: **2026-10-31 UTC**. This documents the current code and a read-only current database catalog, not prior chat claims or the stale `.lovable/plan.md`. Accuracy precedes intent. No business records or application source/behavior were changed for this handoff. Dependency declarations below reflect the existing application configuration; no financial fix was applied.

## 1. Overview
Tip Share records restaurant AM/PM cashouts, calculates server→bar and server/bar→support tip-outs, splits cashouts across people, prepares house cash-deposit totals, and produces daily/payroll/individual/trend reports. Owners/admins configure staff and default tip rules; managers enter shifts; staff membership exists but is not a dedicated self-service portal. Shared support roles: runner, busser, bar_back, hostess. Servers/bartenders can share a cashout equally or by hours. Employees have names and employee/server numbers, contact fields and multiple qualified positions.

End-to-end: sign up/sign in → create establishment + owner membership → logo/team/pay-period/tip-rule/staff wizard → select shift date/AM or PM → add cashout entries/member splits/support positions → input raw cash/sales/credit tips → calculate → optionally override tip-outs → autosave/manual save → view/edit shift → daily report/print/text action → payroll date range/person summaries/CSV → admin audit. Reports recompute historical entries with CURRENT settings; they do not store final payroll payouts or immutable rate snapshots. SMS is an explicit action, not a confirmed automatic completion workflow. Stripe fields exist but no subscription checkout/enforcement implementation was found. POS integration is absent.

## 2. Tech stack, hosting and build
React19 + TanStack Start/file router; Vite is **8** in actual package.json (do not assume template Vite7). Tailwind4, Radix/shadcn primitives, direct backend JS client, TanStack Query provider, SheetJS XLSX import, date-fns, Recharts. ESM TypeScript. Config uses Lovable's Vite/TanStack configuration; server entry/start middleware provide SSR error handling and authenticated server-function bearer attachment. Hosting is Lovable-managed with an Edge/workerd-targeted platform; precise deployed infrastructure/runtime version is UNVERIFIED, not established by source. Cloudflare/Node compatibility must be checked in the destination. Primary public domain is tip-tally-pro.lovable.app; deployment publication status UNVERIFIED. Browser runtime in this sandbox is localhost:8080.

Scripts (package.json):
```json
{
  "dev": "vite dev",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "preview": "vite preview",
  "lint": "eslint .",
  "format": "prettier --write ."
}
```

Final declared dependency versions (range is NOT a guaranteed resolved install):

| Group | Package | Declaration |
|---|---|---|
| dependencies | `@hookform/resolvers` | `^5.2.2` |
| dependencies | `@lovable.dev/cloud-auth-js` | `^1.1.2` |
| dependencies | `@radix-ui/react-accordion` | `^1.2.12` |
| dependencies | `@radix-ui/react-alert-dialog` | `^1.1.15` |
| dependencies | `@radix-ui/react-aspect-ratio` | `^1.1.8` |
| dependencies | `@radix-ui/react-avatar` | `^1.1.11` |
| dependencies | `@radix-ui/react-checkbox` | `^1.3.3` |
| dependencies | `@radix-ui/react-collapsible` | `^1.1.12` |
| dependencies | `@radix-ui/react-context-menu` | `^2.2.16` |
| dependencies | `@radix-ui/react-dialog` | `^1.1.15` |
| dependencies | `@radix-ui/react-dropdown-menu` | `^2.1.16` |
| dependencies | `@radix-ui/react-hover-card` | `^1.1.15` |
| dependencies | `@radix-ui/react-label` | `^2.1.8` |
| dependencies | `@radix-ui/react-menubar` | `^1.1.16` |
| dependencies | `@radix-ui/react-navigation-menu` | `^1.2.14` |
| dependencies | `@radix-ui/react-popover` | `^1.1.15` |
| dependencies | `@radix-ui/react-progress` | `^1.1.8` |
| dependencies | `@radix-ui/react-radio-group` | `^1.3.8` |
| dependencies | `@radix-ui/react-scroll-area` | `^1.2.10` |
| dependencies | `@radix-ui/react-select` | `^2.2.6` |
| dependencies | `@radix-ui/react-separator` | `^1.1.8` |
| dependencies | `@radix-ui/react-slider` | `^1.3.6` |
| dependencies | `@radix-ui/react-slot` | `^1.2.4` |
| dependencies | `@radix-ui/react-switch` | `^1.2.6` |
| dependencies | `@radix-ui/react-tabs` | `^1.1.13` |
| dependencies | `@radix-ui/react-toggle` | `^1.1.10` |
| dependencies | `@radix-ui/react-toggle-group` | `^1.1.11` |
| dependencies | `@radix-ui/react-tooltip` | `^1.2.8` |
| dependencies | `@supabase/supabase-js` | `^2.108.2` |
| dependencies | `@tailwindcss/vite` | `^4.2.1` |
| dependencies | `@tanstack/react-query` | `^5.101.1` |
| dependencies | `@tanstack/react-router` | `^1.170.16` |
| dependencies | `@tanstack/react-start` | `^1.168.26` |
| dependencies | `@tanstack/router-plugin` | `^1.168.18` |
| dependencies | `class-variance-authority` | `^0.7.1` |
| dependencies | `clsx` | `^2.1.1` |
| dependencies | `cmdk` | `^1.1.1` |
| dependencies | `date-fns` | `^4.1.0` |
| dependencies | `embla-carousel-react` | `^8.6.0` |
| dependencies | `input-otp` | `^1.4.2` |
| dependencies | `lucide-react` | `^0.575.0` |
| dependencies | `react` | `^19.2.0` |
| dependencies | `react-day-picker` | `^9.14.0` |
| dependencies | `react-dom` | `^19.2.0` |
| dependencies | `react-hook-form` | `^7.71.2` |
| dependencies | `react-resizable-panels` | `^4.6.5` |
| dependencies | `recharts` | `^2.15.4` |
| dependencies | `sonner` | `^2.0.7` |
| dependencies | `tailwind-merge` | `^3.5.0` |
| dependencies | `tailwindcss` | `^4.2.1` |
| dependencies | `tw-animate-css` | `^1.3.4` |
| dependencies | `vaul` | `^1.1.2` |
| dependencies | `vite-tsconfig-paths` | `^6.0.2` |
| dependencies | `xlsx` | `^0.18.5` |
| dependencies | `zod` | `^3.24.2` |
| devDependencies | `@eslint/js` | `^9.32.0` |
| devDependencies | `@lovable.dev/vite-tanstack-config` | `2.26.5` |
| devDependencies | `@types/node` | `^22.16.5` |
| devDependencies | `@types/react` | `^19.2.0` |
| devDependencies | `@types/react-dom` | `^19.2.0` |
| devDependencies | `@vitejs/plugin-react` | `^5.2.0` |
| devDependencies | `eslint` | `^9.32.0` |
| devDependencies | `eslint-config-prettier` | `^10.1.1` |
| devDependencies | `eslint-plugin-prettier` | `^5.2.6` |
| devDependencies | `eslint-plugin-react-hooks` | `^5.2.0` |
| devDependencies | `eslint-plugin-react-refresh` | `^0.4.20` |
| devDependencies | `globals` | `^15.15.0` |
| devDependencies | `nitro` | `3.0.260603-beta` |
| devDependencies | `prettier` | `^3.7.3` |
| devDependencies | `typescript` | `^5.8.3` |
| devDependencies | `typescript-eslint` | `^8.56.1` |
| devDependencies | `vite` | `^8.0.16` |

`bun.lock` and `package-lock.json` both exist; choose a deliberate destination install policy. `bunfig.toml` enforces package release-age restrictions. `tsconfig.json` defines aliases; `components.json` configures shadcn. No test script is declared. No manual build/typecheck was run; harness diagnostics reported build OK before handoff and are checked after maintenance. No clean-target deployment validation.

## 3. Project structure
```text
AGENTS.md — Repository/project instructions.
bunfig.toml — Bun install configuration.
components.json — Design primitive configuration.
eslint.config.js — Lint configuration.
package.json — Scripts and dependency declarations.
public/favicon.png — Browser icon.
public/icons/apple-touch-icon.png — Apple home-screen icon.
public/icons/icon-192.png — Manifest icon.
public/manifest.webmanifest — PWA name/icons/display metadata.
src/components/audit-panel.tsx — Audit read/filter/tab/export/print.
src/components/install-prompt.tsx — Chromium install event/iOS instructions/dismissal.
src/hooks/use-mobile.tsx — Viewport-breakpoint hook.
src/integrations/lovable/index.ts — Cloud OAuth wrapper and backend session hydration.
src/integrations/supabase/auth-attacher.ts — Attaches session bearer to server function requests.
src/integrations/supabase/auth-middleware.ts — Bearer claims verification and caller-scoped client.
src/integrations/supabase/client.server.ts — Generated server/admin client factory.
src/integrations/supabase/client.ts — Generated browser client/session storage; do not edit.
src/integrations/supabase/previewAuthStorage.ts — Preview parent-message storage and local fallback.
src/integrations/supabase/types.ts — Generated schema types; not authoritative over catalog.
src/lib/brand.ts — Logo-derived report colors and CSS accents.
src/lib/calculations.ts — Financial core, rounding, cap, member splits, support weights.
src/lib/download.ts — Blob download anchor and delayed cleanup.
src/lib/location.ts — First membership/settings, signed logos, UTC pay-period functions.
src/lib/print.ts — Current in-page print root, popup fallback, unused iframe helper.
src/lib/remember.ts — Local-storage credential key constants/clear.
src/lib/shift-messages.ts — Per-entry-share message construction.
src/lib/sms.functions.ts — Authenticated POST server function; recomputes and sends.
src/lib/sms.server.ts — Twilio connector-gateway request.
src/lib/utils.ts — Class merging utility.
src/routeTree.gen.ts — Generated file-route tree; never hand edit.
src/router.tsx — Creates router and per-router QueryClient; scroll restoration.
src/routes/__root.tsx — Root document, query provider, outlet, error/not-found UI, manifest/head.
src/routes/_authenticated/admin.tsx — Staff/import/team/profile/settings/audit tabs.
src/routes/_authenticated/audit.tsx — Owner/admin audit route.
src/routes/_authenticated/daily.tsx — Daily AM/PM totals, personal print sheets, SMS action.
src/routes/_authenticated/individual.tsx — Selected-person date-range detail/totals/export/print.
src/routes/_authenticated/invite.$token.tsx — Automatically accepts invite through RPC after signin.
src/routes/_authenticated/onboarding.tsx — Six-step establishment setup and invite offer.
src/routes/_authenticated/reports.tsx — Payroll aggregation, date presets, CSV and print sheets.
src/routes/_authenticated/route.tsx — Pathless session guard and Outlet.
src/routes/_authenticated/shift.$id.edit.tsx — Reuses shift editor with initialShiftId.
src/routes/_authenticated/shift.new.tsx — Shared shift entry/editor, autosave, dialogs, cash deposit.
src/routes/_authenticated/shifts.tsx — Latest100 shift listing and delete-day dialog.
src/routes/_authenticated/trends.tsx — Observed week/month takehome buckets and comparisons.
src/routes/auth.tsx — Email/password signup/signin and Google OAuth; remembered credentials.
src/routes/index.tsx — Public home navigation and branding/install prompt.
src/server.ts — Server entry and error-response wrapping.
src/start.ts — Start error/auth middleware registration.
src/styles.css — Tailwind4 sources, semantic light/dark tokens, base typography.
supabase/config.toml — Managed backend configuration; not a full backend backup.
tsconfig.json — TypeScript/alias setup.
vite.config.ts — Framework/config setup.
src/components/ui/* — Radix/shadcn-style UI primitives (enumerated below).
supabase/migrations/*.sql — historical SQL (31 files; see section15).
src/lib/error-* and lovable-error-reporting.ts — error capture/render/telemetry helpers.
docs/* — this handoff and genuine accessible screenshots.
```

UI primitive files:
`accordion.tsx`, `alert-dialog.tsx`, `alert.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `badge.tsx`, `breadcrumb.tsx`, `button.tsx`, `calendar.tsx`, `card.tsx`, `carousel.tsx`, `chart.tsx`, `checkbox.tsx`, `collapsible.tsx`, `command.tsx`, `context-menu.tsx`, `dialog.tsx`, `drawer.tsx`, `dropdown-menu.tsx`, `form.tsx`, `hover-card.tsx`, `input-otp.tsx`, `input.tsx`, `label.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `popover.tsx`, `progress.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`, `skeleton.tsx`, `slider.tsx`, `sonner.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `toggle-group.tsx`, `toggle.tsx`, `tooltip.tsx`

## 4. Routes & pages
All URL patterns come from generated route tree. `_authenticated` is pathless. All its leaves inherit `getUser()` session verification with unauthenticated redirect `/auth`; no universal manager/admin guard is applied.

| URL | File / component | Access and purpose |
|---|---|---|
| / | routes/index.tsx / home | Public navigation, first settings branding, install prompt |
| /auth | auth.tsx / AuthPage | Public, client-only signin/signup/Google/account switching |
| /admin | _authenticated/admin.tsx / Admin | Session+membership+GLOBAL has_role(admin); local role enables settings/audit |
| /audit | audit.tsx / audit page | Session; first location role owner/admin only; AuditPanel |
| /daily | daily.tsx / Daily | Session, RLS visible rows; date AM/PM totals and prints/SMS |
| /individual | individual.tsx / Individual | Session, RLS; person/date detail |
| /trends | trends.tsx / Trends | Session, RLS; week/month takehome comparisons |
| /reports | reports.tsx / Reports | Session, RLS; payroll date range/CSV/print |
| /shifts | shifts.tsx / Shifts | Session, RLS; list/edit/delete day |
| /shift/new | shift.new.tsx / ShiftForm | Session, RLS; optional date/period search; new/edit form |
| /shift/$id/edit | shift.$id.edit.tsx / edit wrapper | Session; ShiftForm(initialShiftId=id) |
| /onboarding | onboarding.tsx / wizard | Session; existing membership redirects admin, otherwise setup/invite |
| /invite/$token | invite.$token.tsx / invite page | Session then auto RPC acceptance; invalid-token error |

Query date filters do not change URL paths. Not-found and root error boundary are global states, not content routes. No route under src/routes/api exists. Leaf heads were inspected: most only supply title; descriptions/OG/Twitter metadata are incomplete, and root still has generic Lovable defaults. This handoff does NOT change them.

## 5. Data model, exact RLS, constraints, indexes, functions, triggers, views
### Catalog evidence

Snapshot: 2026-10-31 UTC. Current public catalog is authoritative over historical migrations. No business rows exported.

17 tables; 161 columns; 59 constraints; 45 indexes; 14 functions; 15 application/auth lifecycle triggers; no public views.

## Tables

### `app_settings`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `integer` | True | `nextval('app_settings_id_seq'::regclass)` |
| `establishment_name` | `text` | True | `'My Establishment'::text` |
| `logo_url` | `text` | False | `none` |
| `bar_tip_pct` | `numeric(5,4)` | True | `0.10` |
| `runner_busser_tip_pct` | `numeric(5,4)` | True | `0.10` |
| `weight_runner` | `numeric(4,2)` | True | `1.0` |
| `weight_busser` | `numeric(4,2)` | True | `1.0` |
| `weight_bar_back` | `numeric(4,2)` | True | `0.5` |
| `updated_at` | `timestamp with time zone` | True | `now()` |
| `weight_hostess` | `numeric(4,2)` | True | `0.5` |
| `max_tipout_pct` | `numeric(5,4)` | True | `0.30` |
| `location_id` | `uuid` | True | `none` |
| `bartender_tip_pct` | `numeric` | True | `0.10` |
| `rounding_mode` | `text` | True | `'nearest'::text` |
| `use_net_sales` | `boolean` | True | `false` |
| `sales_tax_pct` | `numeric` | True | `0` |
| `cc_fee_enabled` | `boolean` | True | `false` |
| `cc_fee_pct` | `numeric` | True | `0` |
| `manager_exclusion_enabled` | `boolean` | True | `false` |
| `pay_period_type` | `text` | True | `'biweekly'::text` |
| `pay_period_anchor` | `date` | False | `none` |
| `sms_enabled` | `boolean` | True | `false` |
| `sms_from_number` | `text` | False | `none` |
| `sms_include_breakdown` | `boolean` | True | `true` |
| `rb_basis` | `text` | True | `'tips'::text` |

Constraints / relationships (verbatim):
```sql
app_settings_location_id_fkey: FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
app_settings_location_id_key: UNIQUE (location_id)
app_settings_pay_period_type_check: CHECK (pay_period_type = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'semimonthly'::text, 'monthly'::text]))
app_settings_pkey: PRIMARY KEY (id)
app_settings_rb_basis_check: CHECK (rb_basis = ANY (ARRAY['tips'::text, 'sales'::text]))
app_settings_rounding_mode_check: CHECK (rounding_mode = ANY (ARRAY['none'::text, 'nearest'::text, 'up'::text, 'down'::text]))
```
Indexes (verbatim):
```sql
CREATE UNIQUE INDEX app_settings_location_id_key ON public.app_settings USING btree (location_id);
CREATE UNIQUE INDEX app_settings_pkey ON public.app_settings USING btree (id);
CREATE INDEX idx_app_settings_location ON public.app_settings USING btree (location_id);
CREATE UNIQUE INDEX uq_app_settings_location ON public.app_settings USING btree (location_id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Admins write settings" ON "public"."app_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (((location_id IS NOT NULL) AND can_admin_location(auth.uid(), location_id))) WITH CHECK (((location_id IS NOT NULL) AND can_admin_location(auth.uid(), location_id)));
CREATE POLICY "Members read settings" ON "public"."app_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((location_id IS NOT NULL) AND is_location_member(auth.uid(), location_id)));
```

### `location_invites`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `location_id` | `uuid` | True | `none` |
| `email` | `text` | True | `none` |
| `role` | `location_role` | True | `none` |
| `token` | `text` | True | `encode(extensions.gen_random_bytes(24), 'hex'::text)` |
| `invited_by` | `uuid` | True | `none` |
| `accepted_at` | `timestamp with time zone` | False | `none` |
| `expires_at` | `timestamp with time zone` | True | `(now() + '14 days'::interval)` |
| `created_at` | `timestamp with time zone` | True | `now()` |

Constraints / relationships (verbatim):
```sql
location_invites_invited_by_fkey: FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE
location_invites_location_id_fkey: FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
location_invites_pkey: PRIMARY KEY (id)
location_invites_token_key: UNIQUE (token)
```
Indexes (verbatim):
```sql
CREATE INDEX idx_invites_email ON public.location_invites USING btree (lower(email));
CREATE UNIQUE INDEX location_invites_pending_email_idx ON public.location_invites USING btree (location_id, lower(email)) WHERE (accepted_at IS NULL);
CREATE UNIQUE INDEX location_invites_pkey ON public.location_invites USING btree (id);
CREATE UNIQUE INDEX location_invites_token_key ON public.location_invites USING btree (token);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Invitees can read their own invite" ON "public"."location_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));
CREATE POLICY "Managers manage invites for their location" ON "public"."location_invites" AS PERMISSIVE FOR ALL TO "authenticated" USING (can_manage_location(auth.uid(), location_id)) WITH CHECK (can_manage_location(auth.uid(), location_id));
CREATE POLICY "Managers view invites" ON "public"."location_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING (can_manage_location(auth.uid(), location_id));
CREATE POLICY "Owners manage invites" ON "public"."location_invites" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_location_role(auth.uid(), location_id, 'owner'::location_role)) WITH CHECK (has_location_role(auth.uid(), location_id, 'owner'::location_role));
```

### `location_members`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `location_id` | `uuid` | True | `none` |
| `user_id` | `uuid` | True | `none` |
| `role` | `location_role` | True | `none` |
| `staff_id` | `uuid` | False | `none` |
| `created_at` | `timestamp with time zone` | True | `now()` |

Constraints / relationships (verbatim):
```sql
location_members_location_id_fkey: FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
location_members_location_id_user_id_key: UNIQUE (location_id, user_id)
location_members_pkey: PRIMARY KEY (id)
location_members_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
location_members_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
```
Indexes (verbatim):
```sql
CREATE UNIQUE INDEX location_members_location_id_user_id_key ON public.location_members USING btree (location_id, user_id);
CREATE UNIQUE INDEX location_members_pkey ON public.location_members USING btree (id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Members view membership of their locations" ON "public"."location_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_location_member(auth.uid(), location_id));
CREATE POLICY "Owner can bootstrap own membership" ON "public"."location_members" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = auth.uid()) AND (role = 'owner'::location_role) AND (EXISTS ( SELECT 1
   FROM locations l
  WHERE ((l.id = location_members.location_id) AND (l.owner_user_id = auth.uid()))))));
CREATE POLICY "Owners manage members" ON "public"."location_members" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_location_role(auth.uid(), location_id, 'owner'::location_role)) WITH CHECK (has_location_role(auth.uid(), location_id, 'owner'::location_role));
```

### `locations`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `name` | `text` | True | `none` |
| `owner_user_id` | `uuid` | True | `none` |
| `stripe_customer_id` | `text` | False | `none` |
| `stripe_subscription_id` | `text` | False | `none` |
| `plan` | `text` | False | `none` |
| `status` | `subscription_status` | True | `'trialing'::subscription_status` |
| `trial_ends_at` | `timestamp with time zone` | False | `none` |
| `current_period_end` | `timestamp with time zone` | False | `none` |
| `created_at` | `timestamp with time zone` | True | `now()` |
| `updated_at` | `timestamp with time zone` | True | `now()` |
| `logo_url` | `text` | False | `none` |
| `timezone` | `text` | True | `'America/New_York'::text` |
| `establishment_type` | `text` | False | `none` |
| `address` | `text` | False | `none` |
| `setup_completed_at` | `timestamp with time zone` | False | `none` |
| `setup_steps` | `jsonb` | True | `'{}'::jsonb` |

Constraints / relationships (verbatim):
```sql
locations_owner_user_id_fkey: FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT
locations_pkey: PRIMARY KEY (id)
locations_stripe_customer_id_key: UNIQUE (stripe_customer_id)
locations_stripe_subscription_id_key: UNIQUE (stripe_subscription_id)
```
Indexes (verbatim):
```sql
CREATE UNIQUE INDEX locations_pkey ON public.locations USING btree (id);
CREATE UNIQUE INDEX locations_stripe_customer_id_key ON public.locations USING btree (stripe_customer_id);
CREATE UNIQUE INDEX locations_stripe_subscription_id_key ON public.locations USING btree (stripe_subscription_id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Authenticated users create locations" ON "public"."locations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((owner_user_id = auth.uid()));
CREATE POLICY "Members view their locations" ON "public"."locations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_location_member(auth.uid(), id) OR (owner_user_id = auth.uid())));
CREATE POLICY "Owners update their location" ON "public"."locations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (has_location_role(auth.uid(), id, 'owner'::location_role)) WITH CHECK (has_location_role(auth.uid(), id, 'owner'::location_role));
```

### `profiles`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `user_id` | `uuid` | True | `none` |
| `full_name` | `text` | False | `none` |
| `email` | `text` | False | `none` |
| `created_at` | `timestamp with time zone` | True | `now()` |
| `updated_at` | `timestamp with time zone` | True | `now()` |

Constraints / relationships (verbatim):
```sql
profiles_pkey: PRIMARY KEY (user_id)
profiles_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
```
Indexes (verbatim):
```sql
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (user_id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Users insert own profile" ON "public"."profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users update own profile" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users view own profile" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
```

### `settings_audit`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `location_id` | `uuid` | True | `none` |
| `field` | `text` | True | `none` |
| `old_value` | `text` | False | `none` |
| `new_value` | `text` | False | `none` |
| `changed_by` | `uuid` | False | `none` |
| `changed_by_email` | `text` | False | `none` |
| `created_at` | `timestamp with time zone` | True | `now()` |

Constraints / relationships (verbatim):
```sql
settings_audit_location_id_fkey: FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
settings_audit_pkey: PRIMARY KEY (id)
```
Indexes (verbatim):
```sql
CREATE INDEX settings_audit_location_created_idx ON public.settings_audit USING btree (location_id, created_at DESC);
CREATE UNIQUE INDEX settings_audit_pkey ON public.settings_audit USING btree (id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Admins can view settings audit" ON "public"."settings_audit" AS PERMISSIVE FOR SELECT TO "authenticated" USING (can_admin_location(auth.uid(), location_id));
```

### `shift_bartender_members`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `shift_bartender_id` | `uuid` | True | `none` |
| `staff_id` | `uuid` | True | `none` |
| `hours_worked` | `numeric` | True | `0` |
| `created_at` | `timestamp with time zone` | True | `now()` |
| `updated_at` | `timestamp with time zone` | True | `now()` |

Constraints / relationships (verbatim):
```sql
shift_bartender_members_pkey: PRIMARY KEY (id)
shift_bartender_members_shift_bartender_id_fkey: FOREIGN KEY (shift_bartender_id) REFERENCES shift_bartenders(id) ON DELETE CASCADE
shift_bartender_members_shift_bartender_id_staff_id_key: UNIQUE (shift_bartender_id, staff_id)
shift_bartender_members_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT
```
Indexes (verbatim):
```sql
CREATE UNIQUE INDEX shift_bartender_members_pkey ON public.shift_bartender_members USING btree (id);
CREATE UNIQUE INDEX shift_bartender_members_shift_bartender_id_staff_id_key ON public.shift_bartender_members USING btree (shift_bartender_id, staff_id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Members read shift_bartender_members" ON "public"."shift_bartender_members" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (shift_bartenders sb
     JOIN shifts s ON ((s.id = sb.shift_id)))
  WHERE ((sb.id = shift_bartender_members.shift_bartender_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members write shift_bartender_members" ON "public"."shift_bartender_members" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (shift_bartenders sb
     JOIN shifts s ON ((s.id = sb.shift_id)))
  WHERE ((sb.id = shift_bartender_members.shift_bartender_id) AND is_location_member(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (shift_bartenders sb
     JOIN shifts s ON ((s.id = sb.shift_id)))
  WHERE ((sb.id = shift_bartender_members.shift_bartender_id) AND is_location_member(auth.uid(), s.location_id)))));
```

### `shift_bartenders`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `shift_id` | `uuid` | True | `none` |
| `staff_id` | `uuid` | False | `none` |
| `credit_tips` | `numeric(10,2)` | True | `0` |
| `created_at` | `timestamp with time zone` | True | `now()` |
| `cash_owed` | `numeric` | True | `0` |
| `rb_tip_override` | `numeric` | False | `none` |
| `split_mode` | `text` | True | `'single'::text` |
| `total_sales` | `numeric` | True | `0` |

Constraints / relationships (verbatim):
```sql
shift_bartenders_pkey: PRIMARY KEY (id)
shift_bartenders_shift_id_fkey: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
shift_bartenders_split_mode_check: CHECK (split_mode = ANY (ARRAY['single'::text, 'equal'::text, 'hours'::text]))
shift_bartenders_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT
```
Indexes (verbatim):
```sql
CREATE UNIQUE INDEX shift_bartenders_pkey ON public.shift_bartenders USING btree (id);
CREATE INDEX shift_bartenders_shift_idx ON public.shift_bartenders USING btree (shift_id);
CREATE INDEX shift_bartenders_staff_idx ON public.shift_bartenders USING btree (staff_id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Members read shift_bartenders" ON "public"."shift_bartenders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_bartenders.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members write shift_bartenders" ON "public"."shift_bartenders" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_bartenders.shift_id) AND is_location_member(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_bartenders.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
```

### `shift_server_members`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `shift_server_id` | `uuid` | True | `none` |
| `staff_id` | `uuid` | True | `none` |
| `hours_worked` | `numeric` | True | `0` |
| `created_at` | `timestamp with time zone` | True | `now()` |
| `updated_at` | `timestamp with time zone` | True | `now()` |

Constraints / relationships (verbatim):
```sql
shift_server_members_pkey: PRIMARY KEY (id)
shift_server_members_shift_server_id_fkey: FOREIGN KEY (shift_server_id) REFERENCES shift_servers(id) ON DELETE CASCADE
shift_server_members_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
```
Indexes (verbatim):
```sql
CREATE INDEX idx_shift_server_members_shift_server_id ON public.shift_server_members USING btree (shift_server_id);
CREATE UNIQUE INDEX shift_server_members_pkey ON public.shift_server_members USING btree (id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Members read shift_server_members" ON "public"."shift_server_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (shift_servers ss
     JOIN shifts s ON ((s.id = ss.shift_id)))
  WHERE ((ss.id = shift_server_members.shift_server_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members write shift_server_members" ON "public"."shift_server_members" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (shift_servers ss
     JOIN shifts s ON ((s.id = ss.shift_id)))
  WHERE ((ss.id = shift_server_members.shift_server_id) AND is_location_member(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (shift_servers ss
     JOIN shifts s ON ((s.id = ss.shift_id)))
  WHERE ((ss.id = shift_server_members.shift_server_id) AND is_location_member(auth.uid(), s.location_id)))));
```

### `shift_servers`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `shift_id` | `uuid` | True | `none` |
| `staff_id` | `uuid` | False | `none` |
| `cash_owed` | `numeric(10,2)` | True | `0` |
| `credit_tips` | `numeric(10,2)` | True | `0` |
| `lbw_sales` | `numeric(10,2)` | True | `0` |
| `created_at` | `timestamp with time zone` | True | `now()` |
| `bar_tip_override` | `numeric` | False | `none` |
| `rb_tip_override` | `numeric` | False | `none` |
| `total_sales` | `numeric` | True | `0` |
| `split_mode` | `text` | True | `'single'::text` |

Constraints / relationships (verbatim):
```sql
shift_servers_pkey: PRIMARY KEY (id)
shift_servers_shift_id_fkey: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
shift_servers_split_mode_check: CHECK (split_mode = ANY (ARRAY['single'::text, 'equal'::text, 'hours'::text]))
shift_servers_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT
```
Indexes (verbatim):
```sql
CREATE UNIQUE INDEX shift_servers_pkey ON public.shift_servers USING btree (id);
CREATE INDEX shift_servers_shift_idx ON public.shift_servers USING btree (shift_id);
CREATE INDEX shift_servers_staff_idx ON public.shift_servers USING btree (staff_id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Members read shift_servers" ON "public"."shift_servers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_servers.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members write shift_servers" ON "public"."shift_servers" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_servers.shift_id) AND is_location_member(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_servers.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
```

### `shift_support`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `shift_id` | `uuid` | True | `none` |
| `staff_id` | `uuid` | True | `none` |
| `hours_worked` | `numeric(5,2)` | True | `0` |
| `created_at` | `timestamp with time zone` | True | `now()` |
| `role` | `staff_role` | False | `none` |

Constraints / relationships (verbatim):
```sql
shift_support_pkey: PRIMARY KEY (id)
shift_support_shift_id_fkey: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
shift_support_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT
```
Indexes (verbatim):
```sql
CREATE UNIQUE INDEX shift_support_pkey ON public.shift_support USING btree (id);
CREATE INDEX shift_support_shift_idx ON public.shift_support USING btree (shift_id);
CREATE INDEX shift_support_staff_idx ON public.shift_support USING btree (staff_id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Members read shift_support" ON "public"."shift_support" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_support.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
CREATE POLICY "Members write shift_support" ON "public"."shift_support" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_support.shift_id) AND is_location_member(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = shift_support.shift_id) AND is_location_member(auth.uid(), s.location_id)))));
```

### `shifts`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `shift_date` | `date` | True | `none` |
| `period` | `shift_period` | True | `none` |
| `notes` | `text` | False | `none` |
| `created_at` | `timestamp with time zone` | True | `now()` |
| `updated_at` | `timestamp with time zone` | True | `now()` |
| `location_id` | `uuid` | False | `none` |
| `support_split_mode` | `text` | True | `'weighted'::text` |

Constraints / relationships (verbatim):
```sql
shifts_location_id_fkey: FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
shifts_pkey: PRIMARY KEY (id)
shifts_support_split_mode_check: CHECK (support_split_mode = ANY (ARRAY['shared'::text, 'weighted'::text]))
```
Indexes (verbatim):
```sql
CREATE INDEX idx_shifts_location ON public.shifts USING btree (location_id);
CREATE INDEX shifts_date_idx ON public.shifts USING btree (shift_date DESC);
CREATE UNIQUE INDEX shifts_pkey ON public.shifts USING btree (id);
CREATE UNIQUE INDEX shifts_unique_date_period_location ON public.shifts USING btree (location_id, shift_date, period);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Members read shifts" ON "public"."shifts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_location_member(auth.uid(), location_id));
CREATE POLICY "Members write shifts" ON "public"."shifts" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_location_member(auth.uid(), location_id)) WITH CHECK (is_location_member(auth.uid(), location_id));
```

### `sms_sends`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `location_id` | `uuid` | True | `none` |
| `shift_id` | `uuid` | False | `none` |
| `staff_id` | `uuid` | False | `none` |
| `phone` | `text` | True | `none` |
| `body` | `text` | True | `none` |
| `status` | `text` | True | `'queued'::text` |
| `provider_sid` | `text` | False | `none` |
| `error` | `text` | False | `none` |
| `sent_by` | `uuid` | False | `none` |
| `created_at` | `timestamp with time zone` | True | `now()` |

Constraints / relationships (verbatim):
```sql
sms_sends_location_id_fkey: FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
sms_sends_pkey: PRIMARY KEY (id)
sms_sends_shift_id_fkey: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
sms_sends_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
```
Indexes (verbatim):
```sql
CREATE INDEX sms_sends_location_created_idx ON public.sms_sends USING btree (location_id, created_at DESC);
CREATE UNIQUE INDEX sms_sends_pkey ON public.sms_sends USING btree (id);
CREATE INDEX sms_sends_shift_idx ON public.sms_sends USING btree (shift_id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Members record sms sends" ON "public"."sms_sends" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_location_member(auth.uid(), location_id));
CREATE POLICY "Members view sms sends" ON "public"."sms_sends" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_location_member(auth.uid(), location_id));
```

### `staff`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `name` | `text` | True | `none` |
| `server_number` | `text` | False | `none` |
| `role` | `staff_role` | True | `none` |
| `active` | `boolean` | True | `true` |
| `created_at` | `timestamp with time zone` | True | `now()` |
| `updated_at` | `timestamp with time zone` | True | `now()` |
| `location_id` | `uuid` | False | `none` |
| `is_manager` | `boolean` | True | `false` |
| `email` | `text` | False | `none` |
| `phone` | `text` | False | `none` |

Constraints / relationships (verbatim):
```sql
staff_location_id_fkey: FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
staff_pkey: PRIMARY KEY (id)
```
Indexes (verbatim):
```sql
CREATE INDEX idx_staff_location ON public.staff USING btree (location_id);
CREATE UNIQUE INDEX staff_pkey ON public.staff USING btree (id);
CREATE INDEX staff_role_active_idx ON public.staff USING btree (role, active);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Managers write staff" ON "public"."staff" AS PERMISSIVE FOR ALL TO "authenticated" USING (can_manage_location(auth.uid(), location_id)) WITH CHECK (can_manage_location(auth.uid(), location_id));
CREATE POLICY "Members read staff" ON "public"."staff" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_location_member(auth.uid(), location_id));
```

### `staff_positions`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `staff_id` | `uuid` | True | `none` |
| `position` | `staff_role` | True | `none` |
| `created_at` | `timestamp with time zone` | True | `now()` |

Constraints / relationships (verbatim):
```sql
staff_positions_pkey: PRIMARY KEY (staff_id, "position")
staff_positions_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
```
Indexes (verbatim):
```sql
CREATE UNIQUE INDEX staff_positions_pkey ON public.staff_positions USING btree (staff_id, "position");
CREATE INDEX staff_positions_position_idx ON public.staff_positions USING btree ("position");
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Managers write staff_positions" ON "public"."staff_positions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM staff s
  WHERE ((s.id = staff_positions.staff_id) AND can_manage_location(auth.uid(), s.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM staff s
  WHERE ((s.id = staff_positions.staff_id) AND can_manage_location(auth.uid(), s.location_id)))));
CREATE POLICY "Members read staff_positions" ON "public"."staff_positions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM staff s
  WHERE ((s.id = staff_positions.staff_id) AND is_location_member(auth.uid(), s.location_id)))));
```

### `tip_override_audit`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `location_id` | `uuid` | True | `none` |
| `shift_id` | `uuid` | False | `none` |
| `shift_date` | `date` | False | `none` |
| `period` | `text` | False | `none` |
| `entry_kind` | `text` | True | `none` |
| `entry_id` | `uuid` | False | `none` |
| `staff_id` | `uuid` | False | `none` |
| `field` | `text` | True | `none` |
| `auto_amount` | `numeric` | False | `none` |
| `old_amount` | `numeric` | False | `none` |
| `new_amount` | `numeric` | False | `none` |
| `action` | `text` | True | `none` |
| `changed_by` | `uuid` | False | `none` |
| `changed_by_email` | `text` | False | `none` |
| `created_at` | `timestamp with time zone` | True | `now()` |

Constraints / relationships (verbatim):
```sql
tip_override_audit_location_id_fkey: FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
tip_override_audit_pkey: PRIMARY KEY (id)
tip_override_audit_shift_id_fkey: FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL
tip_override_audit_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
```
Indexes (verbatim):
```sql
CREATE INDEX tip_override_audit_loc_date_idx ON public.tip_override_audit USING btree (location_id, shift_date DESC, created_at DESC);
CREATE UNIQUE INDEX tip_override_audit_pkey ON public.tip_override_audit USING btree (id);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Admins can view tip override audit" ON "public"."tip_override_audit" AS PERMISSIVE FOR SELECT TO "authenticated" USING (can_admin_location(auth.uid(), location_id));
```

### `user_roles`
RLS enabled: `True`; forced: `False`.

| Column | Type | NOT NULL | Default |
|---|---|---|---|
| `id` | `uuid` | True | `gen_random_uuid()` |
| `user_id` | `uuid` | True | `none` |
| `role` | `app_role` | True | `none` |
| `created_at` | `timestamp with time zone` | True | `now()` |

Constraints / relationships (verbatim):
```sql
user_roles_pkey: PRIMARY KEY (id)
user_roles_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
user_roles_user_id_role_key: UNIQUE (user_id, role)
```
Indexes (verbatim):
```sql
CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id);
CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role);
```
Policies (expressions verbatim from pg_policies; CREATE envelope reconstructed):
```sql
CREATE POLICY "Admins manage roles" ON "public"."user_roles" AS PERMISSIVE FOR ALL TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all roles" ON "public"."user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own roles" ON "public"."user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = user_id));
```

## Database functions (verbatim pg_get_functiondef)
```sql
CREATE OR REPLACE FUNCTION public.accept_location_invite(_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv public.location_invites%ROWTYPE;
  uid uuid := auth.uid();
  uemail text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  SELECT * INTO inv FROM public.location_invites
  WHERE token = _token AND accepted_at IS NULL AND expires_at > now();

  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation is invalid or has expired'; END IF;
  IF lower(inv.email) <> uemail THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  INSERT INTO public.location_members (user_id, location_id, role)
  VALUES (uid, inv.location_id, inv.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.location_invites SET accepted_at = now() WHERE id = inv.id;
  RETURN inv.location_id;
END;
$function$

CREATE OR REPLACE FUNCTION public.can_admin_location(_user_id uuid, _location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id
                   AND role::text IN ('owner', 'admin'))
$function$

CREATE OR REPLACE FUNCTION public.can_manage_location(_user_id uuid, _location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id
                   AND role::text IN ('owner', 'admin', 'manager'))
$function$

CREATE OR REPLACE FUNCTION public.create_default_app_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.app_settings (location_id, establishment_name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (location_id) DO NOTHING;
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.grant_admin_to_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role::text IN ('owner', 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.handle_new_user_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.has_location_role(_user_id uuid, _location_id uuid, _role location_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id AND role = _role)
$function$

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$function$

CREATE OR REPLACE FUNCTION public.is_location_member(_user_id uuid, _location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.location_members
                 WHERE user_id = _user_id AND location_id = _location_id)
$function$

CREATE OR REPLACE FUNCTION public.log_settings_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  uemail text := auth.jwt() ->> 'email';
  oldj jsonb := to_jsonb(OLD);
  newj jsonb := to_jsonb(NEW);
  k text;
BEGIN
  IF NEW.location_id IS NULL THEN RETURN NEW; END IF;
  FOR k IN SELECT jsonb_object_keys(newj) LOOP
    IF k IN ('id','location_id','updated_at') THEN CONTINUE; END IF;
    IF (newj -> k) IS DISTINCT FROM (oldj -> k) THEN
      INSERT INTO public.settings_audit (location_id, field, old_value, new_value, changed_by, changed_by_email)
      VALUES (NEW.location_id, k, oldj ->> k, newj ->> k, uid, uemail);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.log_tip_override()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.shifts%ROWTYPE;
  uid uuid := auth.uid();
  uemail text := auth.jwt() ->> 'email';
  kind text := CASE WHEN TG_TABLE_NAME = 'shift_servers' THEN 'server' ELSE 'bartender' END;
  oldbar numeric;
  newbar numeric;
  oldrb numeric;
  newrb numeric;
BEGIN
  SELECT * INTO s FROM public.shifts WHERE id = NEW.shift_id;
  IF s.location_id IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'shift_servers' THEN
    oldbar := CASE WHEN TG_OP = 'UPDATE' THEN OLD.bar_tip_override ELSE NULL END;
    newbar := NEW.bar_tip_override;
    IF newbar IS DISTINCT FROM oldbar THEN
      INSERT INTO public.tip_override_audit (location_id, shift_id, shift_date, period, entry_kind, entry_id, staff_id, field, old_amount, new_amount, action, changed_by, changed_by_email)
      VALUES (s.location_id, NEW.shift_id, s.shift_date, s.period::text, kind, NEW.id, NEW.staff_id, 'bar_tip',
              oldbar, newbar,
              CASE WHEN newbar IS NULL THEN 'cleared' WHEN oldbar IS NULL THEN 'set' ELSE 'changed' END,
              uid, uemail);
    END IF;
  END IF;

  oldrb := CASE WHEN TG_OP = 'UPDATE' THEN OLD.rb_tip_override ELSE NULL END;
  newrb := NEW.rb_tip_override;
  IF newrb IS DISTINCT FROM oldrb THEN
    INSERT INTO public.tip_override_audit (location_id, shift_id, shift_date, period, entry_kind, entry_id, staff_id, field, old_amount, new_amount, action, changed_by, changed_by_email)
    VALUES (s.location_id, NEW.shift_id, s.shift_date, s.period::text, kind, NEW.id, NEW.staff_id, 'rb_tip',
            oldrb, newrb,
            CASE WHEN newrb IS NULL THEN 'cleared' WHEN oldrb IS NULL THEN 'set' ELSE 'changed' END,
            uid, uemail);
  END IF;

  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$

```

## Triggers (verbatim pg_get_triggerdef)
```sql
CREATE TRIGGER on_auth_user_created_assign_admin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user_admin();
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();
CREATE TRIGGER app_settings_audit AFTER UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION log_settings_change();
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER location_invites_updated_at BEFORE UPDATE ON location_invites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_grant_admin_to_owner AFTER INSERT ON location_members FOR EACH ROW EXECUTE FUNCTION grant_admin_to_owner();
CREATE TRIGGER locations_create_default_settings AFTER INSERT ON locations FOR EACH ROW EXECUTE FUNCTION create_default_app_settings();
CREATE TRIGGER locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_shift_bartender_members_updated_at BEFORE UPDATE ON shift_bartender_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_log_tip_override_bartenders AFTER INSERT OR UPDATE ON shift_bartenders FOR EACH ROW EXECUTE FUNCTION log_tip_override();
CREATE TRIGGER shift_server_members_updated_at BEFORE UPDATE ON shift_server_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_log_tip_override_servers AFTER INSERT OR UPDATE ON shift_servers FOR EACH ROW EXECUTE FUNCTION log_tip_override();
CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

## Enums
```json
{
  "app_role": [
    "admin",
    "user"
  ],
  "location_role": [
    "owner",
    "manager",
    "staff",
    "admin"
  ],
  "shift_period": [
    "AM",
    "PM"
  ],
  "staff_role": [
    "server",
    "bartender",
    "runner",
    "busser",
    "bar_back",
    "hostess"
  ],
  "subscription_status": [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete"
  ]
}
```

## Grants
The schema.sql file contains decoded live table/sequence/schema ACL grants for anon, authenticated, service_role, and PUBLIC. Owner and internal diagnostic-role grants are intentionally not replicated. All 14 public functions currently grant EXECUTE to PUBLIC. Broad table grants do not bypass RLS for ordinary clients.

## Managed storage
Buckets are private: `logos`, `database_export_31_10_26`; both have no configured MIME allowlist or file-size limit. Objects are not exported. Storage policies are provided verbatim as reference only:
```sql
CREATE POLICY "Admins delete logos" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'logos'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins update logos" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'logos'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins upload logos" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'logos'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Anyone can view logos" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((bucket_id = 'logos'::text));
CREATE POLICY "Logos are publicly readable" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = 'logos'::text));
CREATE POLICY "Managers delete their location logo" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'logos'::text) AND can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Managers update their location logo" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'logos'::text) AND can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Managers upload their location logo" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'logos'::text) AND can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)));
```

## Extensions
```json
[
  {
    "name": "plpgsql",
    "schema": "pg_catalog",
    "version": "1.0"
  },
  {
    "name": "supabase_vault",
    "schema": "vault",
    "version": "0.3.1"
  },
  {
    "name": "pgcrypto",
    "schema": "extensions",
    "version": "1.3"
  },
  {
    "name": "uuid-ossp",
    "schema": "extensions",
    "version": "1.1"
  },
  {
    "name": "pg_stat_statements",
    "schema": "extensions",
    "version": "1.11"
  }
]
```

## Export scope / UNVERIFIED
Managed auth/storage internal table definitions, database cluster roles/ownership/default privileges, installed edge-function inventory, full migration replay on a clean target, auth provider hosted settings and storage object migration are UNVERIFIED. The generated SQL has not been executed against a target database.

`schema.sql` reconstructs current public DDL, not blind concatenation of historical migrations. It contains public enums, sequence definition, all columns/defaults/constraints/indexes, pg_get_functiondef bodies, all public policy expressions, public and app-owned auth lifecycle triggers, and decoded live grants. Managed storage policy DDL is reference-commented until destination storage exists. Dependencies auth.users/auth.uid/auth.jwt and platform roles must already exist. No data rows, secrets, session tokens or logo objects are included. Default privileges/owner recreation and clean-target SQL execution are UNVERIFIED. Catalog contains duplicate settings uniqueness indexes; do not silently simplify.

## 6. Authentication & authorization
Password auth calls signInWithPassword/signUp. Without session, asks email confirmation; actual hosted signup/email/provider settings UNVERIFIED. Google uses Lovable cloud-auth wrapper with same-origin redirect and setSession. routePostAuth selects first membership and navigates admin if found, onboarding otherwise; this does not choose a staff/manager-appropriate destination. Signed-in auth screen offers Continue or Start a new account (signout + remembered-data clear).

Remember email & password stores PLAINTEXT password in localStorage (explicit testing option). Auth token persistence is separate. Preview storage uses parent-message broker/local fallback. Do not migrate real localStorage/passwords into handoff.

Global enum app_role(admin,user) differs from per-location role(owner,admin,manager,staff). Admin screen checks GLOBAL admin; settings/audit owner/admin via local role. SQL owner/admin insertion trigger grants global admin, without a full demotion/revocation sync on membership updates. `can_manage_location` includes owner/admin/manager; `can_admin_location` owner/admin. Exact policies in section5 govern actual data access; ordinary members can write shifts/children per current policies, not manager-only. Audit SELECT restricted owner/admin. Settings writes owner/admin. Profiles and user_roles are protected by their policies, not user editable auth metadata.

getMyLocationId selects FIRST membership with limit1 and no order; loadMySettings selects FIRST visible settings without location filter. Several report/staff queries rely solely on RLS and do not bind one active location. Users with multiple memberships can mix data/settings. There is no deterministic active-location selector identified. Effective runtime multi-membership behavior UNVERIFIED.

Onboarding six steps Establishment→Logo→Team→Pay periods→Tip rules→Staff; at least one staff required. finish performs sequential location/member/upload/settings/invites/staff/positions/setup writes, not transaction; some errors are ignored. Invite acceptance RPC verifies uid, target email, token/unexpired/unaccepted; inserts membership and accepted_at. Signin redirects do not preserve invite target reliably. Roles/permissions are static source/catalog evidence, not cross-role runtime enforcement tests.

## 7. Business logic & calculations — exact core
All monetary inputs are JS numbers in dollars. Rate settings stored FRACTIONS: .05=5%. Hours hours, weights dimensionless. Defaults are database defaults in section5; function fallback differs where shown. Code uses binary floating point, not Decimal/integer cents. No remnant-penny balancing.

Define R(n,m): none→Math.round(n×100)/100, up→Math.ceil(n), down→Math.floor(n), otherwise Math.round(n). `round2` always cents. Default mode nearest. JS Math.round ties toward positive infinity; 1.005 binary example rounds1.00 not1.01; negatives retain JS behavior. Names nearest/up/down apply WHOLE DOLLARS, none still cents.

Input adjustment: L=use_net_sales and tax>0 ? lbw_sales/(1+tax) : lbw_sales; T=cc_fee_enabled and fee>0 ? credit_tips×(1−fee) : credit_tips; S=same tax adjustment applied total_sales (missing→0). No rounding in adjustment.

Server: rawBar=R(L×bar_tip_pct); base=rb_basis==='sales'?S:max(0,T−rawBar); rawSupport=R(base×runner_busser_tip_pct). Apply cap BEFORE override: max=(max_tipout_pct>0?max_tipout_pct:1)×T. If rawBar+rawSupport<=max: unchanged,capped=false. Else support=min(rawSupport,max), bar=max(0,max−support); round2 both,capped=true. Final bar=R(override if not null else capped bar); support=R(override if not null else capped support); takehome=R(T−bar−support). Cash owed does NOT participate. Overrides BYPASS cap; capped flag reports automatic calculation only. Final whole-dollar rounding can alter cap compliance after cap application.

Bartender: adjusted T/S as above; base=rb_basis==='sales'?S:T; rawSupport=R(base×bartender_tip_pct); applyCap(0,rawSupport,T,cap); finalSupport=R(override else capSupport); takehome=R(T+serverBarTipsCollected−finalSupport). Received server tips are NOT in support-rate base/cap denominator. Cash owed belongs house, never added/subtracted from bartender takehome.

Member splits: single OR zero members→entry staff gets100%, hours0; null staff→[]. Otherwise totalHours=sum(hours||0); if hours mode and totalHours>0, share=(hours||0)/totalHours, else1/member count. Each cash/credit/LBW/bar-receipt/tip-out/takehome field independently round2(entry amount×share), even if selected whole-dollar mode. No leftover balancing; negative hours are not clamped in core.

Support: nominal pool=round2(sum server rb_tip + sum bartender rb_tip using collected0)); shared mode each=R(pool/rowCount); no rows→[]. Weighted units role weight×hours; total<=0→all0 (NOT equal fallback). Else each=R(pool×units/total). Default weighted. Valid support role selection prefers shift role, then staff default, then runner. Invalid enum casts in some callers differ; documented in audit. Duplicate IDs/missing staff can distort report lookup. No core constraints against negative tips/sales/cap/pool/weights; UI only partly guards. Nonfinite input/DB acceptance UNVERIFIED.

Exact complete implementation and functions (not pseudocode):
```ts
// Tip share math — mirrors the source spreadsheet exactly.
// All inputs in dollars (numbers). Rounded to cents for display, full precision in math.

export type RoundingMode = "none" | "nearest" | "up" | "down";

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const roundCents = (n: number, mode: RoundingMode = "nearest") => {
  if (mode === "none") return Math.round(n * 100) / 100;
  if (mode === "up") return Math.ceil(n);
  if (mode === "down") return Math.floor(n);
  return Math.round(n);
};

const rm = (s: { rounding_mode?: RoundingMode }) => s.rounding_mode ?? "nearest";

export interface Settings {
  bar_tip_pct: number; // e.g. 0.05 (5% of LBW sales)
  runner_busser_tip_pct: number; // servers: e.g. 0.20 (20% of remaining tips)
  bartender_tip_pct: number; // bartenders: e.g. 0.10 (10% of credit tips)
  max_tipout_pct: number; // cap on total tip-out as fraction of credit tips, e.g. 0.30
  rb_basis?: "tips" | "sales"; // support tip-out taken from tips (default) or gross sales
  weight_runner: number;
  weight_busser: number;
  weight_bar_back: number;
  weight_hostess: number;
  rounding_mode?: RoundingMode; // how cents are rounded across payouts
  // Batch A toggles
  use_net_sales?: boolean; // if true, LBW sales entered are gross; strip tax before tip-out
  sales_tax_pct?: number; // e.g. 0.0875 (8.75%)
  cc_fee_enabled?: boolean; // if true, deduct processing fee from credit tips before calc
  cc_fee_pct?: number; // e.g. 0.03 (3%)
}

/** Apply net-sales + CC-fee toggles to raw inputs before tip-out math runs. */
function adjustInputs(lbw_sales: number, credit_tips: number, s: Settings, total_sales = 0) {
  const netSales = s.use_net_sales && (s.sales_tax_pct ?? 0) > 0
    ? lbw_sales / (1 + (s.sales_tax_pct ?? 0))
    : lbw_sales;
  const netTips = s.cc_fee_enabled && (s.cc_fee_pct ?? 0) > 0
    ? credit_tips * (1 - (s.cc_fee_pct ?? 0))
    : credit_tips;
  const netTotal = s.use_net_sales && (s.sales_tax_pct ?? 0) > 0
    ? total_sales / (1 + (s.sales_tax_pct ?? 0))
    : total_sales;
  return { lbw_sales: netSales, credit_tips: netTips, total_sales: netTotal };
}


export interface ServerRow {
  staff_id: string | null;
  cash_owed: number;
  credit_tips: number;
  lbw_sales: number;
  total_sales?: number;
  bar_tip_override?: number | null;
  rb_tip_override?: number | null;
}

export interface BartenderRow {
  staff_id: string | null;
  cash_owed: number;
  credit_tips: number;
  total_sales?: number;
  rb_tip_override?: number | null;
}

export type BartenderSplitMode = "single" | "equal" | "hours";
export interface BartenderMember {
  staff_id: string;
  hours_worked: number;
}



export type SupportRole = "runner" | "busser" | "bar_back" | "hostess";
export interface SupportRow {
  staff_id: string;
  role: SupportRole;
  hours_worked: number;
}

/** Apply max_tipout_pct cap: bar_tip + rb_tip cannot exceed cap × credit_tips.
 *  Support pool (runners/bussers/hostesses) is paid first; bar tip-out absorbs
 *  the cut so the support team never loses their share to the bar. */
function applyCap(bar_tip: number, rb_tip: number, credit_tips: number, cap: number) {
  const max = (cap > 0 ? cap : 1) * credit_tips;
  const total = bar_tip + rb_tip;
  if (total <= max) return { bar_tip, rb_tip, capped: false };
  // Pay R/B pool first, then bar gets whatever's left under the cap.
  const capped_rb = Math.min(rb_tip, max);
  const capped_bar = Math.max(0, max - capped_rb);
  return { bar_tip: round2(capped_bar), rb_tip: round2(capped_rb), capped: true };
}

export function calcServer(row: ServerRow, s: Settings) {
  const mode = rm(s);
  const adj = adjustInputs(row.lbw_sales, row.credit_tips, s, row.total_sales ?? 0);
  const rawBar = roundCents(adj.lbw_sales * s.bar_tip_pct, mode);
  const rbBase = s.rb_basis === "sales" ? adj.total_sales : Math.max(0, adj.credit_tips - rawBar);
  const rawRb = roundCents(rbBase * s.runner_busser_tip_pct, mode);
  const { bar_tip: capBar, rb_tip: capRb, capped } = applyCap(rawBar, rawRb, adj.credit_tips, s.max_tipout_pct);
  const bar_tip = row.bar_tip_override != null ? roundCents(row.bar_tip_override, mode) : roundCents(capBar, mode);
  const rb_tip = row.rb_tip_override != null ? roundCents(row.rb_tip_override, mode) : roundCents(capRb, mode);
  const takehome = roundCents(adj.credit_tips - bar_tip - rb_tip, mode);
  return { bar_tip, rb_tip, takehome, capped };
}

export function calcBartender(row: BartenderRow, serverBarTipsCollected: number, s: Settings) {
  const mode = rm(s);
  const adj = adjustInputs(0, row.credit_tips, s, row.total_sales ?? 0);
  const barBase = s.rb_basis === "sales" ? adj.total_sales : adj.credit_tips;
  const rawRb = roundCents(barBase * s.bartender_tip_pct, mode);
  const { rb_tip: capRb, capped } = applyCap(0, rawRb, adj.credit_tips, s.max_tipout_pct);
  const rb_tip = row.rb_tip_override != null ? roundCents(row.rb_tip_override, mode) : roundCents(capRb, mode);
  // Cash owed goes to the house, not the bartender.
  const takehome = roundCents(adj.credit_tips + serverBarTipsCollected - rb_tip, mode);
  return { rb_tip, takehome, collected_from_servers: serverBarTipsCollected, capped };
}

/** Split a bartender entry's payouts across one or more people.
 *  - "single": single bartender identified by entry.staff_id gets everything.
 *  - "equal": divide evenly across members.
 *  - "hours": weighted by hours_worked (falls back to equal if total hours = 0). */
export interface BartenderShare {
  staff_id: string;
  hours_worked: number;
  share: number;
  cash_owed: number;
  credit_tips: number;
  bar_from_servers: number;
  rb_tip: number;
  takehome: number;
}
export function splitBartenderShares(
  entry: { staff_id: string | null; cash_owed: number; credit_tips: number },
  entryCalc: { rb_tip: number; takehome: number; collected_from_servers: number },
  splitMode: BartenderSplitMode,
  members: BartenderMember[],
): BartenderShare[] {
  if (splitMode === "single" || members.length === 0) {
    if (!entry.staff_id) return [];
    return [{
      staff_id: entry.staff_id, hours_worked: 0, share: 1,
      cash_owed: round2(entry.cash_owed),
      credit_tips: round2(entry.credit_tips),
      bar_from_servers: round2(entryCalc.collected_from_servers),
      rb_tip: round2(entryCalc.rb_tip),
      takehome: round2(entryCalc.takehome),
    }];
  }
  const totalHours = members.reduce((s, m) => s + (m.hours_worked || 0), 0);
  const shares = members.map((m) => {
    if (splitMode === "hours" && totalHours > 0) return (m.hours_worked || 0) / totalHours;
    return 1 / members.length;
  });
  return members.map((m, i) => ({
    staff_id: m.staff_id,
    hours_worked: m.hours_worked || 0,
    share: shares[i],
    cash_owed: round2(entry.cash_owed * shares[i]),
    credit_tips: round2(entry.credit_tips * shares[i]),
    bar_from_servers: round2(entryCalc.collected_from_servers * shares[i]),
    rb_tip: round2(entryCalc.rb_tip * shares[i]),
    takehome: round2(entryCalc.takehome * shares[i]),
  }));
}

/** Split a server entry ("split party" cash-out) across one or more servers.
 *  Same modes as bartenders: single / equal / hours. */
export interface ServerShare {
  staff_id: string;
  hours_worked: number;
  share: number;
  cash_owed: number;
  credit_tips: number;
  lbw_sales: number;
  bar_tip: number;
  rb_tip: number;
  takehome: number;
}
export function splitServerShares(
  entry: { staff_id: string | null; cash_owed: number; credit_tips: number; lbw_sales: number },
  entryCalc: { bar_tip: number; rb_tip: number; takehome: number },
  splitMode: BartenderSplitMode,
  members: BartenderMember[],
): ServerShare[] {
  if (splitMode === "single" || members.length === 0) {
    if (!entry.staff_id) return [];
    return [{
      staff_id: entry.staff_id, hours_worked: 0, share: 1,
      cash_owed: round2(entry.cash_owed),
      credit_tips: round2(entry.credit_tips),
      lbw_sales: round2(entry.lbw_sales),
      bar_tip: round2(entryCalc.bar_tip),
      rb_tip: round2(entryCalc.rb_tip),
      takehome: round2(entryCalc.takehome),
    }];
  }
  const totalHours = members.reduce((s, m) => s + (m.hours_worked || 0), 0);
  const shares = members.map((m) => {
    if (splitMode === "hours" && totalHours > 0) return (m.hours_worked || 0) / totalHours;
    return 1 / members.length;
  });
  return members.map((m, i) => ({
    staff_id: m.staff_id,
    hours_worked: m.hours_worked || 0,
    share: shares[i],
    cash_owed: round2(entry.cash_owed * shares[i]),
    credit_tips: round2(entry.credit_tips * shares[i]),
    lbw_sales: round2(entry.lbw_sales * shares[i]),
    bar_tip: round2(entryCalc.bar_tip * shares[i]),
    rb_tip: round2(entryCalc.rb_tip * shares[i]),
    takehome: round2(entryCalc.takehome * shares[i]),
  }));
}





export type SupportSplitMode = "shared" | "weighted";

export function calcSupportPool(
  rows: SupportRow[],
  poolTotal: number,
  s: Settings,
  splitMode: SupportSplitMode = "weighted",
): { staff_id: string; payout: number }[] {
  const mode = rm(s);
  if (splitMode === "shared") {
    if (rows.length === 0) return [];
    return rows.map((r) => ({ staff_id: r.staff_id, payout: roundCents(poolTotal / rows.length, mode) }));
  }
  const weightFor = (r: SupportRole) =>
    r === "runner" ? s.weight_runner
    : r === "busser" ? s.weight_busser
    : r === "hostess" ? s.weight_hostess
    : s.weight_bar_back;
  const totalWeighted = rows.reduce((sum, r) => sum + weightFor(r.role) * r.hours_worked, 0);
  if (totalWeighted <= 0) return rows.map((r) => ({ staff_id: r.staff_id, payout: 0 }));
  return rows.map((r) => ({
    staff_id: r.staff_id,
    payout: roundCents((poolTotal * (weightFor(r.role) * r.hours_worked)) / totalWeighted, mode),
  }));
}


/** Total tip pool fed to runners/bussers/bar backs from a shift. */
export function poolFromShift(
  servers: ServerRow[],
  bartenders: BartenderRow[],
  s: Settings,
): number {
  const serverRB = servers.reduce((sum, r) => sum + calcServer(r, s).rb_tip, 0);
  const barRB = bartenders.reduce((sum, b) => sum + calcBartender(b, 0, s).rb_tip, 0);
  return round2(serverRB + barRB);
}

const SUPPORT_ROLE_SET = new Set<SupportRole>(["runner", "busser", "bar_back", "hostess"]);

/** Resolve the support position used for weighting.
 *  Prefers the position picked on the shift; falls back to the staff member's
 *  default role, and to "runner" when that isn't a support position. */
export function resolveSupportRole(
  shiftRole?: string | null,
  staffRole?: string | null,
): SupportRole {
  if (shiftRole && SUPPORT_ROLE_SET.has(shiftRole as SupportRole)) return shiftRole as SupportRole;
  if (staffRole && SUPPORT_ROLE_SET.has(staffRole as SupportRole)) return staffRole as SupportRole;
  return "runner";
}

```

### Financial calculations at call sites
### Audit

Evidence: current source inspected 2026-10-31; static findings, not authenticated runtime tests. Core formulas and full quoted implementations are in ARCHITECTURE.md section 7; worked outputs are in section 8 and CALCULATION_EXAMPLES.json.

## Shared report pipeline and order
1. Calculate each entire server cashout (`calcServer`), then split its result (`splitServerShares`). Calculation, cap and overrides happen BEFORE splitting.
2. Sum calculated server bar tip-outs B. N = number of bartender ENTRIES, not people. Each entry collects `round2(B / Math.max(N,1))` in payroll/daily/individual/trends/messages, then `calcBartender`, then `splitBartenderShares`. With no bartender entries there are no recipients. An entry containing three people gets the same initial collection as an individual entry, then splits internally.
3. `poolFromShift` sums entry support tip-outs; construct support rows; shared if saved mode exactly `shared`, otherwise weighted. Resolve valid shift support role before current primary staff role, except the defects below.
4. Accumulate already-rounded participant amounts; no final penny reconciliation. Many loops use `payouts.find(p=>p.staff_id===sp.staff_id)`; duplicate support IDs repeat the first match, rather than matching row identity.

## Payroll — src/routes/_authenticated/reports.tsx
`totalsByStaff` (208–276) adds server shares: cash_owed, credit_tips, lbw_sales, bar_tip_out, rb_tip_out, takehome. Bartender shares: cash_owed, credit_tips, bar_from_servers, rb_tip_out, takehome. Support: hours_worked, rb_received=payout, takehome=payout. A Set counts one person-shift per staff ID per underlying shift record (AM/PM separate), even with multiple roles. Only support hours accumulate; server/bartender split hours do not. Numeric patches use `(t as any)[k] += (patch as any)[k] ?? 0` with no total rounding.

`dayRowsByStaff` (278–342) duplicates the pipeline for individual sheets: one person/shift line, combines roles within shift, sorts date then period. It sets shifts=1. Unknown staff IDs are filtered out of payroll rows; inactive existing staff remain eligible because report staff load is not active-only. Roles shown derive from CURRENT primary role plus CURRENT staff_positions, not historical worked roles.

`totalTips(t) = t.credit_tips + t.bar_from_servers + t.rb_received`; `takePct(t) = totalTips(t)>0 ? t.takehome/totalTips(t)*100 : null` (66–73). Credit tips are original allocated tips, not adjusted for processing fees. Cash and sales excluded. Monetary/hour display two decimals, percentage one decimal; missing percentage em dash. Grand is sum of ALL known-person rows, not filtered visible rows. Grand percentage is ratio of grand sums, not average percentages. Its total-tip denominator counts internal bar/support transfers AGAIN and is not original house tips. Cash deposit is grand.cash_owed: allocated rounded known-staff cash, not raw entry cash. Grand shifts is person-shifts, not unique establishment shifts.

Date range is inclusive gte/lte shift_date. Default UTC today minus13 days through today. Request sequence discards older results. Shape/year validation does not establish calendar validity; invalid/reversed ranges do not dispatch a new query. Setup/record errors show retry. No historical settings snapshot: every date range is recomputed with CURRENT settings.

## Daily — src/routes/_authenticated/daily.tsx
`personRows` (162–222) uses the payroll per-person pipeline across all loaded shift records for the date; only support hours. Percentage denominator = credit_tips + from_servers + rb_received, positive-only, one decimal. Main AM/PM use FIRST `shifts.find(period)` (108–109), while personRows loops all results: multi-location/duplicate-record results can diverge.

`totals()` (357–388), for a shift:
- serverCash = sum Number(server.cash_owed ??0); barCash analog; cash=serverCash+barCash (RAW ENTRY amounts, no share rounding).
- credit = sum raw server + bartender credit tips; lbw = sum raw server LBW sales.
- barOut = sum calculated server bar_tip; rbOut = sum server+bartender calculated rb_tip.
- fromServers = full serverBarTotal if any bartender entry exists, else0 (not N × rounded receipt).
- supportPool = sum ACTUAL rounded support payouts, not nominal pool.
- takehome = sum WHOLE ENTRY server + bartender takehome + actual support payouts, not member-share sums.
Day fields = first-AM + first-PM fields. Net house cash = day.cash − day.takehome. Money two decimals and dollar signs. Person sheets may differ from day totals because member splits round independently. No Daily financial CSV found.

## Individual — src/routes/_authenticated/individual.tsx
`lines` (137–214) creates one line per underlying touched shift record for the selected staff. Multiple entries/roles sum into that line. Server cash is accumulated; BARTENDER CASH IS OMITTED. Server share hours are omitted; bartender share hours (truthy) and support hours are added. Support financial role resolves shift role but its label uses current staff role. Totals sum line fields. `avg = lines.length>0 ? total.takehome/lines.length :0`: per touched shift, NOT per day/hour. Same positive-only totalTips denominator as payroll. Missing settings/read errors do not have payroll-style retry handling.

## Trends — src/routes/_authenticated/trends.tsx
Window: today minus7×periods days for weeks; `setMonth(currentMonth-periods)` for months. Inclusive ISO-date query. Weeks keyed Monday; months by month. Only observed buckets, NO gap-filled empty periods; first/current periods may be partial. Previous means preceding OBSERVED bucket, not necessarily preceding calendar period. Map staff→bucket sums takehome; counts unique seen staff once per shift. Unknown staff omitted. Sort descending current takehome.
`cur = last observed bucket takehome ??0; prev = previous observed bucket takehome ??0; delta = round2(cur-prev); pct = prev>0 ? delta/prev*100 :null`. Display delta cents, percent zero decimals. House bucket = round2(sum known-person takehome), not tips/sales/deposits. Chart house/detail heights = value/max(1,values)×90; sparkline height = max(6,value/max(1,values)×100). Zero sparkline has minimum6% height. Negative main/detail heights not explicitly clamped. Mixed local-date manipulation and UTC ISO serialization: timezone effects UNVERIFIED.

## Shift form — src/routes/_authenticated/shift.new.tsx
`num(s)=Number(s)||0`; ordinary blank/NaN→0, negatives survive, Infinity survives. `optNum(s)=s.trim()===''?null:Number(s)`. Override editor rejects negative/nonfinite values, blank resets. Opening editor preloads automatic value fixed2. Effective overrides are subject to configured rounding but applied AFTER cap.
`serverRows`/`bartenderRows` map raw numeric fields; includes total_sales in persistence. Live bartender receipt = totalServerBar/bartenders.length WITHOUT round2, unlike reports. ALL UI entries affect that denominator/pool, even entries without recipients; save filters invalid recipients out. This can alter saved results. Server displayed takehome% denominator = raw credit_tips. Bartender denominator = raw credit_tips + UNROUNDED received bar collection; positive-only, one decimal.
HouseCashDeposit (1003–1007): currentSubtotal = raw current serverCash+bartenderCash; total=currentSubtotal+(period==='PM'?savedAmCash:0). PM adds AM raw cash; AM shows current only. Does not subtract cashouts. AM fetch scoped by location/date and first AM result; missing/error→0. Live support pool display = NOMINAL pool, not sum rounded payouts.

## Messages — src/lib/shift-messages.ts
`buildShiftMessages` emits ONE MESSAGE PER encountered server/bartender share/support ROW, not one aggregate per person per shift. Multi-role staff can receive multiple partial messages. Missing staff prevents a message. Same entry allocations as reports. Money fixed2; support hours fixed2; no percentage. Header establishment or Tip Share + date + period. Server fields: Credit tips; Cash owed to house; Bar tip-out; Support tip-out. Bartender: Credit tips; From servers; Cash owed to house; Support tip-out. Support: Hours; Tip pool share. Every message ends Take-home. Optional breakdown disabled only if false. Actual delivery UNVERIFIED.

## Input omissions causing current discrepancies
- `total_sales` is SAVED by form but OMITTED from nested select in payroll, daily, individual, trends, SMS. `adjustInputs` defaults missing total_sales→0. With rb_basis='sales', automated support tips in these reports/messages calculate from ZERO. Overrides may mask this. Confirmed static source defect, not a suggested change; no fix applied.
- Trends omits saved shift_support.role and weights using current primary role directly, unlike resolved role elsewhere. SMS also omits role even though message builder can resolve it. These can disagree with shift/payroll.
- Individual excludes bartender cash; hours differ across reports as above.
- Historical reports use current rates/weights/fees/rounding; no settings snapshot.
- Independent entry/member/support rounding does not conserve cash/tips and can recross an automatic cap after whole-dollar rounding; override flag remains the automatic cap flag.

## Other math
Admin PercentNumber (admin.tsx:526–529): display fraction `Math.round(val*1000)/10`; entered whole-percent raw→fraction `Math.round(raw*10)/1000` if finite, otherwise0. Rounds to0.1 percentage point. Non-percentage weight inputs raw numbers. Onboarding helper `(val*100).toFixed(1)`; onboarding tip inputs fractions unlike Settings percent inputs. Audit percentage format: multiply100, fixed2, trim zeroes; booleans On/Off; null dash; money fixed2 on screen, raw numbers in tips CSV.
Pay-period functions in location.ts: UTC day=86400000ms. Monthly first→last day; semimonthly1–15 or16→last. Weekly len7, other fallback len14. Anchor UTC midnight, or most recent Monday relative to supplied date. diff=floor((today-base)/DAY); index=floor(diff/len); start=base+index×len×DAY; end=start+(len−1)×DAY. Previous = range for day before current start. Biweekly missing anchor recomputes Monday for each date, so previous can overlap current; intended behavior UNVERIFIED.

## CSV exact contracts
Payroll headers (ordered):
```text
Date From,Date To,Name,Server #,Role,Shifts,Hours,Cash Owed,Credit Tips,Tips From Servers (Bar),LBW Sales,Bar Tip Out,R/B Tip Out,R/B Received,Take-Home,Total Tips,Take-Home %
```
Rows = ALL known staff, not visible print filter. Name and role escaped; server_number raw. Shifts integer, hours/money2 decimals, percentage1 decimal or blank (no $/% symbols). Final TOTAL row with grand sums and grand ratio. Filename `tip-share_${from}_to_${to}.csv`.
Individual headers:
```text
Name,Server #,Date,Period,Roles,Hours,Cash Owed,Credit Tips,Tips From Servers (Bar),LBW Sales,Bar Tip Out,R/B Tip Out,R/B Received,Take-Home,Total Tips,Take-Home %
```
One per touched shift; roles join ' / '; final Date `${from} to ${to}`, Period TOTAL; selected staff name, server number. Filename `tips_${person.name.replace(/\s+/g,'-')}_${from}_to_${to}.csv`. Name escaping; raw employee number. Both CSV use comma, LF, no explicit BOM; csvEsc quotes only values with double-quote/comma/LF and doubles quotes. Bare CR and spreadsheet formula injection not handled; downstream behavior UNVERIFIED.
Audit tip headers: `When,Shift date,Period,Type,Staff,Field,Action,Previous,New,Changed by`. Settings: `When,Setting,Previous,New,Changed by`. Every cell quoted/doubled; dates locale formatted; tip previous/new raw numeric String, null blank; settings formatted percentage/boolean text. Filename `audit-${tab}-${from}-to-${to}.csv`; no totals. Each dataset limited500 newest rows by CREATED_AT UTC date boundaries, not shift date; export may be truncated.
Download transport: Blob text/csv;charset=utf-8, appended hidden anchor, click, remove/revoke after2000ms (download.ts).

## Print flows
Current print.ts PRIMARY is printInPage, despite comments describing iframe. It mounts root using innerHTML, hides other direct body children in print media, sets title, synchronous window.print, cleanup500ms after afterprint or120seconds fallback. Popup fallback then ordinary window.print. printElement clones INNER HTML, not wrapper; style/ancestor context may differ. Iframe helper exists but is unused by exports. No PDF generator: browser print-to-PDF only.
Payroll individual sheets always mounted hidden wrapper; printSlips sends wrapper INNER HTML immediately. Payroll full report uses state effect + two requestAnimationFrames, then printElement, not synchronous click. Daily full and slips direct click helper; separate state-driven slips branch prints main innerHTML while slips wrapper remains hidden—whether any current control reaches this branch UNVERIFIED. Individual direct helper. Audit ordinary window.print. Print pagination/platform behavior, blank-page regression, dialog opening and physical printer success UNVERIFIED; no authenticated print capture available.

### Exact quoted consumer implementations
All full source for report totals/date-percentages/chart math/form input and deposit/pay-period/SMS/print/CSV is quoted with source line annotations in [FINANCIAL_SOURCE.md](FINANCIAL_SOURCE.md). This avoids substituting estimated formulas for code; consumer function names and references above correspond to that snapshot.

## 8. Worked examples — actual execution
### Executed cases

These are exact JSON outputs from the current calculation module, not hand estimates. Synthetic staff identifiers are not real employees. Every example specifies all settings; defaults here are a chosen fixture, not claimed database defaults.

## 1. Standard server, cent rounding

Input:

```json
{
  "row": {
    "staff_id": "server-A",
    "cash_owed": 45,
    "credit_tips": 200,
    "lbw_sales": 500,
    "total_sales": 1500
  },
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips"
  }
}
```

Actual output:

```json
{
  "bar_tip": 25,
  "rb_tip": 35,
  "takehome": 140,
  "capped": false
}
```

Trace: rawBar=25; rbBase=200-25=175; rawRb=35; cap=60 and total=60; takehome=140. Cash owed 45 is not subtracted.

## 2. Standard bartender including server collection

Input:

```json
{
  "row": {
    "staff_id": "bar-A",
    "cash_owed": 80,
    "credit_tips": 300,
    "total_sales": 1800
  },
  "serverBarTipsCollected": 25,
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips"
  }
}
```

Actual output:

```json
{
  "rb_tip": 30,
  "takehome": 295,
  "collected_from_servers": 25,
  "capped": false
}
```

Trace: rawRb=300×0.1=30; cap=90; takehome=300+25-30=295. Cash owed 80 belongs to house, not takehome.

## 3. Cap pays support before bar

Input:

```json
{
  "row": {
    "staff_id": "server-A",
    "cash_owed": 45,
    "credit_tips": 100,
    "lbw_sales": 2000,
    "total_sales": 1500
  },
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips"
  }
}
```

Actual output:

```json
{
  "bar_tip": 30,
  "rb_tip": 0,
  "takehome": 70,
  "capped": true
}
```

Trace: rawBar=100; rbBase=max(0,100-100)=0; rawRb=0; cap=30; bar becomes30; takehome70.

## 4. Gross-sales basis cap reallocates bar

Input:

```json
{
  "row": {
    "staff_id": "server-A",
    "cash_owed": 45,
    "credit_tips": 200,
    "lbw_sales": 500,
    "total_sales": 1500
  },
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "sales"
  }
}
```

Actual output:

```json
{
  "bar_tip": 0,
  "rb_tip": 60,
  "takehome": 140,
  "capped": true
}
```

Trace: rawBar25; rawRb=1500×.2=300; cap60; support min(300,60)=60; bar0; takehome140.

## 5. Zero-sales, positive tips

Input:

```json
{
  "row": {
    "staff_id": "server-A",
    "cash_owed": 45,
    "credit_tips": 200,
    "lbw_sales": 0,
    "total_sales": 0
  },
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips"
  }
}
```

Actual output:

```json
{
  "bar_tip": 0,
  "rb_tip": 40,
  "takehome": 160,
  "capped": false
}
```

Trace: rawBar0; support200×.2=40; takehome160.

## 6. Zero tips with positive sales

Input:

```json
{
  "row": {
    "staff_id": "server-A",
    "cash_owed": 45,
    "credit_tips": 0,
    "lbw_sales": 500,
    "total_sales": 1500
  },
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips"
  }
}
```

Actual output:

```json
{
  "bar_tip": 0,
  "rb_tip": 0,
  "takehome": 0,
  "capped": true
}
```

Trace: rawBar25; support0; cap0; both final tipouts0; takehome0; capped true.

## 7. Manual overrides bypass cap

Input:

```json
{
  "row": {
    "staff_id": "server-A",
    "cash_owed": 45,
    "credit_tips": 200,
    "lbw_sales": 500,
    "total_sales": 1500,
    "bar_tip_override": 90,
    "rb_tip_override": 130
  },
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips"
  }
}
```

Actual output:

```json
{
  "bar_tip": 90,
  "rb_tip": 130,
  "takehome": -20,
  "capped": false
}
```

Trace: Automatic total60 is not capped; overrides applied AFTER cap give90+130=220; takehome -20; capped remains false.

## 8. Tax removed and fee recovered

Input:

```json
{
  "row": {
    "staff_id": "server-A",
    "cash_owed": 45,
    "credit_tips": 200,
    "lbw_sales": 550,
    "total_sales": 1650
  },
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips",
    "use_net_sales": true,
    "sales_tax_pct": 0.1,
    "cc_fee_enabled": true,
    "cc_fee_pct": 0.03
  }
}
```

Actual output:

```json
{
  "bar_tip": 24.4,
  "rb_tip": 33.8,
  "takehome": 135.8,
  "capped": true
}
```

Trace: adjustedLBW=550/1.1≈500; adjustedTips=194; rawBar25; support round2((194-25)×.2)=33.8; cap58.2; sum58.8 exceeds; cap keeps33.8 support, bar24.4; takehome135.8.

## 9. Default whole-dollar nearest rounding

Input:

```json
{
  "row": {
    "staff_id": "server-A",
    "cash_owed": 45,
    "credit_tips": 201.55,
    "lbw_sales": 523,
    "total_sales": 1500
  },
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "nearest",
    "rb_basis": "tips"
  }
}
```

Actual output:

```json
{
  "bar_tip": 25,
  "rb_tip": 35,
  "takehome": 142,
  "capped": true
}
```

Trace: rawBar round(26.15)=26; rawRb round(175.55×.2)=35; cap60.465 cuts bar to25.47 and support35; final bar round25.47=25; takehome round141.55=142.

## 10. Uneven shared server dollar leaves one cent

Input:

```json
{
  "entry": {
    "staff_id": null,
    "cash_owed": 1,
    "credit_tips": 1,
    "lbw_sales": 1
  },
  "entryCalc": {
    "bar_tip": 1,
    "rb_tip": 1,
    "takehome": 1
  },
  "splitMode": "equal",
  "members": [
    {
      "staff_id": "A",
      "hours_worked": 1
    },
    {
      "staff_id": "B",
      "hours_worked": 1
    },
    {
      "staff_id": "C",
      "hours_worked": 1
    }
  ]
}
```

Actual output:

```json
[
  {
    "staff_id": "A",
    "hours_worked": 1,
    "share": 0.3333333333333333,
    "cash_owed": 0.33,
    "credit_tips": 0.33,
    "lbw_sales": 0.33,
    "bar_tip": 0.33,
    "rb_tip": 0.33,
    "takehome": 0.33
  },
  {
    "staff_id": "B",
    "hours_worked": 1,
    "share": 0.3333333333333333,
    "cash_owed": 0.33,
    "credit_tips": 0.33,
    "lbw_sales": 0.33,
    "bar_tip": 0.33,
    "rb_tip": 0.33,
    "takehome": 0.33
  },
  {
    "staff_id": "C",
    "hours_worked": 1,
    "share": 0.3333333333333333,
    "cash_owed": 0.33,
    "credit_tips": 0.33,
    "lbw_sales": 0.33,
    "bar_tip": 0.33,
    "rb_tip": 0.33,
    "takehome": 0.33
  }
]
```

Trace: Each amount independently round2(1/3)=.33. Three shares sum .99; leftover .01 is NOT allocated.

## 11. Bartender hours split

Input:

```json
{
  "entry": {
    "staff_id": "bar-A",
    "cash_owed": 80,
    "credit_tips": 300,
    "total_sales": 1800
  },
  "entryCalc": {
    "rb_tip": 30,
    "takehome": 295,
    "collected_from_servers": 25,
    "capped": false
  },
  "splitMode": "hours",
  "members": [
    {
      "staff_id": "A",
      "hours_worked": 6
    },
    {
      "staff_id": "B",
      "hours_worked": 4
    }
  ]
}
```

Actual output:

```json
[
  {
    "staff_id": "A",
    "hours_worked": 6,
    "share": 0.6,
    "cash_owed": 48,
    "credit_tips": 180,
    "bar_from_servers": 15,
    "rb_tip": 18,
    "takehome": 177
  },
  {
    "staff_id": "B",
    "hours_worked": 4,
    "share": 0.4,
    "cash_owed": 32,
    "credit_tips": 120,
    "bar_from_servers": 10,
    "rb_tip": 12,
    "takehome": 118
  }
]
```

Trace: Shares .6/.4; cash48/32; tips180/120; bar15/10; support18/12; takehome177/118.

## 12. Hours mode zero hours falls back equal

Input:

```json
{
  "entry": {
    "staff_id": "bar-A",
    "cash_owed": 80,
    "credit_tips": 300,
    "total_sales": 1800
  },
  "entryCalc": {
    "rb_tip": 30,
    "takehome": 295,
    "collected_from_servers": 25,
    "capped": false
  },
  "splitMode": "hours",
  "members": [
    {
      "staff_id": "A",
      "hours_worked": 0
    },
    {
      "staff_id": "B",
      "hours_worked": 0
    }
  ]
}
```

Actual output:

```json
[
  {
    "staff_id": "A",
    "hours_worked": 0,
    "share": 0.5,
    "cash_owed": 40,
    "credit_tips": 150,
    "bar_from_servers": 12.5,
    "rb_tip": 15,
    "takehome": 147.5
  },
  {
    "staff_id": "B",
    "hours_worked": 0,
    "share": 0.5,
    "cash_owed": 40,
    "credit_tips": 150,
    "bar_from_servers": 12.5,
    "rb_tip": 15,
    "takehome": 147.5
  }
]
```

Trace: TotalHours0: each share.5; takehome147.5.

## 13. Weighted support including hostess

Input:

```json
{
  "rows": [
    {
      "staff_id": "runner",
      "role": "runner",
      "hours_worked": 6
    },
    {
      "staff_id": "busser",
      "role": "busser",
      "hours_worked": 4
    },
    {
      "staff_id": "hostess",
      "role": "hostess",
      "hours_worked": 4
    }
  ],
  "poolTotal": 120,
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips"
  },
  "splitMode": "weighted"
}
```

Actual output:

```json
[
  {
    "staff_id": "runner",
    "payout": 60
  },
  {
    "staff_id": "busser",
    "payout": 40
  },
  {
    "staff_id": "hostess",
    "payout": 20
  }
]
```

Trace: Weighted units6+4+(.5×4)=12; payouts60,40,20.

## 14. Shared support ignores hours and role weights

Input:

```json
{
  "rows": [
    {
      "staff_id": "runner",
      "role": "runner",
      "hours_worked": 6
    },
    {
      "staff_id": "busser",
      "role": "busser",
      "hours_worked": 4
    },
    {
      "staff_id": "hostess",
      "role": "hostess",
      "hours_worked": 4
    }
  ],
  "poolTotal": 100,
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips"
  },
  "splitMode": "shared"
}
```

Actual output:

```json
[
  {
    "staff_id": "runner",
    "payout": 33.33
  },
  {
    "staff_id": "busser",
    "payout": 33.33
  },
  {
    "staff_id": "hostess",
    "payout": 33.33
  }
]
```

Trace: Three payouts33.33; summed99.99; leftover .01 not reconciled.

## 15. Weighted support all zero hours

Input:

```json
{
  "rows": [
    {
      "staff_id": "runner",
      "role": "runner",
      "hours_worked": 0
    },
    {
      "staff_id": "busser",
      "role": "busser",
      "hours_worked": 0
    },
    {
      "staff_id": "hostess",
      "role": "hostess",
      "hours_worked": 0
    }
  ],
  "poolTotal": 120,
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips"
  }
}
```

Actual output:

```json
[
  {
    "staff_id": "runner",
    "payout": 0
  },
  {
    "staff_id": "busser",
    "payout": 0
  },
  {
    "staff_id": "hostess",
    "payout": 0
  }
]
```

Trace: Unlike server/bar splits: total weighted units0 returns all payouts0; pool120 remains unallocated.

## 16. Same person server and bartender

Input:

```json
{
  "server": {
    "staff_id": "server-A",
    "cash_owed": 45,
    "credit_tips": 200,
    "lbw_sales": 500,
    "total_sales": 1500
  },
  "bar": {
    "staff_id": "server-A",
    "cash_owed": 80,
    "credit_tips": 300,
    "total_sales": 1800
  },
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0.3,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips"
  }
}
```

Actual output:

```json
{
  "server": {
    "bar_tip": 25,
    "rb_tip": 35,
    "takehome": 140,
    "capped": false
  },
  "bartender": {
    "rb_tip": 30,
    "takehome": 295,
    "collected_from_servers": 25,
    "capped": false
  },
  "pool": 65,
  "combined": {
    "credit_tips": 500,
    "bar_from_servers": 25,
    "rb_tip": 65,
    "takehome": 435,
    "total_tips": 525,
    "takehome_pct": 82.85714285714286,
    "cash_owed": 125
  }
}
```

Trace: Server support20% of remaining tips=35; bartender support10% own credit tips=30; pool65. Same staff credit500 + bar received25 = total tips525; combined takehome140+295=435; percentage435/525×100.

## 17. Missing staff / empty members

Input:

```json
{
  "entry": {
    "staff_id": null,
    "cash_owed": 80,
    "credit_tips": 300,
    "total_sales": 1800
  },
  "entryCalc": {
    "rb_tip": 30,
    "takehome": 295,
    "collected_from_servers": 25,
    "capped": false
  },
  "splitMode": "equal",
  "members": []
}
```

Actual output:

```json
[]
```

Trace: Empty members falls back single; null staff_id returns []: an entry can feed pools but have no individual payout row.

## 18. Nonpositive cap means 100%, not disabled cap

Input:

```json
{
  "row": {
    "staff_id": "server-A",
    "cash_owed": 45,
    "credit_tips": 100,
    "lbw_sales": 3000,
    "total_sales": 1500
  },
  "settings": {
    "bar_tip_pct": 0.05,
    "runner_busser_tip_pct": 0.2,
    "bartender_tip_pct": 0.1,
    "max_tipout_pct": 0,
    "weight_runner": 1,
    "weight_busser": 1,
    "weight_bar_back": 1,
    "weight_hostess": 0.5,
    "rounding_mode": "none",
    "rb_basis": "tips"
  }
}
```

Actual output:

```json
{
  "bar_tip": 100,
  "rb_tip": 0,
  "takehome": 0,
  "capped": true
}
```

Trace: max=(cap>0?cap:1)×100=100; raw bar150 support0; capped bar100; takehome0.

## 19. Rounding and role resolution edge cases

Input:

```json
{
  "values": [
    1.5,
    -1.5,
    1.005
  ],
  "modes": [
    "none",
    "nearest",
    "up",
    "down"
  ]
}
```

Actual output:

```json
{
  "rounding": [
    {
      "n": 1.5,
      "none": 1.5,
      "nearest": 2,
      "up": 2,
      "down": 1
    },
    {
      "n": -1.5,
      "none": -1.5,
      "nearest": -1,
      "up": -1,
      "down": -2
    },
    {
      "n": 1.005,
      "none": 1,
      "nearest": 1,
      "up": 2,
      "down": 1
    }
  ],
  "roles": [
    "hostess",
    "busser",
    "runner"
  ]
}
```

Trace: Uses JavaScript Math.* with binary floating point: 1.005 rounds to1 not1.01 in none mode; negative nearest tie -1.5→-1. Invalid support positions fall back runner.

## 9. State management & data flow
QueryClientProvider is mounted, but most screens use local useState/useMemo/useRef + direct backend requests in effects, not loader/ensureQueryData. Browser numeric strings→Number mapper→pure calculations→form previews. Persist RAW entries, overrides, split modes and member hours/support roles→reports load and recompute with current settings. No immutable payout ledger or rate snapshot. Reports use request sequence to prevent old date responses overwriting new; not all screens have complete error handling.

Shift saves debounce1500ms after edits; hydration suppresses initial writes; savingRef serializes and pendingRef schedules another pass. Save existing parent, snapshot children/member rows, delete children, insert new children/members. Client rollback attempts snapshots after failure but not atomic, misses parent restoration and partial-new-row cleanup. Return-order matching inserted rows to members uses array index. New shift checks existing location/date/period before creation; live unique index also enforces that tuple (location nullable means null semantics differ). Date change confirms and moves AM+PM only to empty target; shift and delete-day confirmations exist.

Dirty unload uses beforeunload; pagehide/unmount best-effort async save not completion-guaranteed. In-app blocker does not block while saving. Save-and-leave can proceed after internally caught save failure; leave-without-saving can still invoke cleanup save. Source promises 'nothing lost' but rollback success UNVERIFIED. Cross-tab/user concurrency and interrupted-save recovery UNVERIFIED. No durable offline shift draft queue found.

## 10. Backend, APIs and functions
No backend edge-function source or application API route files found. Deployed edge-function inventory UNVERIFIED (code absence is not proof of no deployed function).

Browser backend APIs: Auth getUser/getSession/signInWithPassword/signUp/signOut/setSession; PostgREST tables app_settings, staff, staff_positions, locations, location_members, location_invites, shifts, shift_servers, shift_bartenders, shift_support, shift_server_members, shift_bartender_members, tip_override_audit, settings_audit; RPC has_role and accept_location_invite; Storage logos upload upsert and createSignedUrl. Auth reads/writes scoped by browser session and exact RLS. No custom REST path for POS/Stripe found.

`sendShiftTipReports` (sms.functions.ts) POST createServerFn input `{shift_id:string}` nonempty. Bearer middleware verifies claims/sub and provides caller-scoped backend client. Fetches nested shift+settings/staff by location, recomputes messages, checks SMS enabled/sender/provider env, sends sequentially, logs sms_sends. Returns `{configured,sent,skipped,failed,results:[{staff_id,name,status,detail?}],error?}`; statuses sent/skipped/failed. It trusts no client payout. No explicit manager/admin check beyond RLS, rate limit/deduplication/completed-state check. SMS select OMITS total_sales/support role, and messages are per-entry share, not merged per person. Delivery/auditable provider success UNVERIFIED.

`sendSms(to,from,body)` (sms.server.ts) form POST `https://connector-gateway.lovable.dev/twilio/Messages.json`; fields To/From/Body; LOVABLE_API_KEY bearer and TWILIO_API_KEY connection header. Output `{ok:true,sid:string|null}` or `{ok:false,error}`. Provider error body partly returned/logged. No SMS calls were made for this handoff. Auth helpers and error telemetry are infrastructure, not payroll APIs; service/admin generated client exists but ordinary SMS uses caller client.

## 11. Integrations & environment — NAMES ONLY
Cloud auth/database/storage; Google via Lovable OAuth wrapper; Twilio via Lovable connector gateway; browser printing/download/PWA; XLSX parser. Stripe fields are placeholders, POS absent. No confirmed transactional email/invitation sending service implementation; team creates/copies invite links.

Environment/source names: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SUPABASE_DB_URL, LOVABLE_API_KEY, TWILIO_API_KEY. Known managed secret names are not proof of provider connectivity. No values exported. Managed service-role/database credentials are not user-accessible exports from Lovable Cloud. `.env` was not copied. Hosted signup/Google/email settings, OAuth redirect allowlists, provider connection and sender verification UNVERIFIED.

Logo value can be an existing http URL or private storage path; resolveLogoUrl signs path for31536000 seconds. Storage logos bucket is PRIVATE in current catalog despite stale plans saying public. Logo files are not exported. Other private bucket database_export_31_10_26 exists, but contents/recovery completeness UNVERIFIED.

## 12. UI components & design system
Tailwind4 imports and semantic variables in styles.css; shadcn/Radix primitives under components/ui. Application controls often raw styled HTML rather than these primitives. Token design: warm cream background, forest green primary, sand secondary, brass accent, destructive/success semantic states; dark class overrides exist but a user theme toggle not confirmed. Root heading serif stack Georgia/Times; no downloaded custom font found. Current radius .75rem; headings negative letter spacing in existing source (do not normalize in migration).

Exact current CSS tokens/base definitions:
```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* Tip Share Calculator — warm hospitality palette
 * Deep forest green + warm cream + brass accent.
 * Mobile-first, big tap targets, designed for on-shift use.
 */

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-ring-offset-background: var(--background);

  --font-display: ui-serif, Georgia, "Times New Roman", serif;
}

:root {
  --radius: 0.75rem;

  /* Warm cream paper */
  --background: oklch(0.985 0.012 85);
  --foreground: oklch(0.22 0.02 150);

  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.02 150);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.02 150);

  /* Deep forest green */
  --primary: oklch(0.34 0.06 155);
  --primary-foreground: oklch(0.98 0.01 85);

  /* Warm sand */
  --secondary: oklch(0.93 0.025 80);
  --secondary-foreground: oklch(0.28 0.03 150);

  --muted: oklch(0.94 0.018 85);
  --muted-foreground: oklch(0.48 0.02 150);

  /* Brass accent */
  --accent: oklch(0.72 0.13 75);
  --accent-foreground: oklch(0.2 0.03 60);

  --destructive: oklch(0.55 0.22 28);
  --destructive-foreground: oklch(0.98 0.01 85);

  --success: oklch(0.55 0.13 155);
  --success-foreground: oklch(0.98 0.01 85);

  --border: oklch(0.88 0.018 85);
  --input: oklch(0.88 0.018 85);
  --ring: oklch(0.34 0.06 155);
}

.dark {
  --background: oklch(0.18 0.015 150);
  --foreground: oklch(0.95 0.012 85);
  --card: oklch(0.22 0.018 150);
  --card-foreground: oklch(0.95 0.012 85);
  --popover: oklch(0.22 0.018 150);
  --popover-foreground: oklch(0.95 0.012 85);
  --primary: oklch(0.7 0.08 155);
  --primary-foreground: oklch(0.18 0.015 150);
  --secondary: oklch(0.28 0.02 150);
  --secondary-foreground: oklch(0.95 0.012 85);
  --muted: oklch(0.26 0.018 150);
  --muted-foreground: oklch(0.7 0.018 85);
  --accent: oklch(0.72 0.13 75);
  --accent-foreground: oklch(0.2 0.03 60);
  --destructive: oklch(0.55 0.22 28);
  --destructive-foreground: oklch(0.98 0.01 85);
  --success: oklch(0.6 0.13 155);
  --success-foreground: oklch(0.18 0.015 150);
  --border: oklch(0.3 0.02 150);
  --input: oklch(0.3 0.02 150);
  --ring: oklch(0.7 0.08 155);
}

@layer base {
  * {
    border-color: var(--color-border);
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  h1, h2, h3 {
    font-family: var(--font-display);
    letter-spacing: -0.01em;
  }
}

```

Logo-derived brand accents: useBrand/brand.ts samples logo bitmap and applies report colors; browser/canvas availability and CORS affect extraction. Read code in source appendix below; never claim every logo color extracts successfully. Report logos enlarged statement-style, individual staff names emphasized. Responsive tables scroll horizontally, filters/forms wrap. Genuine public screen captures verified separately; all signed-in layouts UNVERIFIED.

## 13. Reports & exports
Exact financial/export contracts are in section7 audit. Payroll one staff row/date range + TOTAL; individual touched-shift rows + total and average; daily first AM/PM entry totals plus person sheets; trends observed periods; audit500-row cap. Currency screen `$` fixed2, CSV raw fixed2 except audit raw values. Current print primary mounts in-page print root, copies innerHTML, hides rest of body in print media, synchronous window.print; popup then ordinary print fallback. Payroll Print All has state/rAF deferral, individual sheets direct. No application PDF-generation library/export identified: user may use browser Save as PDF. Physical print and blank-page issue UNVERIFIED, not fixed here.

## 14. Known issues, TODOs, technical debt / UNVERIFIED register
Confirmed source/catalog findings (not new fixes): sales-mode report/SMS total_sales missing; Individual bartender cash omitted; inconsistent hours; trends/SMS shift support roles omitted; duplicate support-ID find lookup; person-vs-entry rounding and raw-vs-allocated deposit mismatches; current-settings historical recalculation; manual override bypasses cap; zero weighted hours leave pool unpaid; internal-transfer denominator double counts grand tips; no penny remainder reconciliation; no active-location consistency; global/local role drift; plaintext remembered password; client destructive save/rollback not atomic; partial onboarding; invite return target missing; CSV raw employee number/formula injection exposure; audit500 truncation; stale print comments and possible hidden branch; PWA does not prove offline capability; missing local schema migrations described below.

UNVERIFIED sections/claims:
- §2 precise hosting/deployed runtime/publication and clean-target build/deploy.
- §5 managed auth/storage internals, full cluster roles/ownership/default privileges, storage objects/data transfer, target schema execution.
- §6 hosted signup/email/Google settings, live cross-role enforcement and multi-membership behavior.
- §7 nonfinite/negative invalid DB acceptance, intended no-anchor biweekly semantics, timezone-boundary behavior.
- §9 concurrency, unload-save completion, rollback completeness and index-order matching guarantees.
- §10 deployed edge-function inventory, SMS provider connection/delivery/rate/abuse behavior.
- §11 actual secret/provider availability, OAuth allowlists, logo bucket object completeness and backup restore.
- §12 signed-in/mobile report layouts and logo extraction across browsers.
- §13 print pagination/dialog/physical printer, blank-print regression, downloads in target browsers.
- §15 fresh historical migration replay, missing original SQL, applied-ledger timestamp mapping.
- SCREENS.md all authenticated/destructive/native-provider/PWA-install states not captured; public captures are real, others not mock images.

## 15. Database migrations
31 local files,32 live ledger entries. The ledger was read, not inferred. Filename version stamps differ from ledger stamps; correspondence must not be guessed. Exact ordered files and SQL reference excerpts/live ledger in [MIGRATIONS.md](MIGRATIONS.md). Live catalog has tip_override_audit creation/log_tip_override and staff_role hostess value that are not fully supplied by local migrations. Reconstructed current schema includes them. Some historical migrations confirm/delete account/probe records and should not be replayed blindly. schema.sql is intentionally schema-only, no business INSERT/DELETE export. Fresh replay on destination is UNVERIFIED.

- `supabase/migrations/20260627161109_8c8cb8f4-8a47-4158-bc7e-2c434d765fbc.sql`
- `supabase/migrations/20260627161130_4bdefadd-a12f-40e3-89fa-d7fe1fed1425.sql`
- `supabase/migrations/20260627161144_8a22a3a9-1695-40a0-a403-c297602689d4.sql`
- `supabase/migrations/20260627163830_0337f166-830a-4162-8886-d12f55cbf9ad.sql`
- `supabase/migrations/20260627164157_2e8f5573-d830-4e0f-9243-22f3a84cbad6.sql`
- `supabase/migrations/20260627171432_3ef321cb-281b-4e89-a236-fbe7140bdc17.sql`
- `supabase/migrations/20260627192010_e93e9816-f0e1-4223-95a6-7e285fd53a8a.sql`
- `supabase/migrations/20260627195953_dd3f8169-d4a4-4f42-83dc-928940c7541c.sql`
- `supabase/migrations/20260627204538_20e9a678-c65e-4d3a-9e18-d692ae4682eb.sql`
- `supabase/migrations/20260627220008_9a4caffe-808a-44eb-b475-cf281fdb9ee4.sql`
- `supabase/migrations/20260703173748_1455c8f8-0561-49cf-937e-0c1f040ef5b6.sql`
- `supabase/migrations/20260703183821_c5a38d9d-a4d4-49c9-b9a2-50119ecd7e7d.sql`
- `supabase/migrations/20260703200115_70df26d3-b7dd-45ee-b12a-8d43cf61d1b5.sql`
- `supabase/migrations/20260703201050_3332f9a8-6c9f-498f-a0da-d82a8b75790d.sql`
- `supabase/migrations/20260703205106_87f5e0ca-43c0-4d86-afac-f00adb5dccbe.sql`
- `supabase/migrations/20260714211933_e6d73bbc-7137-45b7-a277-d2e1df4618fe.sql`
- `supabase/migrations/20260728214121_141e5e0c-008e-4d6f-8e66-055f439ac15d.sql`
- `supabase/migrations/20260730164635_2195112a-5f6c-40d3-925d-68696059bc5c.sql`
- `supabase/migrations/20260730170047_a37043d0-f14b-4a7b-a10b-94a05c69faad.sql`
- `supabase/migrations/20260730173818_b6bfc2be-1dff-4c05-8885-6678fb80a81b.sql`
- `supabase/migrations/20260730181244_45a12925-ad98-4d95-8adc-44e8b1346129.sql`
- `supabase/migrations/20260730181326_46213e35-325d-43e3-982c-1cc3689c8006.sql`
- `supabase/migrations/20260730183431_7d67ccab-48f8-42f7-9ed1-568d6b63c5eb.sql`
- `supabase/migrations/20260730184600_97f36102-0fb7-441a-ae9f-724810741907.sql`
- `supabase/migrations/20260730185848_209e05f5-804f-4b24-843a-48817f78658e.sql`
- `supabase/migrations/20260730195330_617fdc7f-64f8-4404-9013-dadfb94e2695.sql`
- `supabase/migrations/20260804154929_f0f44425-280b-4671-896f-516439db7874.sql`
- `supabase/migrations/20260806195650_c02fed07-0165-4ac3-ae54-205580b4fc77.sql`
- `supabase/migrations/20260818014829_071509b6-eb8c-4506-a813-2b16be3ca7df.sql`
- `supabase/migrations/20260818042409_eb6c540b-fbcd-4cb9-a1e3-68698a8011d1.sql`
- `supabase/migrations/20260818042505_c2851ee1-ae93-46d2-b511-f495042a76b2.sql`

### Exact brand extraction source
```ts
import { useEffect, useState } from "react";
import { resolveLogoUrl } from "@/lib/location";

/** Colors pulled from an establishment's logo, used to theme printed reports. */
export type Brand = {
  logoUrl: string | null;
  /** Main accent (headers, rules). */
  primary: string;
  /** Readable text color on top of `primary`. */
  onPrimary: string;
  /** Very light tint of the accent, safe as a table/section background. */
  soft: string;
  /** Secondary accent for small labels. */
  accent: string;
};

const DEFAULT_BRAND: Brand = {
  logoUrl: null,
  primary: "#1f2937",
  onPrimary: "#ffffff",
  soft: "#f3f4f6",
  accent: "#4b5563",
};

const luminance = (r: number, g: number, b: number) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Darken/lighten so the accent always reads on white paper. */
function normalize(r: number, g: number, b: number): [number, number, number] {
  let lum = luminance(r, g, b);
  let f = 1;
  if (lum > 0.62) f = 0.62 / lum; // too pale for text
  if (lum < 0.12) f = 0.12 / Math.max(lum, 0.01); // nearly black
  const out: [number, number, number] = [r * f, g * f, b * f];
  lum = luminance(out[0], out[1], out[2]);
  return out;
}

/**
 * Pick the two most-used meaningful colors in an image. Near-white, near-black
 * and washed-out pixels are ignored so a logo on a white background still
 * yields its brand color.
 */
function extractPalette(img: HTMLImageElement): { primary: string; accent: string; soft: string } | null {
  const size = 56;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null; // cross-origin image, cannot read pixels
  }

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 160) continue;
    const lum = luminance(r, g, b);
    if (lum > 0.93 || lum < 0.06) continue;
    if (saturation(r, g, b) < 0.18 && lum > 0.55) continue;
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const cur = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    buckets.set(key, { count: cur.count + 1, r: cur.r + r, g: cur.g + g, b: cur.b + b });
  }
  if (buckets.size === 0) return null;

  const sorted = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map((x) => normalize(x.r / x.count, x.g / x.count, x.b / x.count));

  const [pr, pg, pb] = sorted[0];
  const second = sorted[1] ?? sorted[0];
  return {
    primary: hex(pr, pg, pb),
    accent: hex(second[0], second[1], second[2]),
    // 8% accent over white — light enough to print behind text.
    soft: hex(255 - (255 - pr) * 0.1, 255 - (255 - pg) * 0.1, 255 - (255 - pb) * 0.1),
  };
}

/**
 * Resolves the establishment logo and derives report colors from it.
 * Falls back to neutral colors when there is no logo (or it cannot be read).
 */
export function useBrand(logoValue: string | null | undefined): Brand {
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);

  useEffect(() => {
    let cancelled = false;
    if (!logoValue) {
      setBrand(DEFAULT_BRAND);
      return;
    }
    (async () => {
      const url = await resolveLogoUrl(logoValue);
      if (cancelled || !url) return;
      setBrand((b) => ({ ...b, logoUrl: url }));
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        const palette = extractPalette(img);
        if (!palette) return;
        setBrand({
          logoUrl: url,
          primary: palette.primary,
          accent: palette.accent,
          soft: palette.soft,
          onPrimary: "#ffffff",
        });
      };
      img.src = url;
    })();
    return () => {
      cancelled = true;
    };
  }, [logoValue]);

  return brand;
}

```
