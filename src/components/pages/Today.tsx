"use client";
import Link from "next/link";
import { useProgress, dueCardIds, conceptLevel } from "@/lib/store";
import { ALL_LESSONS, MODULES } from "@/lib/curriculum";
import { dayKey, displayedStreak, levelInfo } from "@/lib/gamification";
import { useHydrated } from "@/components/ui/useHydrated";

export function Today() {
  const hydrated = useHydrated();
  const s = useProgress();
  const due = hydrated ? dueCardIds(s.srs).length : 0;
  const next = ALL_LESSONS.find((l) => l.available && !s.completedLessons[l.slug]);
  const lvl = levelInfo(s.xp);
  const streak = hydrated ? displayedStreak(s.streak, dayKey()) : 0;
  const isNew = hydrated && s.xp === 0;

  // XP des 7 derniers jours
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { day: d.toLocaleDateString("fr-FR", { weekday: "narrow" }), xp: hydrated ? (s.dailyXp[dayKey(d)] ?? 0) : 0 };
  });
  const maxXp = Math.max(30, ...week.map((w) => w.xp));

  const evalModule = MODULES.find((m) => m.id === "evaluation")!;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12">
      <section className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Laboratoire de data science</p>
          <h1 className="mt-3 font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Comprendre en manipulant,
            <br />
            <span className="italic text-muted">retenir en révisant.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Statistiques, Machine Learning, Deep Learning, LLM. Chaque notion se découvre par une prédiction, se
            manipule dans une visualisation, se gagne par un défi — puis revient au bon moment pour ne pas s'oublier.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat label="Niveau" value={hydrated ? lvl.level : "–"} />
            <Stat label="Série" value={hydrated ? `${streak} j` : "–"} />
            <Stat label="XP" value={hydrated ? s.xp : "–"} />
          </div>
          <div className="mt-5 flex h-20 items-end gap-2" aria-label="XP gagnée sur les 7 derniers jours">
            {week.map((w, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${w.xp} XP`}>
                <div
                  className={i === 6 ? "w-full rounded-t-[4px] bg-accent" : "w-full rounded-t-[4px] bg-ink/70"}
                  style={{ height: `${Math.max(2, (w.xp / maxXp) * 56)}px` }}
                />
                <span className="text-[11px] text-muted">{w.day}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2">
        <Link
          href={due > 0 ? "/revisions" : "/parcours"}
          className="group rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-ink"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Révisions du jour</div>
          <div className="num mt-2 text-4xl font-semibold">{due}</div>
          <p className="mt-1 text-muted">
            {due > 0
              ? "cartes à revoir avant qu'elles ne s'effacent."
              : isNew
                ? "Termine une leçon : ses cartes rejoindront ton deck."
                : "Rien à réviser pour l'instant. Reviens demain."}
          </p>
          {due > 0 && <span className="mt-4 inline-block text-sm font-semibold group-hover:underline">Commencer →</span>}
        </Link>

        {next ? (
          <Link href={`/lecons/${next.slug}`} className="group rounded-2xl bg-ink p-6 text-paper transition-transform hover:-translate-y-0.5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] opacity-60">
              {isNew ? "Commence ici" : "Prochaine leçon"}
            </div>
            <div className="mt-2 font-serif text-2xl leading-tight">{next.title}</div>
            <p className="mt-2 opacity-70">{next.summary}</p>
            <span className="num mt-4 inline-block text-sm font-semibold">{next.minutes} min →</span>
          </Link>
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Prochaine leçon</div>
            <p className="mt-2 font-serif text-xl">Tu as terminé toutes les leçons disponibles.</p>
            <p className="mt-1 text-muted">De nouveaux modules arrivent. En attendant, tes révisions consolident l'acquis.</p>
          </div>
        )}
      </section>

      <section className="mt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-semibold">Module {evalModule.index} · {evalModule.title}</h2>
          <Link href="/parcours" className="text-sm text-muted hover:text-ink">Tout le parcours →</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {evalModule.concepts.map((c) => {
            const lv = hydrated ? conceptLevel(s, c.id) : 0;
            return (
              <div key={c.id} className="rounded-xl border border-line bg-surface p-3">
                <div className="text-sm font-medium leading-tight">{c.title}</div>
                <MasteryPips level={lv} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="num text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

export function MasteryPips({ level }: { level: number }) {
  const labels = ["Non vu", "Découvert", "Pratiqué", "Maîtrisé", "Consolidé"];
  return (
    <div className="mt-2.5 flex items-center gap-1" title={labels[level]}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= level ? "bg-accent" : "bg-sunken"}`} />
      ))}
      <span className="ml-1.5 text-[11px] text-muted">{labels[level]}</span>
    </div>
  );
}
