import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { RequestBuilder, type BorrowableItem } from "./request-builder";

export const metadata: Metadata = { title: "Borrow items" };

export default async function NewRequestPage({ searchParams }: PageProps<"/requests/new">) {
  const profile = await requireUser();
  const isAdmin = profile.role === "admin";
  const { item } = await searchParams;

  const header = (
    <PageHeader
      title="Borrow items"
      description="Pick what you need, attach the filled-in request form, and an admin will approve it."
    />
  );

  if (!isAdmin && !profile.phone) {
    return (
      <>
        {header}
        <Card className="max-w-2xl">
          <EmptyState icon={<Phone className="size-6" />} title="Add your phone number first">
            <p>We need a phone number to send you return reminders before you can borrow items.</p>
            <Link href="/account" className={buttonClass("primary", "mt-4")}>
              Go to My account
            </Link>
          </EmptyState>
        </Card>
      </>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.from("items").select("id, name, category, sku, available_qty").order("name");
  // The cart stops at what is really in stock. Students never see the number itself.
  const items: BorrowableItem[] = (data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    sku: i.sku,
    inStock: i.available_qty > 0,
    max: i.available_qty,
  }));

  return (
    <>
      {header}
      <RequestBuilder
        items={items}
        showCounts={isAdmin}
        initialItemId={typeof item === "string" ? item : undefined}
        today={today()}
      />
    </>
  );
}
