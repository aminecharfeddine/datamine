"use client";
import { useProgress } from "@/lib/store";
import { useAuth } from "@/lib/sync/sync";
import { levelInfo } from "@/lib/gamification";
import { resolveSlot, unlockContext } from "@/lib/cosmetics";

/** Identité visible de l'utilisateur : nom, avatar équipé, titre et niveau. */
export function useMe() {
  const { pseudo, email, color } = useAuth();
  const xp = useProgress((s) => s.xp);
  const badges = useProgress((s) => s.badges);
  const cosmetics = useProgress((s) => s.cosmetics);
  const ctx = unlockContext(xp, badges);
  const name = pseudo || (email ? email.split("@")[0] : "Invité");
  return {
    name,
    letter: name.slice(0, 1),
    color: color ?? "var(--accent)",
    glyph: resolveSlot("glyph", cosmetics, ctx).glyph,
    frame: resolveSlot("frame", cosmetics, ctx).id,
    title: resolveSlot("title", cosmetics, ctx).name,
    level: levelInfo(xp),
    ctx,
  };
}
