import { ALL_LESSONS, findLesson, moduleById } from "@/lib/curriculum";
import { ogCard, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Leçon Datamine";

export function generateStaticParams() {
  return ALL_LESSONS.filter((l) => l.available).map((l) => ({ slug: l.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = findLesson(slug);
  const m = l ? moduleById(l.moduleId) : undefined;
  return ogCard({ title: l?.title ?? "Datamine", subtitle: l?.summary, kicker: m ? `Module ${m.index} : ${m.title}` : undefined, color: m?.color });
}
