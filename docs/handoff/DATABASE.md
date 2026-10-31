# Database catalog appendix

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
