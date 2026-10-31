import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/shifts")({
  head: () => ({ meta: [{ title: "Edit Shift · Tip Share" }] }),
  component: ShiftsList,
});

type Row = { id: string; shift_date: string; period: "AM" | "PM"; notes: string | null };

function ShiftsList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("shifts")
        .select("id, shift_date, period, notes")
        .order("shift_date", { ascending: false })
        .order("period", { ascending: false })
        .limit(100);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  async function deleteDay(date: string) {
    setDeleting(true);
    const ids = rows.filter((r) => r.shift_date === date).map((r) => r.id);
    if (ids.length) {
      await supabase.from("shift_bartender_members").delete().in(
        "shift_bartender_id",
        (
          (await supabase.from("shift_bartenders").select("id").in("shift_id", ids)).data ?? []
        ).map((b: { id: string }) => b.id),
      );
      await supabase.from("shift_servers").delete().in("shift_id", ids);
      await supabase.from("shift_bartenders").delete().in("shift_id", ids);
      await supabase.from("shift_support").delete().in("shift_id", ids);
      await supabase.from("shifts").delete().in("id", ids);
      setRows((prev) => prev.filter((r) => r.shift_date !== date));
    }
    setDeleting(false);
    setPendingDate(null);
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background border-b border-border z-10">
        <div className="max-w-2xl mx-auto p-4 flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
          <h1 className="text-lg font-serif flex-1">Edit Shift</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4 space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No shifts saved yet.</p>
        )}
        {(() => {
          const byDate = new Map<string, { AM?: Row; PM?: Row }>();
          for (const r of rows) {
            const slot = byDate.get(r.shift_date) ?? {};
            slot[r.period] = r;
            byDate.set(r.shift_date, slot);
          }
          const dates = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1));
          return dates.map((d) => {
            const slot = byDate.get(d)!;
            const label = new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
            return (
              <div key={d} className="bg-card border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{label}</div>
                  <div className="flex items-center gap-3">
                    <Link to="/daily" search={{ date: d }} className="text-xs text-primary underline">Print daily</Link>
                    <button onClick={() => setPendingDate(d)} className="text-xs text-destructive underline">Delete day</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(["AM", "PM"] as const).map((p) => {
                    const r = slot[p];
                    const cls = p === "AM" ? "bg-amber-100 text-amber-900" : "bg-indigo-100 text-indigo-900";
                    return r ? (
                      <Link key={p} to="/shift/$id/edit" params={{ id: r.id }} className="flex items-center justify-between border border-border rounded-md px-3 py-2 hover:bg-secondary/50">
                        <span className="text-sm">Edit {p}</span>
                        <span className={`text-xs px-2 py-1 rounded font-medium ${cls}`}>{p}</span>
                      </Link>
                    ) : (
                      <Link key={p} to="/shift/new" search={{ date: d, period: p }} className="flex items-center justify-between border border-dashed border-border rounded-md px-3 py-2 text-muted-foreground hover:bg-secondary/50">
                        <span className="text-sm">+ Add {p}</span>
                        <span className={`text-xs px-2 py-1 rounded font-medium opacity-60 ${cls}`}>{p}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </main>

      {pendingDate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-5 max-w-sm w-full space-y-3">
            <h2 className="text-base font-serif">Delete this day?</h2>
            <p className="text-sm text-muted-foreground">
              This permanently deletes all AM and PM shifts and entries for{" "}
              {new Date(pendingDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setPendingDate(null)} disabled={deleting} className="h-10 px-4 rounded-md border border-border text-sm">Cancel</button>
              <button onClick={() => deleteDay(pendingDate)} disabled={deleting} className="h-10 px-4 rounded-md bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-60">
                {deleting ? "Deleting…" : "Delete day"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
