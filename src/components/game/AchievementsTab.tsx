"use client";
import clsx from "clsx";
import { useProgress } from "@/lib/store";
import { ACHIEVEMENTS, FAMILIES, computeStats } from "@/lib/achievements";
import { describeUnlock, unlockedByBadge } from "@/lib/cosmetics";
import { Medal, tierLabel } from "./Medal";

export function AchievementsTab() {
  const s = useProgress();
  const stats = computeStats(s);
  const earnedCount = ACHIEVEMENTS.filter((a) => s.badges[a.id]).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-lg">
          <span className="num font-display text-3xl font-bold">{earnedCount}</span>
          <span className="text-muted"> / {ACHIEVEMENTS.length} succès obtenus</span>
        </p>
        <div className="h-2.5 min-w-40 flex-1 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-accent" style={{ width: `${(earnedCount / ACHIEVEMENTS.length) * 100}%` }} />
        </div>
      </div>

      <div className="mt-8 space-y-10">
        {FAMILIES.map((f) => {
          const list = ACHIEVEMENTS.filter((a) => a.family === f.id);
          const got = list.filter((a) => s.badges[a.id]).length;
          return (
            <section key={f.id}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl font-bold">{f.title}</h3>
                <span className="num text-sm font-semibold text-muted">
                  {got}/{list.length}
                </span>
              </div>
              <p className="text-sm text-muted">{f.description}</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {list.map((a) => {
                  const date = s.badges[a.id];
                  const hidden = a.secret && !date;
                  const value = Math.min(a.value(stats), a.goal);
                  const rewards = unlockedByBadge(a.id);
                  return (
                    <li key={a.id} className={clsx("flex gap-4 rounded-2xl border p-4", date ? "border-line bg-surface" : "border-dashed border-line bg-paper")}>
                      <Medal family={a.family} tier={a.tier} earned={!!date} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className={clsx("font-display text-[1.05rem] font-bold", !date && "text-muted")}>{hidden ? "Succès secret" : a.title}</span>
                          {a.tier && !hidden && <span className="text-xs font-semibold text-muted">{tierLabel(a.tier)}</span>}
                        </div>
                        <p className="text-sm text-muted">{hidden ? "Continue d'apprendre, il se révélera en chemin." : a.description}</p>
                        {date ? (
                          <p className="mt-1 text-xs font-semibold text-good">
                            Obtenu le {new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                          </p>
                        ) : (
                          !hidden &&
                          a.goal > 1 && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                                <div className="h-full rounded-full bg-accent" style={{ width: `${(value / a.goal) * 100}%` }} />
                              </div>
                              <span className="num text-xs text-muted">
                                {value}/{a.goal}
                              </span>
                            </div>
                          )
                        )}
                        {rewards.length > 0 && !hidden && (
                          <p className="mt-1.5 text-xs text-muted">
                            Récompense : {rewards.map(describeUnlock).join(", ")}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
