"use client";
import { useState } from "react";
import { ChevronDown, MessageSquareQuote } from "lucide-react";

/** Question d'entretien : on réfléchit d'abord, puis on compare à une réponse type. */
export function Interview({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="not-prose my-4 overflow-hidden rounded-2xl border-2 border-[#fedf89] bg-[#fffcf5]">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left sm:p-5"
      >
        <MessageSquareQuote size={22} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#dc6803]" />
        <span className="flex-1">
          <span className="block font-display text-lg font-bold leading-snug">« {q} »</span>
          {!open && <span className="mt-1 block text-sm text-[#93370d]">Formule ta réponse à voix haute, puis compare à une réponse type.</span>}
        </span>
        <ChevronDown size={20} className="mt-1 shrink-0 text-[#93370d] transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open && (
        <div className="animate-rise border-t-2 border-[#fedf89] px-4 pb-4 pt-3 sm:px-5">
          <div className="mb-1 text-sm font-bold text-[#93370d]">Réponse type</div>
          <div className="lesson-prose text-[0.98rem]">{children}</div>
        </div>
      )}
    </div>
  );
}
