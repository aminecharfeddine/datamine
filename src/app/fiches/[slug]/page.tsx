import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { findLesson, modStyle, moduleById } from "@/lib/curriculum";
import { FICHE_CONTENT } from "@/lib/fiches";
import { FicheGate } from "@/components/fiche/FicheGate";
import { ModuleIcon } from "@/components/ui/ModuleIcon";

export function generateStaticParams() {
  return Object.keys(FICHE_CONTENT).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = findLesson(slug);
  return l ? { title: `Fiche · ${l.title}` } : {};
}

export default async function FichePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = findLesson(slug);
  const load = FICHE_CONTENT[slug];
  if (!lesson || !load) notFound();
  const { default: Content } = await load();
  const mod = moduleById(lesson.moduleId)!;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8" style={modStyle(mod)}>
      <Link href="/fiches" className="no-print mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft size={16} strokeWidth={2.6} /> Toutes les fiches
      </Link>
      <FicheGate slug={slug} title={lesson.title}>
        <article className="fiche-sheet card overflow-hidden">
          <header className="flex items-center gap-4 px-6 py-5 text-white" style={{ background: mod.color }}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <ModuleIcon id={mod.id} size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white/85">
                Fiche récap · Module {mod.index}, {mod.title}
              </div>
              <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{lesson.title}</h1>
            </div>
            <span className="hidden font-display text-lg font-bold text-white/80 sm:block">Datamine</span>
          </header>
          <div className="fiche-body px-5 pb-2 pt-5 sm:px-6">
            <Content />
          </div>
        </article>
      </FicheGate>
    </div>
  );
}
