import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import type { Item } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { RequestBuilder } from "./request-builder";

export const metadata: Metadata = { title: "Borrow items" };

export default async function NewRequestPage({ searchParams }: PageProps<"/requests/new">) {
  await requireUser();
  const { item } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("id, name, category, sku, location, available_qty, total_qty")
    .order("name");

  return (
    <>
      <PageHeader
        title="Borrow items"
        description="Pick what you need, attach your formal request letter, and an admin will approve it."
      />
      <RequestBuilder
        items={(data ?? []) as Pick<Item, "id" | "name" | "category" | "sku" | "location" | "available_qty" | "total_qty">[]}
        initialItemId={typeof item === "string" ? item : undefined}
        today={today()}
      />
    </>
  );
}
