"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Flame, Zap } from "lucide-react";
import { useProgress } from "@/lib/store";
import { dayKey, displayedStreak } from "@/lib/gamification";
import { ACHIEVEMENTS, computeStats } from "@/lib/achievements";
import { useHydrated } from "@/components/ui/useHydrated";
import { useAuth, resetProgress } from "@/lib/sync/sync";
import { Avatar } from "@/components/game/Avatar";
import { useMe } from "@/components/game/useMe";
import { WeeklyGoal } from "@/components/game/WeeklyGoal";
import { NextUnlock } from "@/components/game/NextUnlock";
import { AchievementsTab } from "@/components/game/AchievementsTab";
import { VestiaireTab } from "@/components/game/VestiaireTab";
import { Medal } from "@/components/game/Medal";

const TABS = [
  { id: "apercu", label: "Vue d'ensemble" },
  { id: "succes", label: "Succès" },
  { id: "vestiaire", label: "Vestiaire" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function Profile() {
  const hydrated = useHydrated();
  const [tab, setTab] = useState<Tab>("apercu");
  const me = useMe();

  // L'onglet suit l'ancre de l'URL (#succes, #atlas…) pour pouvoir y renvoyer directement.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", t === "apercu" ? window.location.pathname : `#${t}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10">
      <section className="flex flex-wrap items-center gap-5">
        <Avatar size={112} letter={me.letter} glyph={hydrated ? me.glyph : undefined} frame={hydrated ? me.frame : "f-none"} color={me.color} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{me.name}</h1>
          <p className="font-display text-lg font-semibold text-accent">{hydrated ? me.title : " "}</p>
          <div className="mt-2 flex max-w-sm items-center gap-3">
            <span className="flex items-center gap-1 text-sm font-bold text-[#b45309]">
              <Zap size={15} fill="currentColor" className="text-xp" /> Niveau {hydrated ? me.level.level : "–"}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
              <span className="block h-full rounded-full bg-xp" style={{ width: `${hydrated ? me.level.progress * 100 : 0}%` }} />
            </span>
            <span className="num text-xs text-muted">
              {hydrated ? `${me.level.current}/${me.level.needed}` : ""}
            </span>
          </div>
        </div>
      </section>

      <nav className="mt-8 flex gap-1 overflow-x-auto rounded-2xl bg-sunken p-1" role="tablist" aria-label="Sections du profil">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => go(t.id)}
            className={clsx(
              "flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-colors",
              tab === t.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {!hydrated ? (
          <div className="h-64" />
        ) : tab === "apercu" ? (
          <Overview onGo={go} />
        ) : tab === "succes" ? (
          <AchievementsTab />
        ) : (
          <VestiaireTab />
        )}
      </div>
    </div>
  );
}

function Overview({ onGo }: { onGo: (t: Tab) => void }) {
  const s = useProgress();
  const auth = useAuth();
  const stats = computeStats(s);
  const streak = displayedStreak(s.streak, dayKey());
  const recent = ACHIEVEMENTS.filter((a) => s.badges[a.id])
    .sort((a, b) => (s.badges[b.id] > s.badges[a.id] ? 1 : -1))
    .slice(0, 4);

  const days = Array.from({ length: 84 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (83 - i));
    return { key: dayKey(d), xp: s.dailyXp[dayKey(d)] ?? 0 };
  });
  const shade = (xp: number) => (xp === 0 ? 0 : xp < 30 ? 0.35 : xp < 80 ? 0.65 : 1);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["XP totale", s.xp],
          ["Série actuelle", `${streak} j`, true],
          ["Leçons terminées", stats.lessons],
          ["Concepts maîtrisés", stats.mastered],
        ].map(([label, value, flame]) => (
          <div key={label as string} className="card p-4">
            <div className="num flex items-center gap-1.5 text-2xl font-bold">
              {flame ? <Flame size={20} className="text-flame" fill="currentColor" /> : null}
              {value}
            </div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <WeeklyGoal />
        <div className="card p-6">
          <div className="font-display text-lg font-bold">Activité</div>
          <p className="text-sm text-muted">
            12 dernières semaines · meilleure série {s.streak.best} j · gels de série : {s.streak.freezes}
          </p>
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
        </div>
      </div>

      <NextUnlock />

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">Derniers succès</h2>
          <button onClick={() => onGo("succes")} className="text-sm font-semibold text-accent hover:underline">
            Tous les succès
          </button>
        </div>
        {recent.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((a) => (
              <li key={a.id} className="card flex items-center gap-3 p-4">
                <Medal family={a.family} tier={a.tier} earned size={44} />
                <span className="font-display font-bold leading-tight">{a.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted">Termine une leçon ou réussis un défi pour obtenir ton premier succès.</p>
        )}
      </section>

      <section className="border-t border-line pt-6">
        <p className="text-sm text-muted">
          {auth.email ? (
            <>Ta progression est synchronisée avec ton compte ({auth.email}).</>
          ) : (
            <>
              Ta progression est enregistrée dans ce navigateur uniquement.{" "}
              <Link href="/compte" className="text-ink underline underline-offset-4">
                Crée un compte
              </Link>{" "}
              pour la retrouver partout.
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
