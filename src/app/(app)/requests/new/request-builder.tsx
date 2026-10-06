"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FileText, Loader2, Minus, PackageSearch, Plus, Search, Trash2, Upload } from "lucide-react";
import { createRequest, type RequestFormState } from "../actions";
import { Alert, Badge, Button, Card, Field, Input, Textarea, cx } from "@/components/ui";
import type { Item } from "@/lib/types";

type PickItem = Pick<Item, "id" | "name" | "category" | "sku" | "location" | "available_qty" | "total_qty">;

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function RequestBuilder({
  items,
  initialItemId,
  today,
}: {
  items: PickItem[];
  initialItemId?: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<RequestFormState, FormData>(createRequest, {});
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>(() => {
    const first = items.find((i) => i.id === initialItemId && i.available_qty > 0);
    return first ? { [first.id]: 1 } : {};
  });
  const [due, setDue] = useState(addDays(today, 14));
  const [letterName, setLetterName] = useState("");
  const fe = state.fieldErrors ?? {};

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => !q || [i.name, i.category, i.sku].some((f) => f?.toLowerCase().includes(q)))
      .slice(0, 40);
  }, [items, query]);

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const max = byId.get(id)?.available_qty ?? 0;
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(qty, max);
      return next;
    });

  const lines = Object.entries(cart).map(([item_id, qty]) => ({ item_id, qty }));
  const totalUnits = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <form
      // Submitted manually so a server-side error doesn't reset the form (and the chosen PDF).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid gap-6 lg:grid-cols-[1fr_24rem]"
    >
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <Card className="overflow-hidden">
        <div className="border-b border-line p-4">
          <label htmlFor="item-search" className="sr-only">Search items</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              id="item-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools, components, supplies…"
              className="pl-10"
              autoComplete="off"
            />
          </div>
        </div>
        {results.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center text-muted">
            <PackageSearch className="size-8 text-brand-400" aria-hidden />
            No items match “{query}”.
          </div>
        ) : (
          <ul className="max-h-[34rem] divide-y divide-line overflow-y-auto">
            {results.map((item) => {
              const inCart = cart[item.id] ?? 0;
              const none = item.available_qty === 0;
              return (
                <li key={item.id} className={cx("flex items-center gap-3 px-4 py-3", inCart > 0 && "bg-brand-50/60")}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="text-xs text-muted">
                      {item.category}
                      {item.location && ` · ${item.location}`}
                    </p>
                  </div>
                  {none ? (
                    <Badge tone="gray">Unavailable</Badge>
                  ) : (
                    <span className="text-sm tabular-nums text-muted">
                      <b className="text-ink">{item.available_qty}</b> available
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={none || inCart >= item.available_qty}
                    onClick={() => setQty(item.id, inCart + 1)}
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
                    aria-label={`Add one ${item.name}`}
                  >
                    <Plus className="size-5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Your request</h2>
            <Badge>{totalUnits} unit{totalUnits === 1 ? "" : "s"}</Badge>
          </div>
          {lines.length === 0 ? (
            <p className={cx("rounded-xl border border-dashed p-4 text-center text-sm", fe.lines ? "border-bad/40 text-bad" : "border-line text-muted")}>
              {fe.lines ?? "Add items from the list."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {lines.map(({ item_id, qty }) => {
                  const item = byId.get(item_id)!;
                  return (
                    <motion.li
                      key={item_id}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      className="flex items-center gap-2 rounded-xl border border-line p-2 pl-3"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                      <div className="flex items-center">
                        <button type="button" onClick={() => setQty(item_id, qty - 1)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-brand-50" aria-label={`Remove one ${item.name}`}>
                          {qty === 1 ? <Trash2 className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                        </button>
                        <span className="w-7 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
                        <button type="button" onClick={() => setQty(item_id, qty + 1)} disabled={qty >= item.available_qty} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-brand-50 disabled:opacity-40" aria-label={`Add one ${item.name}`}>
                          <Plus className="size-4" aria-hidden />
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          {state.error && <Alert>{state.error}</Alert>}
          <Field label="Project" htmlFor="project" error={fe.project}>
            <Input id="project" name="project" required placeholder="e.g. Low-cost pulse oximeter" />
          </Field>
          <Field label="Purpose (optional)" htmlFor="purpose" error={fe.purpose}>
            <Textarea id="purpose" name="purpose" className="min-h-20" placeholder="What will you use the items for?" />
          </Field>
          <Field label="Return by" htmlFor="due_date" error={fe.due_date}>
            <Input id="due_date" name="due_date" type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} required />
            <div className="flex flex-wrap gap-1.5">
              {[
                [7, "1 week"],
                [14, "2 weeks"],
                [30, "1 month"],
              ].map(([days, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setDue(addDays(today, days as number))}
                  className={cx(
                    "min-h-8 rounded-full px-3 text-xs font-semibold ring-1 ring-inset",
                    due === addDays(today, days as number) ? "bg-brand-600 text-white ring-brand-600" : "text-muted ring-line hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Request letter (PDF)" htmlFor="letter" error={fe.letter} hint="Your formal letter listing the items you need. Max 5 MB.">
            <label
              htmlFor="letter"
              className={cx(
                "relative flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-sm transition-colors",
                letterName ? "border-brand-300 bg-brand-50" : "border-line hover:border-brand-300",
              )}
            >
              {letterName ? <FileText className="size-5 text-brand-600" aria-hidden /> : <Upload className="size-5 text-muted" aria-hidden />}
              <span className="truncate font-medium">{letterName || "Choose PDF…"}</span>
              <input
                id="letter"
                name="letter"
                type="file"
                accept="application/pdf,.pdf"
                required
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e) => setLetterName(e.target.files?.[0]?.name ?? "")}
              />
            </label>
          </Field>
          <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {pending ? "Sending request…" : "Send request"}
          </Button>
        </Card>
      </div>
    </form>
  );
}
