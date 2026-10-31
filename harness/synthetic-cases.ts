// Synthetic edge-case INPUTS for paths the Carson's Table data does not exercise.
// Expected values are NOT written by hand: `harness/gen-synthetic.ts` runs the frozen
// v1 reference pipeline over these inputs and writes fixtures/synthetic_v1.json.
// Staff IDs use an X prefix so they can never collide with the pseudonymized S01–S24.

export type SyntheticCase = {
  name: string;
  covers: string[];
  settings_overrides: Record<string, unknown>;
  shift: any;
};

/** Synthetic staff with their CURRENT primary role (what `staff.role` holds). */
export const SYNTHETIC_STAFF: { id: string; role: string }[] = [
  { id: "X01", role: "server" },
  { id: "X02", role: "server" },
  { id: "X03", role: "server" },
  { id: "X04", role: "server" },
  { id: "X10", role: "bartender" },
  { id: "X11", role: "bartender" },
  { id: "X12", role: "bartender" },
  { id: "X20", role: "runner" },
  { id: "X21", role: "busser" },
  { id: "X22", role: "bar_back" },
  { id: "X23", role: "hostess" },
  { id: "X24", role: "server" }, // server by primary role, sometimes worked support
];

const sv = (
  staff_id: string | null,
  cash_owed: number,
  credit_tips: number,
  lbw_sales: number,
  extra: Record<string, unknown> = {},
) => ({
  staff_id,
  cash_owed,
  credit_tips,
  lbw_sales,
  total_sales: 0,
  bar_tip_override: null,
  rb_tip_override: null,
  split_mode: "single",
  members: [],
  ...extra,
});
const bt = (
  staff_id: string | null,
  cash_owed: number,
  credit_tips: number,
  extra: Record<string, unknown> = {},
) => ({
  staff_id,
  cash_owed,
  credit_tips,
  total_sales: 0,
  rb_tip_override: null,
  split_mode: "single",
  members: [],
  ...extra,
});
const sp = (staff_id: string, hours_worked: number, role: string | null) => ({
  staff_id,
  hours_worked,
  role,
});
const shift = (
  key: string,
  parts: { servers?: any[]; bartenders?: any[]; support?: any[]; support_split_mode?: string },
) => ({
  key,
  shift_date: "2099-01-01",
  period: "PM",
  support_split_mode: parts.support_split_mode ?? "weighted",
  servers: parts.servers ?? [],
  bartenders: parts.bartenders ?? [],
  support: parts.support ?? [],
});

/** A busy, fractional-cents shift used as the base for settings variations. */
const mixed = (key: string) =>
  shift(key, {
    servers: [
      sv("X01", 120.37, 245.55, 87.25),
      sv("X02", 0, 180.1, 0),
      sv("X03", 55.5, 99.99, 312.4),
    ],
    bartenders: [bt("X10", 300.25, 410.73)],
    support: [sp("X20", 5.5, "runner"), sp("X21", 4.25, "busser")],
  });

/** Same as `mixed` but with total_sales populated, for rb_basis = "sales". */
const mixedWithSales = (key: string) => {
  const s = mixed(key);
  s.servers[0].total_sales = 1200.5;
  s.servers[1].total_sales = 950;
  s.servers[2].total_sales = 2100.25;
  s.bartenders[0].total_sales = 1875.4;
  return s;
};

export const SYNTHETIC_CASES: SyntheticCase[] = [
  // ---- rounding modes (production uses only "nearest") ----
  {
    name: "rounding nearest (control)",
    covers: ["rounding_mode=nearest"],
    settings_overrides: { rounding_mode: "nearest" },
    shift: mixed("SYN-round-nearest"),
  },
  {
    name: "rounding none",
    covers: ["rounding_mode=none"],
    settings_overrides: { rounding_mode: "none" },
    shift: mixed("SYN-round-none"),
  },
  {
    name: "rounding up",
    covers: ["rounding_mode=up"],
    settings_overrides: { rounding_mode: "up" },
    shift: mixed("SYN-round-up"),
  },
  {
    name: "rounding down",
    covers: ["rounding_mode=down"],
    settings_overrides: { rounding_mode: "down" },
    shift: mixed("SYN-round-down"),
  },
  {
    name: "rounding_mode missing defaults to nearest",
    covers: ["rounding_mode=undefined"],
    settings_overrides: { rounding_mode: undefined },
    shift: mixed("SYN-round-undefined"),
  },

  // ---- net sales / card fee ----
  {
    name: "use_net_sales with 8.75% tax",
    covers: ["use_net_sales", "sales_tax_pct"],
    settings_overrides: { use_net_sales: true, sales_tax_pct: 0.0875 },
    shift: mixed("SYN-net-sales"),
  },
  {
    name: "use_net_sales on but tax 0 (no-op)",
    covers: ["use_net_sales", "sales_tax_pct=0"],
    settings_overrides: { use_net_sales: true, sales_tax_pct: 0 },
    shift: mixed("SYN-net-sales-zero-tax"),
  },
  {
    name: "cc_fee_enabled with 3% fee",
    covers: ["cc_fee_enabled", "cc_fee_pct"],
    settings_overrides: { cc_fee_enabled: true, cc_fee_pct: 0.03 },
    shift: mixed("SYN-cc-fee"),
  },
  {
    name: "net sales and card fee together, rounding none",
    covers: ["use_net_sales", "cc_fee_enabled", "rounding_mode=none"],
    settings_overrides: {
      use_net_sales: true,
      sales_tax_pct: 0.0875,
      cc_fee_enabled: true,
      cc_fee_pct: 0.03,
      rounding_mode: "none",
    },
    shift: mixed("SYN-net-and-fee"),
  },

  // ---- rb_basis = "sales" ----
  {
    name: "rb_basis sales with total_sales",
    covers: ["rb_basis=sales", "total_sales>0"],
    settings_overrides: { rb_basis: "sales" },
    shift: mixedWithSales("SYN-rb-sales"),
  },
  {
    name: "rb_basis sales without total_sales (computes from $0)",
    covers: ["rb_basis=sales", "total_sales=0"],
    settings_overrides: { rb_basis: "sales" },
    shift: mixed("SYN-rb-sales-no-total"),
  },
  {
    name: "rb_basis sales with total_sales field absent",
    covers: ["rb_basis=sales", "total_sales=undefined"],
    settings_overrides: { rb_basis: "sales" },
    shift: (() => {
      const s = mixed("SYN-rb-sales-absent");
      for (const e of [...s.servers, ...s.bartenders]) delete (e as any).total_sales;
      return s;
    })(),
  },
  {
    name: "rb_basis sales with net sales tax",
    covers: ["rb_basis=sales", "use_net_sales"],
    settings_overrides: { rb_basis: "sales", use_net_sales: true, sales_tax_pct: 0.0875 },
    shift: mixedWithSales("SYN-rb-sales-net"),
  },

  // ---- cap ----
  {
    name: "cap binds without overrides",
    covers: ["cap binding", "no overrides"],
    settings_overrides: {},
    shift: shift("SYN-cap-binds", {
      servers: [sv("X01", 0, 50, 400), sv("X02", 0, 120, 380)],
      bartenders: [bt("X10", 0, 200)],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "cap binds without overrides, rounding none",
    covers: ["cap binding", "rounding_mode=none"],
    settings_overrides: { rounding_mode: "none" },
    shift: shift("SYN-cap-binds-none", {
      servers: [sv("X01", 0, 51.37, 413.29)],
      bartenders: [bt("X10", 0, 200)],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "overrides exceed the cap",
    covers: ["overrides > cap"],
    settings_overrides: {},
    shift: shift("SYN-override-over-cap", {
      servers: [sv("X01", 0, 100, 50, { bar_tip_override: 25, rb_tip_override: 20 })],
      bartenders: [bt("X10", 0, 100, { rb_tip_override: 45 })],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "fractional overrides are rounded by rounding mode",
    covers: ["overrides", "rounding_mode=nearest"],
    settings_overrides: {},
    shift: shift("SYN-override-fractional", {
      servers: [sv("X01", 0, 100, 50, { bar_tip_override: 4.5, rb_tip_override: 2.49 })],
      bartenders: [bt("X10", 0, 100, { rb_tip_override: 9.5 })],
      support: [sp("X20", 5, "runner")],
    }),
  },

  // ---- zero credit tips with positive sales ----
  {
    name: "zero credit tips with positive sales, no overrides",
    covers: ["credit_tips=0", "lbw_sales>0"],
    settings_overrides: {},
    shift: shift("SYN-zero-tips", {
      servers: [sv("X01", 200, 0, 500)],
      bartenders: [bt("X10", 0, 150)],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "zero credit tips with positive sales and overrides (negative take-home)",
    covers: ["credit_tips=0", "negative takehome"],
    settings_overrides: {},
    shift: shift("SYN-zero-tips-override", {
      servers: [sv("X01", 200, 0, 500, { bar_tip_override: 50, rb_tip_override: 10 })],
      bartenders: [bt("X10", 0, 0, { rb_tip_override: 5 })],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "zero credit tips with positive sales, rb_basis sales",
    covers: ["credit_tips=0", "rb_basis=sales"],
    settings_overrides: { rb_basis: "sales" },
    shift: shift("SYN-zero-tips-sales-basis", {
      servers: [sv("X01", 200, 0, 500, { total_sales: 900 })],
      bartenders: [bt("X10", 0, 150, { total_sales: 600 })],
      support: [sp("X20", 5, "runner")],
    }),
  },

  // ---- support roles and weighted pools ----
  {
    name: "hostess and bar_back weighted with runner and busser",
    covers: ["role=hostess", "role=bar_back", "weighted"],
    settings_overrides: {},
    shift: shift("SYN-support-roles", {
      servers: [sv("X01", 0, 300, 200), sv("X02", 0, 260, 100)],
      bartenders: [bt("X10", 0, 280)],
      support: [
        sp("X20", 5, "runner"),
        sp("X21", 4, "busser"),
        sp("X22", 6, "bar_back"),
        sp("X23", 4.5, "hostess"),
      ],
    }),
  },
  {
    name: "support role fallback: null and invalid shift roles",
    covers: ["resolveSupportRole fallback"],
    settings_overrides: {},
    shift: shift("SYN-support-role-fallback", {
      servers: [sv("X01", 0, 300, 200)],
      bartenders: [bt("X10", 0, 280)],
      // X23 null -> hostess (staff role); X24 null -> runner (server is not support); X22 "server" -> bar_back (staff role)
      support: [sp("X23", 5, null), sp("X24", 5, null), sp("X22", 5, "server")],
    }),
  },
  {
    name: "weighted pool where all hours are zero",
    covers: ["weighted", "all hours zero"],
    settings_overrides: {},
    shift: shift("SYN-support-zero-hours", {
      servers: [sv("X01", 0, 300, 200)],
      bartenders: [bt("X10", 0, 280)],
      support: [sp("X20", 0, "runner"), sp("X23", 0, "hostess")],
    }),
  },
  {
    name: "shared support pool with uneven division",
    covers: ["shared", "uneven"],
    settings_overrides: {},
    shift: shift("SYN-support-shared-uneven", {
      support_split_mode: "shared",
      servers: [sv("X01", 0, 251, 0)],
      bartenders: [],
      support: [sp("X20", 5, "runner"), sp("X21", 3, "busser"), sp("X23", 2, "hostess")],
    }),
  },
  {
    name: "shared support pool, rounding none",
    covers: ["shared", "rounding_mode=none"],
    settings_overrides: { rounding_mode: "none" },
    shift: shift("SYN-support-shared-none", {
      support_split_mode: "shared",
      servers: [sv("X01", 0, 251, 0)],
      support: [sp("X20", 5, "runner"), sp("X21", 3, "busser"), sp("X23", 2, "hostess")],
    }),
  },
  {
    name: "unknown support_split_mode is treated as weighted",
    covers: ["support_split_mode unknown"],
    settings_overrides: {},
    shift: shift("SYN-support-mode-unknown", {
      support_split_mode: "even",
      servers: [sv("X01", 0, 300, 0)],
      support: [sp("X20", 6, "runner"), sp("X23", 6, "hostess")],
    }),
  },

  // ---- split entries ----
  {
    name: "server split equal, uneven cents",
    covers: ["server split equal", "uneven cents"],
    settings_overrides: {},
    shift: shift("SYN-split-server-equal", {
      servers: [
        sv(null, 100, 100, 37, {
          split_mode: "equal",
          members: [
            { staff_id: "X01", hours_worked: 0 },
            { staff_id: "X02", hours_worked: 0 },
            { staff_id: "X03", hours_worked: 0 },
          ],
        }),
      ],
      bartenders: [bt("X10", 0, 100)],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "server split by hours",
    covers: ["server split hours"],
    settings_overrides: {},
    shift: shift("SYN-split-server-hours", {
      servers: [
        sv(null, 77.77, 333.33, 120, {
          split_mode: "hours",
          members: [
            { staff_id: "X01", hours_worked: 5 },
            { staff_id: "X02", hours_worked: 3.5 },
            { staff_id: "X03", hours_worked: 0 },
          ],
        }),
      ],
      bartenders: [bt("X10", 0, 100)],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "server split by hours with zero total hours (falls back to equal)",
    covers: ["server split hours", "zero total hours"],
    settings_overrides: {},
    shift: shift("SYN-split-server-hours-zero", {
      servers: [
        sv(null, 50, 200, 100, {
          split_mode: "hours",
          members: [
            { staff_id: "X01", hours_worked: 0 },
            { staff_id: "X02", hours_worked: 0 },
            { staff_id: "X03", hours_worked: 0 },
          ],
        }),
      ],
      bartenders: [bt("X10", 0, 100)],
    }),
  },
  {
    name: "bartender split equal, uneven cents",
    covers: ["bartender split equal", "uneven cents"],
    settings_overrides: {},
    shift: shift("SYN-split-bar-equal", {
      servers: [sv("X01", 0, 200, 333)],
      bartenders: [
        bt(null, 100, 500, {
          split_mode: "equal",
          members: [
            { staff_id: "X10", hours_worked: 0 },
            { staff_id: "X11", hours_worked: 0 },
            { staff_id: "X12", hours_worked: 0 },
          ],
        }),
      ],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "bartender split by hours",
    covers: ["bartender split hours"],
    settings_overrides: {},
    shift: shift("SYN-split-bar-hours", {
      servers: [sv("X01", 0, 200, 333)],
      bartenders: [
        bt(null, 100, 500, {
          split_mode: "hours",
          members: [
            { staff_id: "X10", hours_worked: 6 },
            { staff_id: "X11", hours_worked: 2.5 },
          ],
        }),
      ],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "bartender split by hours with zero total hours (falls back to equal)",
    covers: ["bartender split hours", "zero total hours"],
    settings_overrides: {},
    shift: shift("SYN-split-bar-hours-zero", {
      servers: [sv("X01", 0, 200, 333)],
      bartenders: [
        bt(null, 100, 500, {
          split_mode: "hours",
          members: [
            { staff_id: "X10", hours_worked: 0 },
            { staff_id: "X11", hours_worked: 0 },
          ],
        }),
      ],
    }),
  },
  {
    name: "split mode set but no members (entry paid to no one)",
    covers: ["split without members", "unallocated"],
    settings_overrides: {},
    shift: shift("SYN-split-no-members", {
      servers: [sv(null, 40, 150, 200, { split_mode: "equal", members: [] }), sv("X02", 0, 100, 0)],
      bartenders: [bt(null, 60, 300, { split_mode: "hours", members: [] })],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "single-mode entries with null staff_id (paid to no one)",
    covers: ["single with null staff", "unallocated"],
    settings_overrides: {},
    shift: shift("SYN-single-null-staff", {
      servers: [sv(null, 40, 150, 200), sv("X02", 0, 100, 0)],
      bartenders: [bt(null, 60, 300), bt("X10", 0, 100)],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "split entries with rounding none",
    covers: ["server split equal", "bartender split hours", "rounding_mode=none"],
    settings_overrides: { rounding_mode: "none" },
    shift: shift("SYN-split-rounding-none", {
      servers: [
        sv(null, 100, 100.01, 37.37, {
          split_mode: "equal",
          members: [
            { staff_id: "X01", hours_worked: 0 },
            { staff_id: "X02", hours_worked: 0 },
            { staff_id: "X03", hours_worked: 0 },
          ],
        }),
      ],
      bartenders: [
        bt(null, 10, 250.55, {
          split_mode: "hours",
          members: [
            { staff_id: "X10", hours_worked: 7 },
            { staff_id: "X11", hours_worked: 3 },
          ],
        }),
      ],
      support: [sp("X20", 3, "runner"), sp("X21", 4, "busser")],
    }),
  },

  // ---- missing roles on the shift ----
  {
    name: "servers and no support staff (support tip-out paid to no one)",
    covers: ["no support staff", "unallocated"],
    settings_overrides: {},
    shift: shift("SYN-no-support", {
      servers: [sv("X01", 50, 300, 250), sv("X02", 0, 200, 100)],
      bartenders: [bt("X10", 100, 250)],
      support: [],
    }),
  },
  {
    name: "servers and no bartenders (bar tip-out paid to no one)",
    covers: ["no bartenders", "unallocated"],
    settings_overrides: {},
    shift: shift("SYN-no-bartenders", {
      servers: [sv("X01", 50, 300, 250), sv("X02", 0, 200, 100)],
      bartenders: [],
      support: [sp("X20", 5, "runner"), sp("X21", 3, "busser")],
    }),
  },
  {
    name: "bartenders only",
    covers: ["no servers"],
    settings_overrides: {},
    shift: shift("SYN-bartenders-only", {
      bartenders: [bt("X10", 100, 250), bt("X11", 0, 175)],
      support: [sp("X22", 5, "bar_back")],
    }),
  },
  {
    name: "three bartender entries, bar total not divisible by three",
    covers: ["bartender count 3", "round2 collected"],
    settings_overrides: {},
    shift: shift("SYN-three-bartenders", {
      servers: [sv("X01", 0, 300, 250), sv("X02", 0, 200, 150)],
      bartenders: [bt("X10", 0, 100), bt("X11", 0, 100), bt("X12", 0, 100)],
      support: [sp("X20", 5, "runner")],
    }),
  },
  {
    name: "three bartender entries, rounding none",
    covers: ["bartender count 3", "round2 collected", "rounding_mode=none"],
    settings_overrides: { rounding_mode: "none" },
    shift: shift("SYN-three-bartenders-none", {
      servers: [sv("X01", 0, 300, 251.11), sv("X02", 0, 200, 150.07)],
      bartenders: [bt("X10", 0, 100), bt("X11", 0, 100), bt("X12", 0, 100)],
      support: [sp("X20", 5, "runner")],
    }),
  },

  // ---- duplicates ----
  {
    name: "duplicate staff IDs in support rows (find takes the first match)",
    covers: ["duplicate support staff_id"],
    settings_overrides: {},
    shift: shift("SYN-dup-support", {
      servers: [sv("X01", 0, 300, 200)],
      bartenders: [bt("X10", 0, 280)],
      support: [sp("X20", 3, "runner"), sp("X21", 4, "busser"), sp("X20", 5, "runner")],
    }),
  },
  {
    name: "same person in two roles on one shift",
    covers: ["multi-role person"],
    settings_overrides: {},
    shift: shift("SYN-multi-role", {
      servers: [sv("X24", 20, 150, 100), sv("X01", 0, 200, 100)],
      bartenders: [bt("X10", 0, 280)],
      support: [sp("X24", 3, "runner"), sp("X20", 5, "runner")],
    }),
  },
];
