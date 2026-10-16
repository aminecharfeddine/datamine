"use client";
import Link from "next/link";
import clsx from "clsx";
import { useAuth } from "@/lib/sync/sync";

const DOT: Record<string, string> = {
  synced: "bg-good",
  syncing: "bg-fn animate-pulse",
  error: "bg-accent",
};

export function AccountChip() {
  const { status, email } = useAuth();
  if (status === "loading") return <span className="h-7 w-7" />;
  if (!email)
    return (
      <Link href="/compte" className="rounded-full border border-line px-3 py-1 text-sm hover:border-ink">
        Se connecter
      </Link>
    );
  return (
    <Link href="/compte" className="relative flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold uppercase text-paper" title={email}>
      {email[0]}
      <span className={clsx("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-paper", DOT[status] ?? "bg-muted")} />
    </Link>
  );
}
