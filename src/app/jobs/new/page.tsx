import { getDockMasterClient } from "@/lib/dockmaster/mock-client";
import { IntakeForm } from "@/components/intake/intake-form";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const client = getDockMasterClient();
  const technicians = (await client.listTechnicians())
    .filter((t) => t.role !== "service_manager")
    .map((t) => ({ id: t.id, name: t.name, role: t.role, skills: t.skills }));

  const defaultTechnicianId =
    technicians.find((t) => t.name === "Marcus Reyes")?.id ?? technicians[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New job from tech note</h1>
        <p className="text-sm text-muted-foreground">
          Pick the technician, load or paste the note, attach photos, then let Service Writer draft
          the estimate. You review every line before anything reaches the owner.
        </p>
      </div>
      <IntakeForm technicians={technicians} defaultTechnicianId={defaultTechnicianId} />
    </div>
  );
}
