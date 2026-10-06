import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, FileText, PackageCheck, User, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dueLabel, formatDate, today } from "@/lib/dates";
import type { BorrowRequest } from "@/lib/types";
import { Alert, Badge, Card, Field, Input, PageHeader, StatusBadge, Textarea, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { markReturned, reviewRequest } from "../actions";

export const metadata: Metadata = { title: "Request" };

export default async function RequestPage({ params, searchParams }: PageProps<"/requests/[id]">) {
  const profile = await requireUser();
  const isAdmin = profile.role === "admin";
  const { id } = await params;
  const { error, created } = await searchParams;
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("requests")
    .select("*, profiles!requests_student_id_fkey(full_name, student_id, email, department, year), request_items(item_id, qty, lost_qty, items(id, name, category, available_qty))")
    .eq("id", id)
    .maybeSingle<BorrowRequest>();
  if (!r) notFound();

  const letter = r.letter_path
    ? (await supabase.storage.from("letters").createSignedUrl(r.letter_path, 60 * 10)).data?.signedUrl
    : null;
  const t = today();
  const overdue = r.status === "approved" && r.due_date < t;
  const lines = r.request_items ?? [];
  const shortfall = lines.filter((l) => l.items && l.items.available_qty < l.qty);

  return (
    <>
      <PageHeader
        title={r.project}
        description={<span className="inline-flex items-center gap-2">Requested {formatDate(r.created_at)} <StatusBadge status={r.status} overdue={overdue} /></span>}
        actions={<Link href="/requests" className={buttonClass("secondary")}>All requests</Link>}
      />

      <div className="mb-4 flex flex-col gap-3">
        {created === "1" && <Alert tone="green">Request sent! You&apos;ll get an email when an admin reviews it.</Alert>}
        {typeof error === "string" && <Alert>{error}</Alert>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <h2 className="border-b border-line px-5 py-4 font-semibold">Items</h2>
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5">Item</th>
                  <th scope="col" className="px-5 py-2.5 text-right">Qty</th>
                  {isAdmin && r.status === "pending" && <th scope="col" className="px-5 py-2.5 text-right">In stock now</th>}
                  {r.status === "returned" && <th scope="col" className="px-5 py-2.5 text-right">Not returned</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l) => (
                  <tr key={l.item_id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{l.items?.name}</p>
                      <p className="text-xs text-muted">{l.items?.category}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{l.qty}</td>
                    {isAdmin && r.status === "pending" && (
                      <td className="px-5 py-3 text-right tabular-nums">
                        {l.items && l.items.available_qty < l.qty ? <Badge tone="red">{l.items.available_qty} only</Badge> : l.items?.available_qty}
                      </td>
                    )}
                    {r.status === "returned" && (
                      <td className="px-5 py-3 text-right tabular-nums">{l.lost_qty ? <Badge tone="red">{l.lost_qty}</Badge> : "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {r.purpose && (
            <Card className="p-5">
              <h2 className="mb-2 font-semibold">Purpose</h2>
              <p className="whitespace-pre-line text-muted">{r.purpose}</p>
            </Card>
          )}

          {r.admin_note && (
            <Card className="p-5">
              <h2 className="mb-2 font-semibold">Admin note</h2>
              <p className="whitespace-pre-line text-muted">{r.admin_note}</p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 p-5 text-sm">
            {r.profiles && (
              <div className="flex gap-3">
                <User className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
                <div>
                  <p className="font-semibold">{r.profiles.full_name}</p>
                  <p className="text-muted">{r.profiles.student_id} · {r.profiles.department}, year {r.profiles.year}</p>
                  <a href={`mailto:${r.profiles.email}`} className="text-brand-700 hover:underline">{r.profiles.email}</a>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
              <div>
                <p className="font-semibold">Return by {formatDate(r.due_date)}</p>
                {r.status === "approved" && <p className={overdue ? "font-semibold text-bad" : "text-muted"}>{dueLabel(r.due_date, t)}</p>}
                {r.returned_at && <p className="text-muted">Returned {formatDate(r.returned_at)}</p>}
              </div>
            </div>
            {letter && (
              <a href={letter} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                <FileText className="size-4" aria-hidden /> View request letter (PDF)
              </a>
            )}
          </Card>

          {isAdmin && r.status === "pending" && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Review</h2>
              {shortfall.length > 0 && (
                <div className="mb-3">
                  <Alert>Not enough stock for: {shortfall.map((l) => l.items?.name).join(", ")}. Approval will fail until stock is available.</Alert>
                </div>
              )}
              <form action={reviewRequest} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={r.id} />
                <Field label="Note to student (optional)" htmlFor="note">
                  <Textarea id="note" name="note" className="min-h-20" placeholder="e.g. Collect from the lab on Monday" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <SubmitButton name="decision" value="reject" variant="danger">
                    <XCircle className="size-4" aria-hidden /> Reject
                  </SubmitButton>
                  <SubmitButton name="decision" value="approve">
                    <CheckCircle2 className="size-4" aria-hidden /> Approve
                  </SubmitButton>
                </div>
                <p className="text-xs text-muted">Approving deducts the items from available stock.</p>
              </form>
            </Card>
          )}

          {isAdmin && r.status === "approved" && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Check items back in</h2>
              <form action={markReturned} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={r.id} />
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-semibold">Missing or broken (leave 0 if all fine)</legend>
                  {lines.map((l) => (
                    <label key={l.item_id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{l.items?.name}</span>
                      <Input type="number" name={`lost:${l.item_id}`} min={0} max={l.qty} defaultValue={0} inputMode="numeric" className="w-20" aria-label={`${l.items?.name} missing or broken`} />
                    </label>
                  ))}
                </fieldset>
                <Field label="Return note (optional)" htmlFor="return-note">
                  <Textarea id="return-note" name="note" className="min-h-20" />
                </Field>
                <SubmitButton pendingText="Saving…">
                  <PackageCheck className="size-4" aria-hidden /> Mark as returned
                </SubmitButton>
                <p className="text-xs text-muted">Returned units go back into available stock; missing ones are removed from the total.</p>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
