"use client";
import Link from "next/link";
import clsx from "clsx";
import { useAuth } from "@/lib/sync/sync";

const DOT: Record<string, string> = {
  synced: "bg-good-bg",
  syncing: "bg-fn animate-pulse",
  error: "bg-flame",
};

export function AccountChip() {
  const { status, email, pseudo, color } = useAuth();
  if (status === "loading") return <span className="h-9 w-9" />;
  if (!email)
    return (
      <Link href="/compte" className="btn-ghost px-3 py-1.5 text-sm">
        Se connecter
      </Link>
    );
  return (
    <Link
      href="/compte"
      className="relative flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold uppercase text-white"
      style={{ background: color ?? "var(--accent)" }}
      title={pseudo ?? email}
      aria-label={`Compte de ${pseudo ?? email}`}
    >
      {(pseudo ?? email)[0]}
      <span className={clsx("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface", DOT[status] ?? "bg-muted")} />
    </Link>
  );
}
