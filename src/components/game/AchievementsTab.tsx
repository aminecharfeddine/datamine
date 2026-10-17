"use client";
import { useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { useProgress } from "@/lib/store";
import { ACHIEVEMENTS, FAMILIES, computeStats, type Achievement, type Stats } from "@/lib/achievements";
import { describeUnlock, unlockedByBadge } from "@/lib/cosmetics";
import { FAMILY_COLOR, FAMILY_ICON, Medal, tierColor, tierLabel } from "./Medal";

/**
 * Succès en vitrine : toutes les médailles côte à côte, groupées par famille.
 * Le détail (description, progression, récompense) s'affiche au clic.
 */
export function AchievementsTab() {
  const s = useProgress();
  const stats = computeStats(s);
  const [open, setOpen] = useState<string | null>(null);
  const earnedCount = ACHIEVEMENTS.filter((a) => s.badges[a.id]).length;
  const selected = ACHIEVEMENTS.find((a) => a.id === open);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p>
          <span className="num font-display text-5xl font-extrabold">{earnedCount}</span>
          <span className="font-display text-2xl font-bold text-muted"> / {ACHIEVEMENTS.length}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {FAMILIES.map((f) => {
            const list = ACHIEVEMENTS.filter((a) => a.family === f.id);
            const got = list.filter((a) => s.badges[a.id]).length;
            const Icon = FAMILY_ICON[f.id];
            return (
              <span key={f.id} className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-line">
                <Icon size={15} strokeWidth={2.6} style={{ color: FAMILY_COLOR[f.id] }} />
                {f.title}
                <span className="num text-muted">
                  {got}/{list.length}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {selected && <Detail a={selected} stats={stats} date={s.badges[selected.id]} onClose={() => setOpen(null)} />}

      <div className="mt-8 space-y-7">
        {FAMILIES.map((f) => (
          <section key={f.id} aria-label={f.title}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: FAMILY_COLOR[f.id] }}>
              {f.title}
              <span className="h-px flex-1" style={{ background: `${FAMILY_COLOR[f.id]}33` }} />
            </h3>
            <ul className="grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-5 sm:gap-x-2 md:grid-cols-6 lg:grid-cols-8">
              {ACHIEVEMENTS.filter((a) => a.family === f.id).map((a) => {
                const earned = !!s.badges[a.id];
                const hidden = a.secret && !earned;
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => setOpen(open === a.id ? null : a.id)}
                      aria-pressed={open === a.id}
                      title={hidden ? "Succès secret" : `${a.title} · ${a.description}`}
                      className={clsx(
                        "group flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-colors",
                        open === a.id ? "bg-surface shadow-sm ring-2 ring-accent/50" : "hover:bg-surface",
                      )}
                    >
                      <span className="transition-transform group-hover:-translate-y-0.5">
                        <Medal family={a.family} tier={a.tier} earned={earned} secret={a.secret} progress={hidden ? 0 : a.value(stats) / a.goal} size={56} />
                      </span>
                      <span className={clsx("line-clamp-2 text-center text-[0.72rem] font-semibold leading-tight sm:text-[0.8rem]", !earned && "text-muted")}>
                        {hidden ? "???" : a.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Detail({ a, stats, date, onClose }: { a: Achievement; stats: Stats; date?: string; onClose: () => void }) {
  const hidden = a.secret && !date;
  const value = Math.min(a.value(stats), a.goal);
  const rewards = unlockedByBadge(a.id);
  const color = tierColor(a.family, a.tier);
  return (
    <div className="animate-pop mt-6 flex items-center gap-4 rounded-3xl p-4 pr-3 sm:p-5" style={{ background: `${color}14`, boxShadow: `inset 0 0 0 2px ${color}33` }}>
      <Medal family={a.family} tier={a.tier} earned={!!date} secret={a.secret} progress={hidden ? 0 : value / a.goal} size={72} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-xl font-bold">{hidden ? "Succès secret" : a.title}</span>
          {a.tier && !hidden && (
            <span className="text-sm font-bold" style={{ color }}>
              {tierLabel(a.tier)}
            </span>
          )}
        </div>
        <p className="text-muted">{hidden ? "Continue d'apprendre : il se révélera en chemin." : a.description}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 text-sm font-semibold">
          {date ? (
            <span className="text-good">Obtenu le {new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span>
          ) : (
            !hidden && a.goal > 1 && <span className="num">{value} / {a.goal}</span>
          )}
          {rewards.length > 0 && !hidden && <span className="text-accent">Récompense : {rewards.map(describeUnlock).join(", ")}</span>}
        </div>
      </div>
      <button onClick={onClose} aria-label="Fermer le détail" className="self-start rounded-full p-1.5 text-muted hover:bg-white hover:text-ink">
        <X size={18} />
      </button>
    </div>
  );
}
