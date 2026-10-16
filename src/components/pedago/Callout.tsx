import clsx from "clsx";

const STYLES = {
  intuition: { label: "Intuition", cls: "border-pos" },
  piege: { label: "Piège classique", cls: "border-fp" },
  entretien: { label: "En entretien", cls: "border-fn" },
  rappel: { label: "Rappel maths", cls: "border-neg" },
} as const;

export function Callout({ type = "intuition", children }: { type?: keyof typeof STYLES; children: React.ReactNode }) {
  const s = STYLES[type];
  return (
    <aside className={clsx("my-7 border-l-2 bg-surface/60 py-3 pl-5 pr-4", s.cls)}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{s.label}</div>
      <div className="lesson-prose text-[0.98rem]">{children}</div>
    </aside>
  );
}
