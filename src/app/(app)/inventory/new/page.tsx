import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Add item" };

export default async function NewItemPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("items").select("category");
  const categories = [...new Set((data ?? []).map((r) => r.category as string))].sort();
  return (
    <>
      <PageHeader title="Add item" description="Add a new tool, component or supply to the inventory." />
      <Card className="max-w-3xl p-6">
        <ItemForm categories={categories} />
      </Card>
    </>
  );
}
