"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Download, FileText, Loader2, Lock, Minus, PackageSearch, Plus, Search, Trash2, Upload } from "lucide-react";
import { createRequest, type RequestFormState } from "../actions";
import { Alert, Badge, Button, Card, Field, Input, Textarea, cx } from "@/components/ui";

export interface BorrowableItem {
  id: string;
  name: string;
  category: string;
  sku: string | null;
  inStock: boolean;
  /** Units in stock: the cart can't go above it (only admins see the number). */
  max: number;
}

const TEMPLATE_URL = "/request-template.pdf";

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function RequestBuilder({
  items,
  showCounts,
  initialItemId,
  today,
}: {
  items: BorrowableItem[];
  showCounts: boolean;
  initialItemId?: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<RequestFormState, FormData>(createRequest, {});
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>(() => {
    const first = items.find((i) => i.id === initialItemId && i.inStock);
    return first ? { [first.id]: 1 } : {};
  });
  const [due, setDue] = useState(addDays(today, 14));
  const [letterName, setLetterName] = useState("");
  // The official request form must be downloaded (and filled in) for every request.
  const [templateTaken, setTemplateTaken] = useState(false);
  const fe = state.fieldErrors ?? {};

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => !q || [i.name, i.category, i.sku].some((f) => f?.toLowerCase().includes(q)));
  }, [items, query]);

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const it = byId.get(id);
      const max = !it?.inStock ? 0 : it.max;
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
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]"
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
          // Phones: the list grows with the page so it scrolls naturally; desktop: its own scroll area.
          <ul className="divide-y divide-line lg:max-h-[38rem] lg:overflow-y-auto lg:overscroll-contain">
            {results.map((item, idx) => {
              const inCart = cart[item.id] ?? 0;
              const none = !item.inStock;
              const max = item.max;
              return (
                <li
                  key={item.id}
                  className={cx("enter-up flex items-center gap-3 px-4 py-3 transition-colors duration-300", inCart > 0 && "bg-brand-50/60")}
                  style={{ animationDelay: `${Math.min(idx, 12) * 25}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="text-xs text-muted">{item.category}</p>
                  </div>
                  {showCounts ? (
                    none ? (
                      <Badge tone="gray">Out of stock</Badge>
                    ) : (
                      <span className="text-sm tabular-nums text-muted">
                        <b className="text-ink">{item.max}</b> available
                      </span>
                    )
                  ) : (
                    none && <Badge tone="gray">Out of stock</Badge>
                  )}
                  <button
                    type="button"
                    disabled={none || inCart >= max}
                    onClick={() => setQty(item.id, inCart + 1)}
                    className="press grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
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
            {/* key change re-runs the pop each time the count changes */}
            <span key={totalUnits} className={cx("inline-block", totalUnits > 0 && "pop")}>
              <Badge>{totalUnits} unit{totalUnits === 1 ? "" : "s"}</Badge>
            </span>
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
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.name}</span>
                        {qty >= item.max && (
                          <span className="block text-xs font-medium text-warn">{showCounts ? `All ${item.max} in stock` : "That's all we have in stock"}</span>
                        )}
                      </span>
                      <div className="flex items-center">
                        <button type="button" onClick={() => setQty(item_id, qty - 1)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-brand-50" aria-label={`Remove one ${item.name}`}>
                          {qty === 1 ? <Trash2 className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                        </button>
                        <span className="w-7 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
                        <button type="button" onClick={() => setQty(item_id, qty + 1)} disabled={qty >= item.max} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-brand-50 disabled:opacity-40" aria-label={`Add one ${item.name}`}>
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
          <Field label="Project" htmlFor="project" error={fe.project} required>
            <Input id="project" name="project" required placeholder="e.g. Low-cost pulse oximeter" />
          </Field>
          <Field label="Purpose (optional)" htmlFor="purpose" error={fe.purpose}>
            <Textarea id="purpose" name="purpose" className="min-h-20" placeholder="What will you use the items for?" />
          </Field>
          <Field label="Return by" htmlFor="due_date" error={fe.due_date} required>
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
          <div className="flex flex-col gap-2 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
            <p className="text-sm font-semibold text-ink">
              Request form<span className="ml-0.5 text-bad" aria-hidden>*</span>
            </p>
            <ol className="list-inside list-decimal text-sm text-muted">
              <li>Download the Project Materials Request form</li>
              <li>Fill it in and save it as a PDF</li>
              <li>Upload it below</li>
            </ol>
            <a
              href={TEMPLATE_URL}
              download="Project-Materials-Request-Form.pdf"
              onClick={() => setTemplateTaken(true)}
              className={cx(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
                templateTaken ? "border border-line bg-white text-ink hover:bg-brand-50" : "bg-brand-600 text-white hover:bg-brand-700",
              )}
            >
              {templateTaken ? <CheckCircle2 className="size-4 text-ok" aria-hidden /> : <Download className="size-4" aria-hidden />}
              {templateTaken ? "Form downloaded — download again" : "Download request form (PDF)"}
            </a>
          </div>
          <Field
            label="Upload the filled-in form (PDF)"
            htmlFor="letter"
            error={fe.letter}
            hint={templateTaken ? "Max 5 MB." : "Download the request form first."}
            required
          >
            <label
              htmlFor="letter"
              aria-disabled={!templateTaken}
              className={cx(
                "relative flex min-h-14 items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-sm transition-colors",
                !templateTaken
                  ? "cursor-not-allowed border-line bg-surface text-muted"
                  : letterName
                    ? "cursor-pointer border-brand-300 bg-brand-50"
                    : "cursor-pointer border-line hover:border-brand-300",
              )}
            >
              {!templateTaken ? (
                <Lock className="size-5 text-muted" aria-hidden />
              ) : letterName ? (
                <FileText className="size-5 text-brand-600" aria-hidden />
              ) : (
                <Upload className="size-5 text-muted" aria-hidden />
              )}
              <span className="truncate font-medium">{letterName || (templateTaken ? "Choose PDF…" : "Locked until you download the form")}</span>
              <input
                id="letter"
                name="letter"
                type="file"
                accept="application/pdf,.pdf"
                required
                disabled={!templateTaken}
                className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
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
