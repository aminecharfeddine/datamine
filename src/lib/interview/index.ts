// Banque de questions d'entretien et logique de session (pure, testable).
import { CAS } from "./q-cas";
import { DATA } from "./q-data";
import { DEEP } from "./q-deep";
import { EVALUATION } from "./q-evaluation";
import { FONDAMENTAUX } from "./q-fondamentaux";
import { LLM } from "./q-llm";
import { MODELES } from "./q-modeles";
import { PROD } from "./q-prod";
import { STATS } from "./q-stats";
import { TOPICS, type ItvKind, type ItvLevel, type ItvQuestion, type ItvTopic } from "./types";
import { CHOIX } from "./q-choix";
import { CONCEPTS } from "./q-concepts";
import { SUITE } from "./q-suite";
import { SUITE2 } from "./q-suite2";
import { SUITE3 } from "./q-suite3";
import { SUITE4 } from "./q-suite4";

export * from "./types";

export const QUESTIONS: ItvQuestion[] = [...FONDAMENTAUX, ...STATS, ...MODELES, ...CHOIX, ...EVALUATION, ...DATA, ...DEEP, ...LLM, ...PROD, ...CAS, ...CONCEPTS, ...SUITE, ...SUITE2, ...SUITE3, ...SUITE4];
export const questionById = (id: string) => QUESTIONS.find((q) => q.id === id);

/** Score à partir duquel une question est considérée comme réussie. */
export const PASS = 0.7;
/** XP gagnée à la première réussite d'une question, et pour un entretien blanc réussi (une fois par jour). */
export const XP_QUESTION = 5;
export const XP_SIMULATION = 25;

/** Temps conseillé par format, en secondes (rythme d'un entretien réel). */
export const SUGGESTED_SECONDS: Record<ItvKind, number> = { qcm: 60, calcul: 120, bug: 120, oral: 180 };

export const answerKey = (id: string) => `itv:${id}`;
export const okKey = (id: string) => `itv-ok:${id}`;

export type QuestionStatus = "new" | "ok" | "retry";

/** État d'une question à partir des réponses mémorisées (score de la dernière tentative, en %). */
export function statusOf(id: string, answers: Record<string, number>): QuestionStatus {
  const last = answers[answerKey(id)];
  if (last === undefined) return "new";
  return last >= PASS * 100 ? "ok" : "retry";
}

/** Une réponse numérique est-elle juste ? Accepte la virgule décimale et les espaces. */
export function parseNumber(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(",", ".").replace(/[^\d.eE+-]/g, "");
  if (!s) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export function checkCalc(raw: string, answer: number, tolerance: number) {
  const v = parseNumber(raw);
  return v !== null && Math.abs(v - answer) <= tolerance + 1e-9;
}

export type Filters = { topics: ItvTopic[]; kinds: ItvKind[]; levels: ItvLevel[]; trapsOnly: boolean; scope: "all" | "new" | "retry" };

export function filterQuestions(f: Filters, answers: Record<string, number>, bank = QUESTIONS) {
  return bank.filter(
    (q) =>
      (!f.topics.length || f.topics.includes(q.topic)) &&
      (!f.kinds.length || f.kinds.includes(q.kind)) &&
      (!f.levels.length || f.levels.includes(q.level)) &&
      (!f.trapsOnly || q.trap) &&
      (f.scope === "all" || statusOf(q.id, answers) === f.scope),
  );
}

/** PRNG déterministe (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: T[], rand: () => number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const SIMULATION_SIZE = 10;
const SIM_MIX: Record<ItvKind, number> = { qcm: 6, oral: 3, bug: 1, calcul: 0 };

/**
 * Entretien blanc : 10 questions, 6 QCM, 3 orales, 1 bug, au plus 2 par thème,
 * en privilégiant les questions jamais vues ou à retravailler, ordonnées de la plus simple à la plus difficile.
 */
export function pickSimulation(seed: number, answers: Record<string, number>, bank = QUESTIONS): ItvQuestion[] {
  const rand = rng(seed);
  const priority = (q: ItvQuestion) => ({ retry: 0, new: 1, ok: 2 })[statusOf(q.id, answers)];
  const perTopic: Partial<Record<ItvTopic, number>> = {};
  const picked: ItvQuestion[] = [];
  for (const kind of ["oral", "bug", "calcul", "qcm"] as ItvKind[]) {
    const pool = shuffle(bank.filter((q) => q.kind === kind), rand).sort((a, b) => priority(a) - priority(b));
    let need = SIM_MIX[kind];
    for (const q of pool) {
      if (!need) break;
      if ((perTopic[q.topic] ?? 0) >= 2) continue;
      picked.push(q);
      perTopic[q.topic] = (perTopic[q.topic] ?? 0) + 1;
      need--;
    }
  }
  return picked.sort((a, b) => a.level - b.level);
}

export type SessionResult = { id: string; score: number };

/** Bilan d'une session : score global et par thème. */
export function sessionReport(results: SessionResult[]) {
  const byTopic = new Map<ItvTopic, { total: number; sum: number }>();
  for (const r of results) {
    const q = questionById(r.id);
    if (!q) continue;
    const t = byTopic.get(q.topic) ?? { total: 0, sum: 0 };
    t.total++;
    t.sum += r.score;
    byTopic.set(q.topic, t);
  }
  const score = results.length ? results.reduce((a, r) => a + r.score, 0) / results.length : 0;
  return {
    score,
    passed: results.filter((r) => r.score >= PASS).length,
    topics: [...byTopic.entries()].map(([topic, t]) => ({ topic, score: t.sum / t.total, total: t.total })).sort((a, b) => a.score - b.score),
    toReview: results.filter((r) => r.score < PASS).map((r) => questionById(r.id)!).filter(Boolean),
  };
}

/** Progression globale par thème : réussies / total. */
export function topicProgress(answers: Record<string, number>) {
  return Object.fromEntries(
    TOPICS.map(({ id: t }) => {
      const qs = QUESTIONS.filter((q) => q.topic === t);
      return [t, { total: qs.length, ok: qs.filter((q) => statusOf(q.id, answers) === "ok").length, retry: qs.filter((q) => statusOf(q.id, answers) === "retry").length }];
    }),
  ) as Record<ItvTopic, { total: number; ok: number; retry: number }>;
}
