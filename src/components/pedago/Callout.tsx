import { Briefcase, Lightbulb, Sigma, TriangleAlert, type LucideIcon } from "lucide-react";

const STYLES: Record<string, { label: string; Icon: LucideIcon; bg: string; fg: string; ink: string }> = {
  intuition: { label: "Intuition", Icon: Lightbulb, bg: "#eef4ff", fg: "#3538cd", ink: "#2d31a6" },
  piege: { label: "Piège classique", Icon: TriangleAlert, bg: "#fff4ed", fg: "#e62e05", ink: "#97180c" },
  entretien: { label: "En entretien", Icon: Briefcase, bg: "#fffaeb", fg: "#dc6803", ink: "#93370d" },
  rappel: { label: "Rappel maths", Icon: Sigma, bg: "#f4f3ff", fg: "#6938ef", ink: "#4a1fb8" },
};

export function Callout({ type = "intuition", children }: { type?: keyof typeof STYLES; children: React.ReactNode }) {
  const s = STYLES[type];
  return (
    <aside className="my-8 rounded-2xl p-5" style={{ background: s.bg }}>
      <div className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: s.ink }}>
        <s.Icon size={18} strokeWidth={2.6} style={{ color: s.fg }} />
        {s.label}
      </div>
      <div className="lesson-prose text-[0.98rem]">{children}</div>
    </aside>
  );
}
