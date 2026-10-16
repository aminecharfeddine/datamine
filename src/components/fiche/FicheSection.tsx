import { Briefcase, Lightbulb, ListChecks, Sigma, TriangleAlert, type LucideIcon } from "lucide-react";

const KINDS: Record<string, { title: string; Icon: LucideIcon; fg: string; bg: string }> = {
  essentiel: { title: "L'essentiel", Icon: ListChecks, fg: "var(--mod-deep)", bg: "color-mix(in srgb, var(--mod) 7%, white)" },
  formules: { title: "Formules", Icon: Sigma, fg: "#4a1fb8", bg: "#f6f5ff" },
  pieges: { title: "Pièges à éviter", Icon: TriangleAlert, fg: "#97180c", bg: "#fff6f2" },
  entretien: { title: "En entretien", Icon: Briefcase, fg: "#93370d", bg: "#fffaeb" },
  astuces: { title: "Astuces et ordres de grandeur", Icon: Lightbulb, fg: "#05603a", bg: "#f0fdf5" },
};

/** Un bloc de fiche récap. Les blocs s'enchaînent sur deux colonnes, sans être coupés. */
export function FicheSection({ kind, title, children }: { kind: keyof typeof KINDS; title?: string; children: React.ReactNode }) {
  const k = KINDS[kind];
  return (
    <section className="fiche-section mb-4 rounded-2xl p-4" style={{ background: k.bg }}>
      <h2 className="mb-2 flex items-center gap-2 font-display text-[1.05rem] font-bold" style={{ color: k.fg }}>
        <k.Icon size={17} strokeWidth={2.6} aria-hidden /> {title ?? k.title}
      </h2>
      <div className="fiche-prose">{children}</div>
    </section>
  );
}
