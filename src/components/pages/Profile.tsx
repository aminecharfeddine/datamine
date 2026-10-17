"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { BookOpenCheck, Brain, ChevronRight, Flame, Snowflake, Zap } from "lucide-react";
import { useProgress } from "@/lib/store";
import { dayKey, displayedStreak } from "@/lib/gamification";
import { ACHIEVEMENTS, computeStats } from "@/lib/achievements";
import { useHydrated } from "@/components/ui/useHydrated";
import { useAuth, resetProgress } from "@/lib/sync/sync";
import { Avatar } from "@/components/game/Avatar";
import { useMe } from "@/components/game/useMe";
import { WeeklyGoal } from "@/components/game/WeeklyGoal";
import { NextLevelCard } from "@/components/game/NextUnlock";
import { AchievementsTab } from "@/components/game/AchievementsTab";
import { VestiaireTab } from "@/components/game/VestiaireTab";
import { Medal } from "@/components/game/Medal";

const WEEKS = 20;

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
  const earned = ACHIEVEMENTS.filter((a) => s.badges[a.id]);
  const recent = [...earned].sort((a, b) => (s.badges[b.id] > s.badges[a.id] ? 1 : -1)).slice(0, 6);

  // Heatmap : 20 semaines complètes, du lundi au dimanche.
  const today = new Date();
  const offset = (today.getDay() + 6) % 7; // 0 = lundi
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset - 7 * (WEEKS - 1));
  const todayKey = dayKey(today);
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(d);
    return { key, xp: s.dailyXp[key] ?? 0, future: key > todayKey, first: i === 0 || (d.getDate() <= 7 && i % 7 === 0), month: d };
  });
  const activeDays = days.filter((d) => d.xp > 0).length;
  const shade = (xp: number) => (xp === 0 ? 0 : xp < 30 ? 0.3 : xp < 80 ? 0.6 : 1);
  const tone = (v: number) => (v ? `color-mix(in srgb, var(--accent) ${Math.round(v * 100)}%, white)` : undefined);

  const STATS = [
    { label: "XP gagnée", value: s.xp, Icon: Zap, color: "#f59e0b" },
    { label: streak > 1 ? "jours de série" : "jour de série", value: streak, Icon: Flame, color: "#f97316" },
    { label: stats.lessons > 1 ? "leçons terminées" : "leçon terminée", value: stats.lessons, Icon: BookOpenCheck, color: "#0d9488" },
    { label: stats.mastered > 1 ? "concepts maîtrisés" : "concept maîtrisé", value: stats.mastered, Icon: Brain, color: "#7c3aed" },
  ];

  return (
    <div className="space-y-6">
      <NextLevelCard onOpen={() => onGo("vestiaire")} />

      <ul className="card grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
        {STATS.map(({ label, value, Icon, color }) => (
          <li key={label} className="flex items-center gap-3 bg-surface p-4 sm:p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}1f`, color }}>
              <Icon size={20} strokeWidth={2.4} fill={Icon === Zap || Icon === Flame ? "currentColor" : "none"} />
            </span>
            <span className="min-w-0">
              <span className="num block font-display text-2xl font-bold leading-none">{value}</span>
              <span className="mt-1 block text-xs font-medium leading-tight text-muted">{label}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 md:grid-cols-[1fr_1.35fr]">
        <WeeklyGoal />
        <div className="card flex flex-col p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-lg font-bold">Activité</div>
              <p className="mt-0.5 text-sm text-muted">
                {activeDays} jour{activeDays > 1 ? "s" : ""} actif{activeDays > 1 ? "s" : ""} sur 20 semaines
              </p>
            </div>
            <div className="flex shrink-0 gap-2 text-xs font-semibold">
              <span className="rounded-full bg-paper px-2.5 py-1" title="Meilleure série">
                Record <span className="num">{s.streak.best} j</span>
              </span>
              <span className="flex items-center gap-1 rounded-full bg-paper px-2.5 py-1" title="Gels de série disponibles : ils protègent ta série un jour d'absence">
                <Snowflake size={12} className="text-[#0284c7]" /> <span className="num">{s.streak.freezes}</span>
              </span>
            </div>
          </div>
          <div className="mt-auto pt-4">
            <div className="grid grid-flow-col grid-rows-[auto_repeat(7,minmax(0,1fr))] gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
              {days.map((d, i) => (
                <Fragment key={d.key}>
                  {i % 7 === 0 && (
                    <span className="h-4 whitespace-nowrap text-[10px] font-semibold capitalize text-muted">
                      {d.first ? d.month.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "") : ""}
                    </span>
                  )}
                  <span
                    title={`${d.key} · ${d.xp} XP`}
                    className={clsx("aspect-square w-full rounded-[4px]", d.future ? "bg-paper" : "bg-sunken", d.key === todayKey && "ring-2 ring-accent/40")}
                    style={shade(d.xp) ? { background: tone(shade(d.xp)) } : undefined}
                  />
                </Fragment>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-end gap-1 text-[10px] font-medium text-muted">
              Moins
              {[0, 0.3, 0.6, 1].map((v) => (
                <span key={v} className="h-2.5 w-2.5 rounded-[3px] bg-sunken" style={v ? { background: tone(v) } : undefined} />
              ))}
              Plus
            </div>
          </div>
        </div>
      </div>

      <section className="card p-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Derniers succès</h2>
            <p className="mt-0.5 text-sm text-muted">
              {earned.length} sur {ACHIEVEMENTS.length} obtenus
            </p>
          </div>
          <button onClick={() => onGo("succes")} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            Tous les succès <ChevronRight size={15} />
          </button>
        </div>
        {recent.length ? (
          <ul className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-6">
            {recent.map((a) => (
              <li key={a.id} className="flex min-w-0 flex-col items-center gap-2 text-center">
                <Medal family={a.family} tier={a.tier} earned size={60} />
                <span className="line-clamp-2 text-xs font-semibold leading-tight">{a.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">Termine une leçon ou réussis un défi pour obtenir ton premier succès.</p>
        )}
      </section>

      <section className="pt-2">
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
