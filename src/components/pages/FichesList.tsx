"use client";
import Link from "next/link";
import clsx from "clsx";
import { FileText, Lock } from "lucide-react";
import { MODULES, modStyle } from "@/lib/curriculum";
import { FICHE_CONTENT } from "@/lib/fiches";
import { useProgress } from "@/lib/store";
import { useHydrated } from "@/components/ui/useHydrated";
import { ModuleIcon } from "@/components/ui/ModuleIcon";

export function FichesList() {
  const hydrated = useHydrated();
  const done = useProgress((s) => s.completedLessons);
  const all = MODULES.flatMap((m) => m.lessons.filter((l) => l.available && FICHE_CONTENT[l.slug]));
  const unlocked = hydrated ? all.filter((l) => done[l.slug]).length : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10">
      <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Fiches récap</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Une page par leçon : l'essentiel, les formules, les pièges et les réponses d'entretien. Chaque fiche se débloque
        quand tu termines sa leçon, et se télécharge en PDF.
      </p>
      <div className="mt-5 flex items-center gap-3">
        <div className="h-2.5 w-48 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(unlocked / Math.max(1, all.length)) * 100}%` }} />
        </div>
        <span className="text-sm font-semibold">
          <span className="num">{unlocked}</span> / <span className="num">{all.length}</span> débloquées
        </span>
      </div>

      <div className="mt-10 space-y-10">
        {MODULES.filter((m) => m.lessons.some((l) => l.available)).map((m) => (
          <section key={m.id} style={modStyle(m)}>
            <h2 className="flex items-center gap-2 font-display text-xl font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: m.color }}>
                <ModuleIcon id={m.id} size={16} />
              </span>
              Module {m.index} · {m.title}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {m.lessons
                .filter((l) => l.available && FICHE_CONTENT[l.slug])
                .map((l) => {
                  const open = hydrated && !!done[l.slug];
                  return (
                    <Link
                      key={l.slug}
                      href={open ? `/fiches/${l.slug}` : `/lecons/${l.slug}`}
                      className={clsx(
                        "group relative flex min-h-36 flex-col rounded-2xl border-2 p-4 transition-transform hover:-translate-y-0.5",
                        open ? "bg-surface" : "border-dashed bg-paper",
                      )}
                      style={{ borderColor: open ? `${m.color}55` : "var(--line)" }}
                    >
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={open ? { background: m.color, color: "white" } : { background: "var(--sunken)", color: "var(--muted)" }}
                      >
                        {open ? <FileText size={19} strokeWidth={2.4} /> : <Lock size={18} strokeWidth={2.4} />}
                      </span>
                      <span className={clsx("mt-3 font-display text-lg font-bold leading-tight", !open && "text-muted")}>{l.title}</span>
                      <span className="mt-auto pt-2 text-sm font-semibold" style={{ color: open ? m.deep : "var(--muted)" }}>
                        {open ? "Ouvrir la fiche" : "Termine la leçon pour la débloquer"}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
