"use client";
import clsx from "clsx";
import { Trophy, Zap } from "lucide-react";
import { useProgress } from "@/lib/store";

export function Toaster() {
  const toasts = useProgress((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "animate-pop flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold shadow-lg",
            t.tone === "xp" && "bg-ink text-white",
            t.tone === "badge" && "bg-xp text-ink",
            t.tone === "info" && "bg-surface text-ink",
          )}
        >
          {t.tone === "xp" && <Zap size={16} className="text-xp" fill="currentColor" />}
          {t.tone === "badge" && <Trophy size={16} />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
