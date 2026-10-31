// Adapts the nested rows the app's Supabase selects return into engine ShiftInput.
// Pure: no Supabase import. Columns a select did not fetch stay absent (no defaults added).
import type {
  BartenderEntryInput,
  ServerEntryInput,
  ShiftInput,
  SupportInput,
} from "./compute-shift.ts";
import type { BartenderMember } from "./calculations.ts";

export type DbShiftRow = {
  support_split_mode?: string | null;
  shift_servers: (Omit<ServerEntryInput, "members"> & {
    shift_server_members?: BartenderMember[];
  })[];
  shift_bartenders: (Omit<BartenderEntryInput, "members"> & {
    shift_bartender_members?: BartenderMember[];
  })[];
  shift_support: SupportInput[];
};

export function fromDbShift(sh: DbShiftRow): ShiftInput {
  return {
    support_split_mode: sh.support_split_mode,
    servers: sh.shift_servers.map(({ shift_server_members, ...e }) => ({
      ...e,
      members: shift_server_members ?? [],
    })),
    bartenders: sh.shift_bartenders.map(({ shift_bartender_members, ...e }) => ({
      ...e,
      members: shift_bartender_members ?? [],
    })),
    support: sh.shift_support,
  };
}
