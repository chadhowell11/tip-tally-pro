// SQL generator and checks for the PRODUCTION DATA MIGRATION (docs/DATA-MIGRATION-PLAN.md).
// Driven by harness/db/remote-migrate.sh; it never talks to a database itself.
//
// Input: the text that `pg_restore --data-only` (PostgreSQL 17) prints for the export's public schema
// and for auth.users + auth.identities. That text holds real payroll and login data, so it only ever
// lives in a private temp folder outside the repo; nothing from it is written into the repo.
//
//   node --experimental-strip-types harness/db/migrate-export.ts inspect   <public.sql> <auth.sql>
//   node --experimental-strip-types harness/db/migrate-export.ts load-sql  <public.sql> <auth.sql> <location-id> <operator-email>
//   node --experimental-strip-types harness/db/migrate-export.ts sums-sql  <public.sql> <auth.sql> <location-id> <operator-email>
//   node --experimental-strip-types harness/db/migrate-export.ts sums-cmp  <public.sql> <auth.sql> <location-id> <target-sums.json>
//   node --experimental-strip-types harness/db/migrate-export.ts wipe-sql  <public.sql> <auth.sql> <location-id>
//
// What moves (Chad, 2026-10-31): one location with everything under it; every login in the export
// (same ids, same password hashes); open invites are not copied. The operator login (an existing user
// in the new project) is added to the location as a manager.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

type Row = Record<string, string | null>;
type Table = { cols: string[]; rows: Row[] };

/** Parses pg_restore's plain-text COPY blocks. Values are unescaped exactly as COPY text format defines. */
export function parseCopy(path: string): Map<string, Table> {
  const out = new Map<string, Table>();
  let cur: Table | null = null;
  const unesc = (v: string): string | null =>
    v === "\\N" ? null : v.replace(/\\(.)/g, (_, c) => ({ t: "\t", n: "\n", r: "\r", b: "\b", f: "\f", v: "\v", "\\": "\\" } as Record<string, string>)[c] ?? c);
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!cur) {
      const m = /^COPY (\S+) \((.*)\) FROM stdin;$/.exec(line);
      if (m) {
        cur = { cols: m[2].split(", ").map((c) => c.replace(/^"|"$/g, "")), rows: [] };
        out.set(m[1].replace(/"/g, ""), cur);
      }
    } else if (line === "\\.") cur = null;
    else {
      const vals = line.split("\t");
      if (vals.length !== cur.cols.length) throw new Error(`COPY row has ${vals.length} values, expected ${cur.cols.length}`);
      cur.rows.push(Object.fromEntries(cur.cols.map((c, i) => [c, unesc(vals[i])])));
    }
  }
  return out;
}

/** The 17 public tables, in insert (foreign-key) order, and which rows of each move. */
const PUBLIC_ORDER = [
  "profiles", "user_roles", "locations", "app_settings", "staff", "staff_positions", "shifts",
  "shift_servers", "shift_server_members", "shift_bartenders", "shift_bartender_members", "shift_support",
  "location_members", "settings_audit", "tip_override_audit", "sms_sends", "location_invites",
] as const;
const NOT_COPIED: Record<string, string> = { location_invites: "open invites are not copied; re-send any still needed" };

type Plan = { table: string; cols: string[]; rows: Row[]; dropped: number; why?: string }[];

export function plan(pub: Map<string, Table>, auth: Map<string, Table>, loc: string): Plan {
  const t = (n: string) => {
    const x = pub.get(`public.${n}`);
    if (!x) throw new Error(`export has no public.${n}`);
    return x;
  };
  const extra = [...pub.keys()].filter((k) => !PUBLIC_ORDER.includes(k.replace(/^public\./, "") as never));
  if (extra.length) throw new Error(`export has public tables this loader does not know: ${extra.join(", ")}`);
  if (!t("locations").rows.some((r) => r.id === loc)) throw new Error(`location ${loc} is not in the export`);

  const staff = new Set(t("staff").rows.filter((r) => r.location_id === loc).map((r) => r.id));
  const shifts = new Set(t("shifts").rows.filter((r) => r.location_id === loc).map((r) => r.id));
  const servers = new Set(t("shift_servers").rows.filter((r) => shifts.has(r.shift_id!)).map((r) => r.id));
  const bartenders = new Set(t("shift_bartenders").rows.filter((r) => shifts.has(r.shift_id!)).map((r) => r.id));
  const keep: Record<string, (r: Row) => boolean> = {
    profiles: () => true,
    user_roles: () => true,
    locations: (r) => r.id === loc,
    app_settings: (r) => r.location_id === loc,
    staff: (r) => r.location_id === loc,
    staff_positions: (r) => staff.has(r.staff_id!),
    shifts: (r) => r.location_id === loc,
    shift_servers: (r) => shifts.has(r.shift_id!),
    shift_server_members: (r) => servers.has(r.shift_server_id!),
    shift_bartenders: (r) => shifts.has(r.shift_id!),
    shift_bartender_members: (r) => bartenders.has(r.shift_bartender_id!),
    shift_support: (r) => shifts.has(r.shift_id!),
    location_members: (r) => r.location_id === loc,
    settings_audit: (r) => r.location_id === loc,
    tip_override_audit: (r) => r.location_id === loc,
    sms_sends: (r) => r.location_id === loc,
    location_invites: () => false,
  };
  const out: Plan = [];
  for (const name of ["auth.users", "auth.identities"]) {
    const x = auth.get(name);
    if (!x) throw new Error(`export has no ${name}`);
    out.push({ table: name, cols: x.cols, rows: x.rows, dropped: 0 });
  }
  for (const n of PUBLIC_ORDER) {
    const x = t(n);
    const rows = x.rows.filter(keep[n]);
    out.push({ table: `public.${n}`, cols: x.cols, rows, dropped: x.rows.length - rows.length, why: NOT_COPIED[n] });
  }
  return out;
}

const lit = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);
const userIds = (p: Plan) => p.find((x) => x.table === "auth.users")!.rows.map((r) => r.id!);
const PUBLIC_TABLES = PUBLIC_ORDER.map((n) => `public.${n}`);

export function loadSql(p: Plan, loc: string, operatorEmail: string): string {
  const users = p.find((x) => x.table === "auth.users")!.rows;
  const ids = users.map((r) => lit(r.id)).join(", ");
  const emails = users.map((r) => lit((r.email ?? "").toLowerCase())).join(", ");
  const expected = p.map((x) => `(${lit(x.table)}, ${x.rows.length})`).join(", ");
  const staging = p.map((x, i) => {
    const name = `ttp_m${i}`;
    const create = `create temp table ${name} (_ord int, ${x.cols.map((c) => `"${c}" text`).join(", ")}) on commit drop;`;
    const ins = x.rows.length
      ? `insert into ${name} values\n  ${x.rows.map((r, j) => `(${j}, ${x.cols.map((c) => lit(r[c])).join(", ")})`).join(",\n  ")};`
      : "";
    return { name, table: x.table, sql: `${create}\n${ins}` };
  });
  return `-- Generated by harness/db/migrate-export.ts. Production data migration: one transaction, all or nothing.
begin;
set local search_path = public, extensions;
do $guard$
begin
  if exists (select 1 from public.locations) then
    raise exception 'refusing to load: public.locations is not empty (run remote-seed.sh reset first)';
  end if;
  if exists (select 1 from auth.users where id in (${ids}) or lower(email) in (${emails})) then
    raise exception 'refusing to load: a login from the export already exists in this project';
  end if;
  if not exists (select 1 from auth.users where lower(email) = lower(${lit(operatorEmail)})) then
    raise exception 'operator login % not found in auth.users', ${lit(operatorEmail)};
  end if;
end $guard$;

-- Copies a staging table into its target. Every staged column must land in an insertable column of
-- the target, unless all its values are null (auth columns may differ slightly between versions).
-- Public tables must match column for column: the schema is the production snapshot.
create function pg_temp.ttp_move(target regclass, staging text, exact boolean) returns void language plpgsql as $f$
declare cols text; exprs text; c record; n bigint;
begin
  for c in select a.attname from pg_attribute a where a.attrelid = ('pg_temp.' || staging)::regclass
           and a.attnum > 0 and not a.attisdropped and a.attname <> '_ord'
           and a.attname not in (select b.attname from pg_attribute b where b.attrelid = target
                                 and b.attnum > 0 and not b.attisdropped and b.attgenerated = '') loop
    execute format('select count(*) from pg_temp.%I where %I is not null', staging, c.attname) into n;
    if exact or n > 0 then raise exception 'column %.% from the export has no place in the target', target, c.attname; end if;
  end loop;
  if exact and exists (select 1 from pg_attribute b where b.attrelid = target and b.attnum > 0 and not b.attisdropped
                       and b.attgenerated = '' and b.attname not in (select a.attname from pg_attribute a
                       where a.attrelid = ('pg_temp.' || staging)::regclass)) then
    raise exception 'target % has a column the export lacks', target;
  end if;
  select string_agg(format('%I', b.attname), ', ' order by b.attnum),
         string_agg(format('s.%I::%s', b.attname, format_type(b.atttypid, b.atttypmod)), ', ' order by b.attnum)
    into cols, exprs
    from pg_attribute b where b.attrelid = target and b.attnum > 0 and not b.attisdropped and b.attgenerated = ''
     and b.attname in (select a.attname from pg_attribute a where a.attrelid = ('pg_temp.' || staging)::regclass);
  execute format('insert into %s (%s) overriding system value select %s from pg_temp.%I s order by s._ord', target, cols, exprs, staging);
end $f$;

${staging.map((s) => s.sql).join("\n")}

-- App triggers would invent rows that are not in the export (default settings, admin grants,
-- override and settings audit rows, fresh updated_at). Paused here, back on before commit.
${PUBLIC_TABLES.map((t) => `alter table ${t} disable trigger user;`).join("\n")}

-- auth.users has two app triggers (profile row, first-user admin) that this role cannot pause.
-- Their rows are replaced right after with the exported ones.
${staging.filter((s) => s.table.startsWith("auth.")).map((s) => `select pg_temp.ttp_move('${s.table}', '${s.name}', false);`).join("\n")}
delete from public.profiles where user_id in (${ids});
delete from public.user_roles where user_id in (${ids});
${staging.filter((s) => s.table.startsWith("public.")).map((s) => `select pg_temp.ttp_move('${s.table}', '${s.name}', true);`).join("\n")}

-- The operator (Chad) joins the location as a manager. Not production data; noted in the plan.
insert into public.location_members (location_id, user_id, role)
select ${lit(loc)}, id, 'manager' from auth.users where lower(email) = lower(${lit(operatorEmail)});

select setval('public.app_settings_id_seq', greatest((select max(id) from public.app_settings), 1));

${PUBLIC_TABLES.map((t) => `alter table ${t} enable trigger user;`).join("\n")}

do $post$
declare e record; n bigint; ids uuid[] := array[${ids}]::uuid[];
begin
  for e in select * from (values ${expected}) v(t, want) loop
    if e.t = 'auth.users' then
      execute 'select count(*) from auth.users where id = any($1)' into n using ids;
    elsif e.t in ('auth.identities', 'public.user_roles', 'public.profiles') then
      execute format('select count(*) from %s where user_id = any($1)', e.t) into n using ids;
    elsif e.t = 'public.location_members' then
      execute 'select count(*) - 1 from public.location_members' into n;  -- minus the operator
    else
      execute format('select count(*) from %s', e.t) into n;
    end if;
    if n <> e.want then raise exception 'after load % has % rows, expected %', e.t, n, e.want; end if;
  end loop;
end $post$;
commit;
`;
}

/** Row checksum both sides agree on: values as COPY text output (booleans t/f), tab-joined, null as \N. */
const rowHash = (cols: string[], r: Row) => createHash("md5").update(cols.map((c) => r[c] ?? "\\N").join("\t")).digest("hex");

export function sourceSums(p: Plan): Record<string, { rows: number; md5: string }> {
  return Object.fromEntries(p.map((x) => {
    const hs = x.rows.map((r) => rowHash(x.cols, r)).sort();
    return [x.table, { rows: x.rows.length, md5: createHash("md5").update(hs.join("")).digest("hex") }];
  }));
}

/** One SELECT returning {table: {rows, md5}} over the target. Operator rows are left out. */
export function sumsSql(p: Plan, operatorEmail: string): string {
  const op = `(select id from auth.users where lower(email) = lower(${lit(operatorEmail)}))`;
  const ids = userIds(p).map(lit).join(", ");
  const where: Record<string, string> = {
    "auth.users": `id in (${ids})`,
    "auth.identities": `user_id in (${ids})`,
    "public.profiles": `user_id is distinct from ${op}`,
    "public.user_roles": `user_id is distinct from ${op}`,
    "public.location_members": `user_id is distinct from ${op}`,
  };
  const parts = p.map((x) => {
    const line = `concat_ws(E'\\t', ${x.cols.map((c) => `coalesce(case when pg_typeof("${c}") = 'boolean'::regtype then left("${c}"::text, 1) else "${c}"::text end, '\\N')`).join(", ")})`;
    return `${lit(x.table)}, (select json_build_object('rows', count(*), 'md5', md5(coalesce(string_agg(h, '' order by h), '')))
      from (select md5(${line}) h from ${x.table} where ${where[x.table] ?? "true"}) z)`;
  });
  return `select json_build_object(\n  ${parts.join(",\n  ")}) as j`;
}

export function wipeSql(p: Plan, loc: string): string {
  const ids = userIds(p).map(lit).join(", ");
  return `-- Removes the migrated location and the migrated logins (no-go / redo). New project only.
begin;
delete from public.shifts where location_id = ${lit(loc)};
delete from public.staff_positions where staff_id in (select id from public.staff where location_id = ${lit(loc)});
delete from public.location_members where location_id = ${lit(loc)};
delete from public.sms_sends where location_id = ${lit(loc)};
delete from public.tip_override_audit where location_id = ${lit(loc)};
delete from public.settings_audit where location_id = ${lit(loc)};
delete from public.app_settings where location_id = ${lit(loc)};
delete from public.staff where location_id = ${lit(loc)};
delete from public.locations where id = ${lit(loc)};
delete from auth.users where id in (${ids});
commit;
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, pubPath, authPath, loc, arg] = process.argv.slice(2);
  const pub = parseCopy(pubPath), auth = parseCopy(authPath);
  if (cmd === "inspect") {
    // Structure only: ids, names, counts. No emails, names of staff, or amounts.
    for (const r of pub.get("public.locations")!.rows) {
      const n = (t: string) => pub.get(`public.${t}`)!.rows.filter((x) => x.location_id === r.id).length;
      console.log(`location ${r.id}  "${r.name}"  staff ${n("staff")}  shifts ${n("shifts")}`);
    }
    console.log(`logins: ${auth.get("auth.users")!.rows.length}`);
    for (const [k, v] of pub) console.log(`  ${k.padEnd(32)} ${v.rows.length}`);
  } else {
    const p = plan(pub, auth, loc);
    if (cmd === "load-sql") process.stdout.write(loadSql(p, loc, arg));
    else if (cmd === "sums-sql") process.stdout.write(sumsSql(p, arg));
    else if (cmd === "wipe-sql") process.stdout.write(wipeSql(p, loc));
    else if (cmd === "sums-cmp") {
      const want = sourceSums(p), got = JSON.parse(readFileSync(arg, "utf8"));
      let bad = 0;
      for (const x of p) {
        const w = want[x.table], g = got[x.table];
        const ok = g && g.rows === w.rows && g.md5 === w.md5;
        if (!ok) bad++;
        const note = x.dropped ? `  (${x.dropped} not copied${x.why ? `: ${x.why}` : ", other location"})` : "";
        console.log(`${ok ? "ok  " : "DIFF"} ${x.table.padEnd(32)} ${String(w.rows).padStart(5)} rows${ok ? "" : `, target ${g?.rows}`}${note}`);
      }
      console.log(bad ? `${bad} table(s) differ from the export` : "every table matches the export: row counts and checksums");
      if (bad) process.exit(1);
    } else {
      console.error("unknown command");
      process.exit(2);
    }
  }
}
