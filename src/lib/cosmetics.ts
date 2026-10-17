// Atelier : cosmétiques à équiper. Chaque niveau en débloque, certains succès aussi.
// Purement visuels : ils récompensent sans jamais changer la difficulté ni le contenu.

import { levelInfo } from "./gamification";
import { achievementById } from "./achievements";

export type Slot = "title" | "glyph" | "frame" | "theme" | "effect";
export type Unlock = { level: number } | { badge: string };

export type Cosmetic = {
  id: string;
  slot: Slot;
  name: string;
  hint?: string;
  unlock: Unlock;
  /** Glyphe : caractère affiché. Thème : [accent, accent foncé]. */
  glyph?: string;
  colors?: [string, string];
};

export type Equipped = Partial<Record<Slot, string>> & { u?: string };

export const SLOTS: { id: Slot; title: string; description: string }[] = [
  { id: "title", title: "Titre", description: "Affiché sous ton nom. Par défaut, ton rang suit ton niveau." },
  { id: "glyph", title: "Glyphe", description: "Le symbole de ton avatar." },
  { id: "frame", title: "Cadre", description: "Le contour de ton avatar." },
  { id: "theme", title: "Thème", description: "La couleur d'accent de tout le site." },
  { id: "effect", title: "Célébration", description: "L'effet joué quand tu réussis un défi ou passes un niveau." },
];

const L = (level: number): Unlock => ({ level });
const B = (badge: string): Unlock => ({ badge });

export const COSMETICS: Cosmetic[] = [
  // ---------------------------------------------------------- Rangs (titres de niveau) : la vie d'un modèle
  { id: "rank-1", slot: "title", name: "Point de donnée", unlock: L(1) },
  { id: "rank-2", slot: "title", name: "Échantillon", unlock: L(2) },
  { id: "rank-4", slot: "title", name: "Estimateur", unlock: L(4) },
  { id: "rank-7", slot: "title", name: "Modèle de base", unlock: L(7) },
  { id: "rank-10", slot: "title", name: "Ensemble", unlock: L(10) },
  { id: "rank-14", slot: "title", name: "Réseau profond", unlock: L(14) },
  { id: "rank-18", slot: "title", name: "Transformer", unlock: L(18) },
  { id: "rank-24", slot: "title", name: "Oracle bayésien", unlock: L(24) },
  // Titres de succès
  { id: "t-chasseur", slot: "title", name: "Chasseur de seuils", unlock: B("challenges-5") },
  { id: "t-perfection", slot: "title", name: "Perfectionniste", unlock: B("quiz-perfect-5") },
  { id: "t-metronome", slot: "title", name: "Métronome", unlock: B("streak-30") },
  { id: "t-archiviste", slot: "title", name: "Archiviste", unlock: B("consolidated-10") },
  { id: "t-specialiste", slot: "title", name: "Spécialiste", unlock: B("module-mastered") },
  { id: "t-chef", slot: "title", name: "Chef de labo", unlock: B("labs-all") },
  { id: "t-noctambule", slot: "title", name: "Noctambule", unlock: B("night") },

  // ---------------------------------------------------------- Glyphes
  { id: "g-initial", slot: "glyph", name: "Initiale", hint: "La première lettre de ton pseudo.", unlock: L(1) },
  { id: "g-mu", slot: "glyph", name: "Mu", glyph: "μ", hint: "La moyenne.", unlock: L(2) },
  { id: "g-sigma", slot: "glyph", name: "Sigma", glyph: "σ", hint: "L'écart-type.", unlock: L(4) },
  { id: "g-sum", slot: "glyph", name: "Somme", glyph: "Σ", hint: "Additionner tous les termes.", unlock: L(6) },
  { id: "g-nabla", slot: "glyph", name: "Nabla", glyph: "∇", hint: "Le gradient.", unlock: L(8) },
  { id: "g-lambda", slot: "glyph", name: "Lambda", glyph: "λ", hint: "La force de régularisation.", unlock: L(10) },
  { id: "g-theta", slot: "glyph", name: "Thêta", glyph: "θ", hint: "Les paramètres d'un modèle.", unlock: L(12) },
  { id: "g-inf", slot: "glyph", name: "Infini", glyph: "∞", hint: "La limite quand n grandit.", unlock: L(16) },
  { id: "g-eps", slot: "glyph", name: "Epsilon", glyph: "ε", hint: "La petite erreur qui fait progresser.", unlock: B("persist-1") },
  { id: "g-partial", slot: "glyph", name: "Dérivée partielle", glyph: "∂", unlock: B("first-try-10") },
  { id: "g-moon", slot: "glyph", name: "Croissant", glyph: "☾", unlock: B("night") },
  { id: "g-sun", slot: "glyph", name: "Aube", glyph: "☀", unlock: B("early") },

  // ---------------------------------------------------------- Cadres
  { id: "f-none", slot: "frame", name: "Aucun", unlock: L(1) },
  { id: "f-dashed", slot: "frame", name: "Pointillés", unlock: L(3) },
  { id: "f-double", slot: "frame", name: "Double anneau", unlock: L(5) },
  { id: "f-histogram", slot: "frame", name: "Histogramme radial", unlock: L(7) },
  { id: "f-wave", slot: "frame", name: "Onde", unlock: L(9) },
  { id: "f-constellation", slot: "frame", name: "Constellation", unlock: L(11) },
  { id: "f-prism", slot: "frame", name: "Prisme", unlock: L(15) },
  { id: "f-flame", slot: "frame", name: "Flamme", unlock: B("streak-7") },
  { id: "f-orbit", slot: "frame", name: "Orbite", unlock: B("labs-15") },
  { id: "f-laurel", slot: "frame", name: "Lauriers", unlock: B("module-mastered") },

  // ---------------------------------------------------------- Thèmes d'accent (contraste ≥ 4,5:1 avec le blanc)
  { id: "th-indigo", slot: "theme", name: "Indigo", colors: ["#4f46e5", "#3730a3"], unlock: L(1) },
  { id: "th-emeraude", slot: "theme", name: "Émeraude", colors: ["#047857", "#065f46"], unlock: L(3) },
  { id: "th-ocean", slot: "theme", name: "Océan", colors: ["#0369a1", "#0c4a6e"], unlock: L(6) },
  { id: "th-prune", slot: "theme", name: "Prune", colors: ["#7e22ce", "#581c87"], unlock: L(9) },
  { id: "th-graphite", slot: "theme", name: "Graphite", colors: ["#334155", "#1e293b"], unlock: L(13) },
  { id: "th-corail", slot: "theme", name: "Corail", colors: ["#c2410c", "#9a3412"], unlock: B("week-4") },
  { id: "th-ambre", slot: "theme", name: "Ambre", colors: ["#b45309", "#92400e"], unlock: B("all-lessons") },

  // ---------------------------------------------------------- Célébrations
  { id: "e-sparkles", slot: "effect", name: "Étincelles", unlock: L(1) },
  { id: "e-none", slot: "effect", name: "Discret", hint: "Aucune animation.", unlock: L(1) },
  { id: "e-confetti", slot: "effect", name: "Confettis", unlock: L(5) },
  { id: "e-scatter", slot: "effect", name: "Nuage de points", unlock: L(8) },
  { id: "e-glyphs", slot: "effect", name: "Pluie de symboles", unlock: L(12) },
];

export const cosmeticById = (id: string) => COSMETICS.find((c) => c.id === id);

export type UnlockContext = { level: number; badges: Record<string, string> };

export function unlockContext(xp: number, badges: Record<string, string>): UnlockContext {
  return { level: levelInfo(xp).level, badges };
}

export function isUnlocked(c: Cosmetic, ctx: UnlockContext) {
  return "level" in c.unlock ? ctx.level >= c.unlock.level : !!ctx.badges[c.unlock.badge];
}

export function unlockLabel(c: Cosmetic) {
  if ("level" in c.unlock) return `Niveau ${c.unlock.level}`;
  const ach = achievementById(c.unlock.badge);
  return ach ? (ach.secret ? "Succès secret" : `Succès « ${ach.title} »`) : "Succès";
}

/** Titre de rang correspondant à un niveau. */
export function rankTitle(level: number) {
  return COSMETICS.filter((c) => c.slot === "title" && c.id.startsWith("rank-") && "level" in c.unlock && c.unlock.level <= level).at(-1)!;
}

const DEFAULTS: Record<Exclude<Slot, "title">, string> = {
  glyph: "g-initial",
  frame: "f-none",
  theme: "th-indigo",
  effect: "e-sparkles",
};

/** Cosmétique effectivement porté : l'équipé s'il est débloqué, sinon le défaut (le rang du niveau pour le titre). */
export function resolveSlot(slot: Slot, equipped: Equipped | undefined, ctx: UnlockContext): Cosmetic {
  const chosen = equipped?.[slot] ? cosmeticById(equipped[slot]!) : undefined;
  if (chosen && chosen.slot === slot && isUnlocked(chosen, ctx)) return chosen;
  return slot === "title" ? rankTitle(ctx.level) : cosmeticById(DEFAULTS[slot])!;
}

/** Cosmétiques débloqués en passant du niveau `from` au niveau `to`. */
export const unlockedBetweenLevels = (from: number, to: number) =>
  COSMETICS.filter((c) => "level" in c.unlock && c.unlock.level > from && c.unlock.level <= to);

/** Cosmétiques débloqués par un succès. */
export const unlockedByBadge = (badge: string) => COSMETICS.filter((c) => "badge" in c.unlock && c.unlock.badge === badge);

/** Prochain niveau qui débloque quelque chose, et quoi. */
export function nextLevelUnlock(level: number) {
  const next = COSMETICS.filter((c) => "level" in c.unlock && c.unlock.level > level).sort(
    (x, y) => (x.unlock as { level: number }).level - (y.unlock as { level: number }).level,
  );
  if (!next.length) return null;
  const lvl = (next[0].unlock as { level: number }).level;
  return { level: lvl, items: next.filter((c) => (c.unlock as { level: number }).level === lvl) };
}

export const SLOT_NOUN: Record<Slot, string> = {
  title: "le titre",
  glyph: "le glyphe",
  frame: "le cadre",
  theme: "le thème",
  effect: "la célébration",
};

export const describeUnlock = (c: Cosmetic) => `${SLOT_NOUN[c.slot]} « ${c.name} »`;
