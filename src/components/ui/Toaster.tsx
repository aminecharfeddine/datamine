"use client";
import { useProgress } from "@/lib/store";
import clsx from "clsx";

export function Toaster() {
  const toasts = useProgress((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "animate-rise rounded-full border px-4 py-2 text-sm font-medium shadow-sm",
            t.tone === "xp" && "border-accent/30 bg-surface text-accent",
            t.tone === "badge" && "border-pos/40 bg-pos text-paper",
            t.tone === "info" && "border-line bg-surface text-ink",
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
