"use client";
import clsx from "clsx";
import { FileText, Trophy, Zap } from "lucide-react";
import { useProgress } from "@/lib/store";

export function Toaster() {
  const toasts = useProgress((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex max-w-[22rem] flex-col items-end gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "animate-pop flex items-start gap-2.5 rounded-2xl px-4 py-2.5 text-sm shadow-lg",
            t.tone === "xp" && "bg-ink font-bold text-white",
            t.tone === "badge" && "bg-xp text-ink",
            t.tone === "level" && "bg-accent text-white",
            t.tone === "info" && "border border-line bg-surface font-semibold text-ink",
          )}
        >
          {t.tone === "xp" && <Zap size={16} className="mt-0.5 shrink-0 text-xp" fill="currentColor" />}
          {t.tone === "badge" && <Trophy size={17} className="mt-0.5 shrink-0" />}
          {t.tone === "level" && <Zap size={17} className="mt-0.5 shrink-0" fill="currentColor" />}
          {t.tone === "info" && <FileText size={16} className="mt-0.5 shrink-0 text-accent" />}
          <span>
            <span className="block font-bold">{t.text}</span>
            {t.detail && <span className="mt-0.5 block font-medium opacity-90">{t.detail}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
