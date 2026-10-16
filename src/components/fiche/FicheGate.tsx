"use client";
import Link from "next/link";
import { Download, Lock } from "lucide-react";
import { useProgress } from "@/lib/store";
import { useHydrated } from "@/components/ui/useHydrated";

/**
 * Affiche la fiche seulement si la leçon correspondante est terminée.
 * Le bouton « Télécharger en PDF » ouvre l'impression du navigateur, réglée pour une page A4 propre.
 */
export function FicheGate({ slug, title, children }: { slug: string; title: string; children: React.ReactNode }) {
  const hydrated = useHydrated();
  const unlocked = useProgress((s) => !!s.completedLessons[slug]);

  if (!hydrated) return <div className="h-96" aria-busy="true" />;

  if (!unlocked)
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sunken text-muted">
          <Lock size={26} strokeWidth={2.4} />
        </span>
        <p className="mt-4 font-display text-2xl font-bold">Fiche verrouillée</p>
        <p className="mt-2 text-muted">Termine la leçon « {title} » pour débloquer sa fiche récap.</p>
        <Link
          href={`/lecons/${slug}`}
          className="btn-3d mt-6 inline-block px-5 py-2.5 text-white"
          style={{ background: "var(--mod)", ["--btn-shadow" as string]: "var(--mod-deep)" }}
        >
          Aller à la leçon
        </Link>
      </div>
    );

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Dans la fenêtre d'impression, choisis « Enregistrer au format PDF ».</p>
        <button
          onClick={() => {
            const previous = document.title;
            document.title = `Fiche Datamine - ${title}`; // nom de fichier proposé par le navigateur
            window.print();
            setTimeout(() => (document.title = previous), 500);
          }}
          className="btn-3d inline-flex items-center gap-2 px-5 py-2.5 text-white"
          style={{ background: "var(--mod)", ["--btn-shadow" as string]: "var(--mod-deep)" }}
        >
          <Download size={17} strokeWidth={2.6} /> Télécharger en PDF
        </button>
      </div>
      {children}
    </>
  );
}
