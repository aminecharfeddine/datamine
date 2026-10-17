"use client";
import Link from "next/link";
import clsx from "clsx";
import { useAuth } from "@/lib/sync/sync";
import { Avatar } from "@/components/game/Avatar";
import { useMe } from "@/components/game/useMe";
import { useHydrated } from "./useHydrated";

const DOT: Record<string, string> = {
  synced: "bg-good-bg",
  syncing: "bg-fn animate-pulse",
  error: "bg-flame",
};

export function AccountChip() {
  const { status, email } = useAuth();
  const me = useMe();
  const hydrated = useHydrated();
  if (status === "loading") return <span className="h-11 w-11" />;
  if (!email)
    return (
      <Link href="/compte" className="btn-ghost px-3 py-1.5 text-sm">
        Se connecter
      </Link>
    );
  return (
    <Link href="/profil" className="relative block" title={`${me.name} · ${me.title}`} aria-label={`Profil de ${me.name}`}>
      <Avatar size={44} letter={me.letter} glyph={hydrated ? me.glyph : undefined} frame={hydrated ? me.frame : "f-none"} color={me.color} />
      <span className={clsx("absolute bottom-1 right-1 h-3 w-3 rounded-full ring-2 ring-surface", DOT[status] ?? "bg-muted")} />
    </Link>
  );
}
