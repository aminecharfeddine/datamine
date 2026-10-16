import { notFound } from "next/navigation";
import Link from "next/link";
import { findLesson, MODULES, conceptTitle } from "@/lib/curriculum";
import { LESSON_CONTENT } from "@/lib/lessons";
import { LessonProvider } from "@/components/pedago/LessonContext";

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
  const mod = MODULES.find((m) => m.id === meta.moduleId)!;

  return (
    <LessonProvider slug={slug} concepts={meta.concepts}>
      <article className="mx-auto max-w-3xl px-4 pt-12">
        <Link href="/parcours" className="text-sm text-muted hover:text-ink">
          ← Module {mod.index} · {mod.title}
        </Link>
        <h1 className="mt-4 font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">{meta.title}</h1>
        <p className="mt-4 text-lg text-muted">{meta.summary}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="num rounded-full border border-line px-2.5 py-1">{meta.minutes} min</span>
          {meta.concepts.map((c) => (
            <span key={c} className="rounded-full bg-sunken px-2.5 py-1">
              {conceptTitle(c)}
            </span>
          ))}
        </div>
        <div className="lesson-prose mt-10">
          <Content />
        </div>
      </article>
    </LessonProvider>
  );
}
