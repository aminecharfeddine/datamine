"use client";
import { useEffect } from "react";
import { useProgress } from "@/lib/store";
import { resolveSlot, unlockContext } from "@/lib/cosmetics";

/** Applique le thème d'accent équipé à tout le site (variables CSS sur <html>). */
export function ThemeApplier() {
  const xp = useProgress((s) => s.xp);
  const badges = useProgress((s) => s.badges);
  const cosmetics = useProgress((s) => s.cosmetics);
  const theme = resolveSlot("theme", cosmetics, unlockContext(xp, badges));
  useEffect(() => {
    const root = document.documentElement;
    if (!theme.colors || theme.id === "th-indigo") {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-deep");
      root.style.removeProperty("--accent-soft");
      return;
    }
    const [accent, deep] = theme.colors;
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-deep", deep);
    root.style.setProperty("--accent-soft", `${accent}1a`);
  }, [theme]);
  return null;
}
