"use client";
import clsx from "clsx";
import { CalendarCheck } from "lucide-react";
import { useProgress } from "@/lib/store";
import { dayKey } from "@/lib/gamification";
import { activeDaysByWeek, WEEKLY_GOAL, weekOf } from "@/lib/achievements";
import { useHydrated } from "@/components/ui/useHydrated";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

/** Objectif de la semaine : 4 jours actifs sur 7. Les jours off ne cassent rien. */
export function WeeklyGoal({ compact = false }: { compact?: boolean }) {
  const hydrated = useHydrated();
  const dailyXp = useProgress((s) => s.dailyXp);
  const today = dayKey();
  const monday = weekOf(today);
  const [y, m, d] = monday.split("-").map(Number);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(y, m - 1, d + i);
    const key = dayKey(date);
    return { key, active: hydrated && (dailyXp[key] ?? 0) > 0, isToday: key === today, future: key > today };
  });
  const done = week.filter((w) => w.active).length;
  const reached = done >= WEEKLY_GOAL;
  const weeksDone = hydrated ? Object.values(activeDaysByWeek(dailyXp)).filter((n) => n >= WEEKLY_GOAL).length : 0;

  return (
    <div className={clsx("card flex flex-col", compact ? "p-5" : "h-full p-6")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <CalendarCheck size={19} strokeWidth={2.4} className={reached ? "text-good-bg" : "text-accent"} />
            Objectif de la semaine
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {reached
              ? "Atteint. Chaque jour en plus consolide ta mémoire."
              : `Apprendre ${WEEKLY_GOAL} jours sur 7 : encore ${WEEKLY_GOAL - done} jour${WEEKLY_GOAL - done > 1 ? "s" : ""}.`}
          </p>
        </div>
        <span className="num font-display text-2xl font-bold">
          {done}/{WEEKLY_GOAL}
        </span>
      </div>
      <div className={clsx("flex gap-1.5", compact ? "mt-4" : "mt-auto pt-5")}>
        {week.map((w, i) => (
          <div key={w.key} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={clsx(
                compact ? "h-8" : "h-11", "flex w-full items-center justify-center rounded-lg text-xs font-bold transition-colors",
                w.active ? (reached ? "bg-good text-white" : "bg-accent text-white") : w.future ? "bg-paper text-muted" : "bg-sunken text-muted",
                w.isToday && !w.active && "ring-2 ring-accent/40",
              )}
              title={w.key}
            >
              {DAYS[i]}
            </span>
          </div>
        ))}
      </div>
      {!compact && (
        <p className="mt-3 text-xs text-muted">
          {weeksDone} semaine{weeksDone > 1 ? "s" : ""} réussie{weeksDone > 1 ? "s" : ""} au total
        </p>
      )}
    </div>
  );
}
