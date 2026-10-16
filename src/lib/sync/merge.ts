import type { ProgressData, StoredCard } from "@/lib/store";
import { EMPTY_DATA } from "@/lib/store";

// Fusion de deux états de progression (ex. mode invité + compte, ou deux appareils).
// Propriétés : commutative, idempotente (merge(a, a) = a) et monotone — rien n'est jamais perdu,
// donc deux appareils qui se synchronisent l'un avec l'autre convergent vers le même état.

const union = <T,>(a: Record<string, T>, b: Record<string, T>) => ({ ...a, ...b });

const unionEarliest = (a: Record<string, string>, b: Record<string, string>) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = out[k] && out[k] < v ? out[k] : v;
  return out;
};

const maxPerKey = (a: Record<string, number>, b: Record<string, number>) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
};

/** Garde la carte la plus « avancée » : plus de révisions, puis révision la plus récente. */
function newerCard(a: StoredCard | undefined, b: StoredCard | undefined) {
  if (!a) return b!;
  if (!b) return a;
  if (a.reps !== b.reps) return a.reps > b.reps ? a : b;
  const la = a.last_review ?? "", lb = b.last_review ?? "";
  if (la !== lb) return la > lb ? a : b;
  return a.due >= b.due ? a : b;
}

export function mergeProgress(x: Partial<ProgressData> | null | undefined, y: Partial<ProgressData> | null | undefined): ProgressData {
  const a = { ...EMPTY_DATA, ...(x ?? {}) };
  const b = { ...EMPTY_DATA, ...(y ?? {}) };

  const srs: Record<string, StoredCard> = {};
  for (const id of new Set([...Object.keys(a.srs), ...Object.keys(b.srs)])) srs[id] = newerCard(a.srs[id], b.srs[id]);

  const dailyXp = maxPerKey(a.dailyXp, b.dailyXp);
  const dailySum = Object.values(dailyXp).reduce((s, v) => s + v, 0);

  const la = a.streak.lastDay ?? "", lb = b.streak.lastDay ?? "";
  const recent = la > lb ? a.streak : lb > la ? b.streak : a.streak.current >= b.streak.current ? a.streak : b.streak;

  return {
    xp: Math.max(a.xp, b.xp, dailySum),
    dailyXp,
    awarded: union(a.awarded, b.awarded),
    discovered: union(a.discovered, b.discovered),
    completedLessons: unionEarliest(a.completedLessons, b.completedLessons),
    challengesDone: Math.max(a.challengesDone, b.challengesDone),
    predictionsCorrect: Math.max(a.predictionsCorrect, b.predictionsCorrect),
    reviewsDone: Math.max(a.reviewsDone, b.reviewsDone),
    streak: { ...recent, best: Math.max(a.streak.best, b.streak.best, recent.current) },
    srs,
    badges: unionEarliest(a.badges, b.badges),
  };
}

/** JSON à clés triées : deux états égaux donnent la même chaîne, quel que soit l'ordre d'insertion. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

/** Égalité structurelle (pour éviter des écritures inutiles). */
export const sameData = (a: ProgressData, b: ProgressData) => stableStringify(a) === stableStringify(b);
