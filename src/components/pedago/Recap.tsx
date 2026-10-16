import { BookmarkCheck } from "lucide-react";

/** Encadré « À retenir » de fin de leçon : l'essentiel, à relire avant un entretien. */
export function Recap({ children }: { children: React.ReactNode }) {
  return (
    <aside
      className="my-10 rounded-3xl border-2 p-6"
      style={{ borderColor: "color-mix(in srgb, var(--mod) 35%, white)", background: "color-mix(in srgb, var(--mod) 6%, white)" }}
    >
      <div className="mb-3 flex items-center gap-2 font-display text-xl font-bold" style={{ color: "var(--mod-deep)" }}>
        <BookmarkCheck size={22} strokeWidth={2.4} /> À retenir
      </div>
      <div className="lesson-prose text-[1rem]">{children}</div>
    </aside>
  );
}
