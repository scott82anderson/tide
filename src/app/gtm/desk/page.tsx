import { Headset } from "lucide-react";
import { DeskForms } from "@/components/gtm/desk-forms";
import { OBJECTIONS } from "@/lib/gtm/objection-library";
import { KNOWLEDGE } from "@/lib/gtm/knowledge";
import { getGtmClient } from "@/lib/gtm/prisma-client";

export const dynamic = "force-dynamic";

export default async function DeskPage() {
  const accounts = await getGtmClient().listAccounts();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Headset className="size-5" /> Desk
        </h1>
        <p className="text-sm text-muted-foreground">
          Live call support from the Objection Coach and RFP, security and technical answers from the Sales Engineer. Both choose only from the library and the documents they are shown.
        </p>
      </div>
      <DeskForms
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        objections={OBJECTIONS.map((o) => ({ id: o.id, objection: o.objection }))}
        docs={KNOWLEDGE.map((d) => ({ id: d.id, title: d.title, kind: d.kind }))}
      />
    </div>
  );
}
