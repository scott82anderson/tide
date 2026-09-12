import { GtmNav } from "@/components/gtm/gtm-nav";
import { getGtmClient } from "@/lib/gtm/prisma-client";

export const dynamic = "force-dynamic";

export default async function GtmLayout({ children }: { children: React.ReactNode }) {
  const pending = (await getGtmClient().listQueueItems({ status: ["pending"] })).length;
  return (
    <div className="space-y-5">
      <GtmNav pending={pending} />
      {children}
    </div>
  );
}
