"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Flame, Zap } from "lucide-react";
import { useProgress, dueCardIds } from "@/lib/store";
import { displayedStreak, dayKey, levelInfo } from "@/lib/gamification";
import { useHydrated } from "./useHydrated";
import { AccountChip } from "./AccountChip";

const NAV = [
  { href: "/", label: "Aujourd'hui" },
  { href: "/parcours", label: "Parcours" },
  { href: "/revisions", label: "Révisions" },
  { href: "/fiches", label: "Fiches" },
  { href: "/entretiens", label: "Entretiens" },
  { href: "/profil", label: "Profil" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Datamine, accueil">
      {/* Trois points qui s'alignent : un mini nuage de points avec sa droite de régression */}
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
        <rect width="30" height="30" rx="9" fill="var(--accent)" />
        <line x1="6" y1="22" x2="24" y2="8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
        <circle cx="9" cy="19" r="2.6" fill="#fff" />
        <circle cx="15.5" cy="16" r="2.6" fill="#ffd166" />
        <circle cx="21" cy="10" r="2.6" fill="#fff" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight">Datamine</span>
    </Link>
  );
}

export function Header() {
  const path = usePathname();
  const hydrated = useHydrated();
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const srs = useProgress((s) => s.srs);
  const lvl = levelInfo(xp);
  const due = hydrated ? dueCardIds(srs).length : 0;
  const days = hydrated ? displayedStreak(streak, dayKey()) : 0;

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <header className="site-header sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Logo />
        <nav className="hidden gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                "rounded-xl px-3 py-2 text-[0.95rem] font-semibold transition-colors",
                isActive(n.href) ? "bg-accent-soft text-accent" : "text-muted hover:bg-sunken hover:text-ink",
              )}
            >
              {n.label}
              {n.href === "/revisions" && due > 0 && (
                <span className="num ml-1.5 rounded-full bg-flame px-1.5 py-0.5 text-[11px] text-white">{due}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
          <span
            className={clsx("flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-bold", days > 0 ? "bg-flame/10 text-flame" : "text-muted")}
            title="Série de jours consécutifs"
          >
            <Flame size={18} strokeWidth={2.6} fill={days > 0 ? "currentColor" : "none"} />
            <span className="num">{hydrated ? days : "–"}</span>
          </span>
          <span
            className="flex items-center gap-2 rounded-xl bg-xp/10 px-2.5 py-1.5 text-sm font-bold text-[#b45309]"
            title={`${lvl.current} / ${lvl.needed} XP avant le niveau ${lvl.level + 1}`}
          >
            <Zap size={17} strokeWidth={2.6} fill="currentColor" />
            <span className="num whitespace-nowrap">
              <span className="hidden sm:inline">Niv. </span>
              {hydrated ? lvl.level : "–"}
            </span>
            <span className="hidden h-2 w-14 overflow-hidden rounded-full bg-xp/25 sm:block">
              <span className="block h-full rounded-full bg-xp transition-all" style={{ width: `${hydrated ? lvl.progress * 100 : 0}%` }} />
            </span>
          </span>
          <AccountChip />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5 md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={clsx(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold",
              isActive(n.href) ? "bg-accent-soft text-accent" : "text-muted",
            )}
          >
            {n.label}
            {n.href === "/revisions" && due > 0 && <span className="num ml-1 text-flame">{due}</span>}
          </Link>
        ))}
      </nav>
    </header>
  );
}
