"use client";
import clsx from "clsx";
import { useProgress } from "@/lib/store";
import { BADGES, dayKey, levelInfo } from "@/lib/gamification";
import { useHydrated } from "@/components/ui/useHydrated";

export function Profile() {
  const hydrated = useHydrated();
  const s = useProgress();
  const lvl = levelInfo(s.xp);

  // Heatmap d'activité : 12 dernières semaines
  const days = Array.from({ length: 84 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (83 - i));
    return { key: dayKey(d), xp: hydrated ? (s.dailyXp[dayKey(d)] ?? 0) : 0 };
  });
  const shade = (xp: number) => (xp === 0 ? 0 : xp < 30 ? 0.35 : xp < 80 ? 0.65 : 1);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Profil</h1>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Niveau", hydrated ? lvl.level : "–"],
          ["XP totale", hydrated ? s.xp : "–"],
          ["Meilleure série", hydrated ? `${s.streak.best} j` : "–"],
          ["Révisions", hydrated ? s.reviewsDone : "–"],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-line bg-surface p-4">
            <div className="num text-2xl font-semibold">{v}</div>
            <div className="text-xs text-muted">{l}</div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">Activité</h2>
        <p className="text-sm text-muted">12 dernières semaines · gels de série disponibles : {hydrated ? s.streak.freezes : "–"}</p>
        <div className="mt-4 grid w-fit grid-flow-col grid-rows-7 gap-1">
          {days.map((d) => (
            <span
              key={d.key}
              title={`${d.key} · ${d.xp} XP`}
              className="h-3.5 w-3.5 rounded-[3px] bg-sunken"
              style={shade(d.xp) ? { background: "var(--accent)", opacity: shade(d.xp) } : undefined}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">Badges</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BADGES.map((b) => {
            const got = hydrated && !!s.badges[b.id];
            return (
              <div key={b.id} className={clsx("rounded-xl border p-4", got ? "border-ink/70 bg-surface" : "border-dashed border-line")}>
                <div className={clsx("text-2xl", got ? "text-accent" : "text-muted opacity-40")}>{b.icon}</div>
                <div className={clsx("mt-2 text-sm font-semibold", !got && "text-muted")}>{b.title}</div>
                <div className="text-xs text-muted">{b.description}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-14 border-t border-line pt-6">
        <p className="text-sm text-muted">
          Ta progression est enregistrée dans ce navigateur. La synchronisation de compte arrive bientôt.
        </p>
        <button
          onClick={() => confirm("Effacer toute ta progression ? Cette action est définitive.") && s.reset()}
          className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-accent"
        >
          Réinitialiser ma progression
        </button>
      </section>
    </div>
  );
}
