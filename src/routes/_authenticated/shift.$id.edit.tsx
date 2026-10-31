import { createFileRoute } from "@tanstack/react-router";
import { ShiftForm } from "./shift.new";

export const Route = createFileRoute("/_authenticated/shift/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Shift · Tip Share" }] }),
  component: EditShift,
});

function EditShift() {
  const { id } = Route.useParams();
  return <ShiftForm key={id} initialShiftId={id} />;
}
