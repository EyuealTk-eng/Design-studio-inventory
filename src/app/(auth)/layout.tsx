import { Boxes, BellRing, FileCheck2 } from "lucide-react";
import { Logo } from "@/components/ui";
import { Ecg } from "@/components/ecg";

const highlights = [
  { icon: Boxes, text: "Live stock levels for every tool and component" },
  { icon: FileCheck2, text: "Request items with your formal letter, approved online" },
  { icon: BellRing, text: "Return reminders before your due date" },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-hero p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Ecg beats={5} strokeWidth={2.5} className="absolute inset-x-0 top-28 h-24 w-full text-white/80" />
        <div className="relative flex items-center gap-3">
          <Logo className="size-10 text-white/15" />
          <span className="text-lg font-bold">Biomedical Design Studio</span>
        </div>
        <div className="enter-up relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Every instrument, accounted for.
          </h2>
          <ul className="mt-8 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/90">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10">
                  <Icon className="size-5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/70">Studio Inventory</p>
      </aside>
      <main className="flex items-center justify-center bg-card px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="size-10 text-brand-600" />
            <span className="text-lg font-bold">Biomedical Design Studio</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
