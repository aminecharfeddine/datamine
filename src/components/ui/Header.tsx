"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useProgress, dueCardIds } from "@/lib/store";
import { displayedStreak, dayKey, levelInfo } from "@/lib/gamification";
import { useHydrated } from "./useHydrated";

const NAV = [
  { href: "/", label: "Aujourd'hui" },
  { href: "/parcours", label: "Parcours" },
  { href: "/revisions", label: "Révisions" },
  { href: "/profil", label: "Profil" },
];

export function Header() {
  const path = usePathname();
  const hydrated = useHydrated();
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const srs = useProgress((s) => s.srs);
  const lvl = levelInfo(xp);
  const due = hydrated ? dueCardIds(srs).length : 0;
  const days = hydrated ? displayedStreak(streak, dayKey()) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
          Data<span className="text-accent">mine</span>
        </Link>
        <nav className="hidden gap-1 sm:flex">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "relative rounded-md px-3 py-1.5 text-sm transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {n.label}
                {n.href === "/revisions" && due > 0 && (
                  <span className="num ml-1.5 rounded-full bg-accent px-1.5 text-[11px] text-paper">{due}</span>
                )}
                {active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 bg-ink" />}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="num flex items-center gap-1" title="Série de jours">
            <span className={clsx(days > 0 ? "text-accent" : "text-muted")}>●</span>
            {hydrated ? days : "–"}
            <span className="text-muted">j</span>
          </span>
          <span className="flex items-center gap-2" title={`${lvl.current}/${lvl.needed} XP vers le niveau ${lvl.level + 1}`}>
            <span className="num text-muted">Niv.</span>
            <span className="num font-semibold">{hydrated ? lvl.level : "–"}</span>
            <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-sunken sm:block">
              <span className="block h-full bg-accent transition-all" style={{ width: `${hydrated ? lvl.progress * 100 : 0}%` }} />
            </span>
          </span>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 sm:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={clsx("whitespace-nowrap px-3 py-2 text-sm", path === n.href ? "text-ink" : "text-muted")}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
