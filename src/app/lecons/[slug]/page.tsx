import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clock } from "lucide-react";
import { findLesson, conceptTitle, modStyle, moduleById } from "@/lib/curriculum";
import { LESSON_CONTENT } from "@/lib/lessons";
import { LessonProvider } from "@/components/pedago/LessonContext";
import { ModuleIcon } from "@/components/ui/ModuleIcon";

export function generateStaticParams() {
  return Object.keys(LESSON_CONTENT).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = findLesson(slug);
  return l ? { title: l.title, description: l.summary } : {};
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = findLesson(slug);
  const load = LESSON_CONTENT[slug];
  if (!meta || !load) notFound();
  const { default: Content } = await load();
  const mod = moduleById(meta.moduleId)!;

  return (
    <LessonProvider slug={slug} concepts={meta.concepts}>
      <div style={modStyle(mod)}>
        <header className="relative overflow-hidden text-white" style={{ background: mod.color }}>
          <ModuleIcon id={mod.id} size={260} className="pointer-events-none absolute -right-10 -top-10 opacity-15" />
          <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-8">
            <Link href={`/parcours#${mod.id}`} className="inline-flex items-center gap-1 rounded-lg py-1 text-sm font-semibold text-white/85 hover:text-white">
              <ChevronLeft size={16} strokeWidth={2.6} />
              Module {mod.index}, {mod.title}
            </Link>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{meta.title}</h1>
            <p className="mt-4 max-w-xl text-lg text-white/90">{meta.summary}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1">
                <Clock size={14} strokeWidth={2.6} /> {meta.minutes} min
              </span>
              {meta.concepts.map((c) => (
                <span key={c} className="rounded-full bg-white px-3 py-1" style={{ color: mod.deep }}>
                  {conceptTitle(c)}
                </span>
              ))}
            </div>
          </div>
        </header>
        <article className="mx-auto max-w-3xl px-4">
          <div className="lesson-prose mt-10">
            <Content />
          </div>
        </article>
      </div>
    </LessonProvider>
  );
}
