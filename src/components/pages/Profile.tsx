"use client";
import clsx from "clsx";
import { useProgress } from "@/lib/store";
import { BADGES, dayKey, levelInfo } from "@/lib/gamification";
import { useHydrated } from "@/components/ui/useHydrated";
import { useAuth, resetProgress } from "@/lib/sync/sync";
import Link from "next/link";

export function Profile() {
  const hydrated = useHydrated();
  const s = useProgress();
  const lvl = levelInfo(s.xp);
  const auth = useAuth();

  // Heatmap d'activité : 12 dernières semaines
  const days = Array.from({ length: 84 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (83 - i));
    return { key: dayKey(d), xp: hydrated ? (s.dailyXp[dayKey(d)] ?? 0) : 0 };
  });
  const shade = (xp: number) => (xp === 0 ? 0 : xp < 30 ? 0.35 : xp < 80 ? 0.65 : 1);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Profil</h1>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Niveau", hydrated ? lvl.level : "–"],
          ["XP totale", hydrated ? s.xp : "–"],
          ["Meilleure série", hydrated ? `${s.streak.best} j` : "–"],
          ["Révisions", hydrated ? s.reviewsDone : "–"],
        ].map(([l, v]) => (
          <div key={l as string} className="card p-4">
            <div className="num text-2xl font-semibold">{v}</div>
            <div className="text-xs text-muted">{l}</div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">Activité</h2>
        <p className="text-sm text-muted">12 dernières semaines · gels de série disponibles : {hydrated ? s.streak.freezes : "–"}</p>
        <div className="mt-4 grid w-fit grid-flow-col grid-rows-7 gap-1">
          {days.map((d) => (
            <span
              key={d.key}
              title={`${d.key} · ${d.xp} XP`}
              className="h-3.5 w-3.5 rounded-[3px] bg-sunken"
              style={shade(d.xp) ? { background: `color-mix(in srgb, var(--accent) ${Math.round(shade(d.xp) * 100)}%, white)` } : undefined}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">Badges</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BADGES.map((b) => {
            const got = hydrated && !!s.badges[b.id];
            return (
              <div key={b.id} className={clsx("rounded-xl border p-4", got ? "border-xp/40 bg-[#fffaeb]" : "border-dashed border-line")}>
                <div className={clsx("text-2xl", got ? "text-xp" : "text-muted opacity-40")}>{b.icon}</div>
                <div className={clsx("mt-2 text-sm font-semibold", !got && "text-muted")}>{b.title}</div>
                <div className="text-xs text-muted">{b.description}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-14 border-t border-line pt-6">
        <p className="text-sm text-muted">
          {auth.email ? (
            <>Ta progression est synchronisée avec ton compte ({auth.email}).</>
          ) : (
            <>
              Ta progression est enregistrée dans ce navigateur uniquement.{" "}
              <Link href="/compte" className="text-ink underline underline-offset-4">Crée un compte</Link> pour la retrouver partout.
            </>
          )}
        </p>
        <button
          onClick={() =>
            confirm(
              auth.email
                ? "Effacer toute ta progression, sur cet appareil ET dans ton compte ? Cette action est définitive."
                : "Effacer toute ta progression ? Cette action est définitive.",
            ) && resetProgress()
          }
          className="btn-ghost mt-3 px-4 py-2 text-sm text-[#9c2a10]"
        >
          Réinitialiser ma progression
        </button>
      </section>
    </div>
  );
}
