import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ImportClient } from "./import-client";

export const metadata: Metadata = { title: "Import items" };

export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Import from Excel"
        description="Upload your inventory sheet (.xlsx or .csv). You'll see a preview before anything is saved."
      />
      <ImportClient />
    </>
  );
}
