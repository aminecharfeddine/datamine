// Succès : ce qui est récompensé, c'est la régularité, la maîtrise, la rigueur et la curiosité.
// Jamais le temps passé ni les clics. Tous les succès sont dérivés de la progression : rien à stocker
// en plus des dates d'obtention, et un succès mérité sur un appareil réapparaît partout après fusion.

import { ALL_LESSONS, MODULES } from "./curriculum";
import { conceptLevel } from "./mastery";

export type Family = "regularite" | "maitrise" | "rigueur" | "curiosite" | "secret";
export type Tier = "bronze" | "argent" | "or" | "platine";

/** Sous-ensemble de la progression dont les succès ont besoin (évite une dépendance au store). */
export type AchievementSource = {
  xp: number;
  dailyXp: Record<string, number>;
  awarded: Record<string, true>;
  discovered: Record<string, true>;
  completedLessons: Record<string, string>;
  challengesDone: number;
  predictionsCorrect: number;
  reviewsDone: number;
  streak: { best: number };
  srs: Record<string, { reps: number; stability: number }>;
  badges: Record<string, string>;
  explored?: Record<string, true>;
};

/** Nombre d'instances de labos et de défis dans les leçons publiées (vérifié par un test). */
export const TOTAL_LABS = 76;
export const AVAILABLE_LESSONS = ALL_LESSONS.filter((l) => l.available);

export type Stats = {
  lessons: number;
  modulesTouched: number;
  challenges: number;
  challengesNoHint: number;
  predictionsCorrect: number;
  reviews: number;
  streakBest: number;
  weeksComplete: number;
  comeback: number;
  mastered: number;
  consolidated: number;
  modulesMastered: number;
  perfectQuizzes: number;
  exercisesFirstTry: number;
  persistence: number;
  labsExplored: number;
  fichesRead: number;
  night: number;
  early: number;
  revisit: number;
};

const countPrefix = (rec: Record<string, true>, prefix: string) => Object.keys(rec).filter((k) => k.startsWith(prefix)).length;

/** Lundi (YYYY-MM-DD) de la semaine d'un jour donné. */
export function weekOf(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const monday = new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * 86_400_000);
  return monday.toISOString().slice(0, 10);
}

/** Objectif hebdomadaire : 4 jours actifs sur 7. Assez exigeant pour créer un rythme, sans punir un jour off. */
export const WEEKLY_GOAL = 4;

export function activeDaysByWeek(dailyXp: Record<string, number>) {
  const weeks: Record<string, number> = {};
  for (const [day, xp] of Object.entries(dailyXp)) if (xp > 0) weeks[weekOf(day)] = (weeks[weekOf(day)] ?? 0) + 1;
  return weeks;
}

function hasComeback(dailyXp: Record<string, number>) {
  const days = Object.keys(dailyXp).filter((d) => dailyXp[d] > 0).sort();
  for (let i = 1; i < days.length; i++) {
    const [a, b] = [days[i - 1], days[i]].map((d) => {
      const [y, m, dd] = d.split("-").map(Number);
      return Date.UTC(y, m - 1, dd);
    });
    if ((b - a) / 86_400_000 >= 8) return true;
  }
  return false;
}

/** Concepts couverts par les leçons publiées, par module. */
const COVERED = MODULES.map((m) => ({
  id: m.id,
  concepts: [...new Set(m.lessons.filter((l) => l.available).flatMap((l) => l.concepts))],
  lessons: m.lessons.filter((l) => l.available).map((l) => l.slug),
})).filter((m) => m.concepts.length > 0);
const COVERED_CONCEPTS = COVERED.flatMap((m) => m.concepts);

export function computeStats(d: AchievementSource): Stats {
  const explored = d.explored ?? {};
  const levels = Object.fromEntries(COVERED_CONCEPTS.map((c) => [c, conceptLevel(d, c)]));
  const challengeKeys = Object.keys(d.awarded).filter((k) => k.includes(":challenge:"));
  return {
    lessons: AVAILABLE_LESSONS.filter((l) => d.completedLessons[l.slug]).length,
    modulesTouched: COVERED.filter((m) => m.lessons.some((s) => d.completedLessons[s])).length,
    challenges: d.challengesDone,
    challengesNoHint: challengeKeys.filter((k) => !explored[`hint:${k}`]).length,
    predictionsCorrect: d.predictionsCorrect,
    reviews: d.reviewsDone,
    streakBest: d.streak.best,
    weeksComplete: Object.values(activeDaysByWeek(d.dailyXp)).filter((n) => n >= WEEKLY_GOAL).length,
    comeback: hasComeback(d.dailyXp) ? 1 : 0,
    mastered: COVERED_CONCEPTS.filter((c) => levels[c] >= 3).length,
    consolidated: COVERED_CONCEPTS.filter((c) => levels[c] >= 4).length,
    modulesMastered: COVERED.filter((m) => m.lessons.every((s) => d.completedLessons[s]) && m.concepts.every((c) => levels[c] >= 3)).length,
    perfectQuizzes: countPrefix(explored, "quiz-perfect:"),
    exercisesFirstTry: countPrefix(explored, "ex-first:"),
    persistence: countPrefix(explored, "ex-persist:"),
    labsExplored: countPrefix(explored, "lab:"),
    fichesRead: countPrefix(explored, "fiche:"),
    night: explored["time:night"] ? 1 : 0,
    early: explored["time:early"] ? 1 : 0,
    revisit: explored["revisit"] ? 1 : 0,
  };
}

export type Achievement = {
  id: string;
  family: Family;
  tier?: Tier;
  title: string;
  description: string;
  secret?: boolean;
  goal: number;
  value: (s: Stats) => number;
};

const a = (
  id: string,
  family: Family,
  title: string,
  description: string,
  goal: number,
  value: (s: Stats) => number,
  tier?: Tier,
  secret?: boolean,
): Achievement => ({ id, family, title, description, goal, value, tier, secret });

export const ACHIEVEMENTS: Achievement[] = [
  // ------------------------------------------------ Régularité
  a("streak-3", "regularite", "Régulier", "Une série de 3 jours.", 3, (s) => s.streakBest, "bronze"),
  a("streak-7", "regularite", "Inarrêtable", "Une série de 7 jours.", 7, (s) => s.streakBest, "argent"),
  a("streak-30", "regularite", "Métronome", "Une série de 30 jours.", 30, (s) => s.streakBest, "or"),
  a("streak-100", "regularite", "Loi des grands nombres", "Une série de 100 jours.", 100, (s) => s.streakBest, "platine"),
  a("week-1", "regularite", "Rituel", `Une semaine avec au moins ${WEEKLY_GOAL} jours d'apprentissage.`, 1, (s) => s.weeksComplete, "bronze"),
  a("week-4", "regularite", "Cadence", `4 semaines avec au moins ${WEEKLY_GOAL} jours d'apprentissage.`, 4, (s) => s.weeksComplete, "argent"),
  a("week-12", "regularite", "Saisonnalité", `12 semaines avec au moins ${WEEKLY_GOAL} jours d'apprentissage.`, 12, (s) => s.weeksComplete, "or"),
  a("reviews-25", "regularite", "Mémoire longue", "25 révisions.", 25, (s) => s.reviews, "bronze"),
  a("reviews-100", "regularite", "Répétition espacée", "100 révisions.", 100, (s) => s.reviews, "argent"),
  a("reviews-500", "regularite", "Courbe de l'oubli vaincue", "500 révisions.", 500, (s) => s.reviews, "or"),
  a("comeback", "regularite", "Rebond", "Reprendre après au moins une semaine de pause. Ce qui compte, c'est de revenir.", 1, (s) => s.comeback),

  // ------------------------------------------------ Maîtrise
  a("first-lesson", "maitrise", "Premier pas", "Terminer une leçon.", 1, (s) => s.lessons, "bronze"),
  a("lessons-5", "maitrise", "Apprenti modélisateur", "Terminer 5 leçons.", 5, (s) => s.lessons, "argent"),
  a("all-lessons", "maitrise", "Programme complet", "Terminer toutes les leçons publiées.", AVAILABLE_LESSONS.length, (s) => s.lessons, "or"),
  a("mastered-1", "maitrise", "Ça rentre", "Maîtriser un concept : toutes ses cartes révisées et retenues au moins 5 jours.", 1, (s) => s.mastered, "bronze"),
  a("mastered-10", "maitrise", "Base solide", "Maîtriser 10 concepts.", 10, (s) => s.mastered, "argent"),
  a("consolidated-1", "maitrise", "Gravé", "Consolider un concept : mémoire stable au-delà de 3 semaines.", 1, (s) => s.consolidated, "argent"),
  a("consolidated-10", "maitrise", "Archiviste", "Consolider 10 concepts.", 10, (s) => s.consolidated, "or"),
  a("module-mastered", "maitrise", "Spécialiste", "Terminer un module et maîtriser tous ses concepts.", 1, (s) => s.modulesMastered, "or"),

  // ------------------------------------------------ Rigueur
  a("first-challenge", "rigueur", "Mains dans le cambouis", "Réussir un défi.", 1, (s) => s.challenges, "bronze"),
  a("challenges-5", "rigueur", "Chasseur de seuils", "Réussir 5 défis.", 5, (s) => s.challenges, "argent"),
  a("challenges-15", "rigueur", "Expérimentateur", "Réussir 15 défis.", 15, (s) => s.challenges, "or"),
  a("no-hint-5", "rigueur", "Sans filet", "Réussir 5 défis sans afficher l'indice.", 5, (s) => s.challengesNoHint, "argent"),
  a("oracle", "rigueur", "Oracle", "10 prédictions correctes.", 10, (s) => s.predictionsCorrect, "bronze"),
  a("oracle-30", "rigueur", "Intuition statistique", "30 prédictions correctes.", 30, (s) => s.predictionsCorrect, "argent"),
  a("quiz-perfect-1", "rigueur", "Sans faute", "Un quiz de fin de leçon sans erreur.", 1, (s) => s.perfectQuizzes, "bronze"),
  a("quiz-perfect-5", "rigueur", "Perfectionniste", "5 quiz sans erreur.", 5, (s) => s.perfectQuizzes, "argent"),
  a("first-try-3", "rigueur", "Calcul mental", "3 exercices réussis du premier coup.", 3, (s) => s.exercisesFirstTry, "bronze"),
  a("first-try-10", "rigueur", "Machine à calculer", "10 exercices réussis du premier coup.", 10, (s) => s.exercisesFirstTry, "argent"),
  a("persist-1", "rigueur", "Persévérant", "Réussir un exercice après au moins deux erreurs.", 1, (s) => s.persistence, "bronze"),

  // ------------------------------------------------ Curiosité
  a("labs-5", "curiosite", "Touche-à-tout", "Manipuler 5 labos interactifs.", 5, (s) => s.labsExplored, "bronze"),
  a("labs-15", "curiosite", "Laborantin", "Manipuler 15 labos interactifs.", 15, (s) => s.labsExplored, "argent"),
  a("labs-all", "curiosite", "Chef de labo", "Manipuler tous les labos interactifs.", TOTAL_LABS, (s) => s.labsExplored, "or"),
  a("fiches-3", "curiosite", "Lecteur", "Ouvrir 3 fiches récap.", 3, (s) => s.fichesRead, "bronze"),
  a("fiches-all", "curiosite", "Bibliothécaire", "Ouvrir toutes les fiches récap.", AVAILABLE_LESSONS.length, (s) => s.fichesRead, "or"),
  a("polymath", "curiosite", "Polymathe", "Terminer une leçon dans 4 modules différents.", 4, (s) => s.modulesTouched, "argent"),

  // ------------------------------------------------ Secrets
  a("night", "secret", "Noctambule", "Apprendre entre minuit et 5 h.", 1, (s) => s.night, undefined, true),
  a("early", "secret", "Lève-tôt", "Apprendre entre 5 h et 7 h.", 1, (s) => s.early, undefined, true),
  a("revisit", "secret", "Retour aux sources", "Rouvrir une leçon terminée il y a plus d'un mois.", 1, (s) => s.revisit, undefined, true),
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((x) => x.id === id);

export const FAMILIES: { id: Family; title: string; description: string }[] = [
  { id: "regularite", title: "Régularité", description: "Revenir souvent, même peu : c'est ce qui fait retenir." },
  { id: "maitrise", title: "Maîtrise", description: "Comprendre, puis retenir dans la durée." },
  { id: "rigueur", title: "Rigueur", description: "Prédire juste, calculer juste, chercher sans aide." },
  { id: "curiosite", title: "Curiosité", description: "Manipuler, explorer, aller voir plus loin." },
  { id: "secret", title: "Secrets", description: "À découvrir en chemin." },
];

/** Succès mérités mais pas encore enregistrés. */
export function newlyEarned(d: AchievementSource): Achievement[] {
  const s = computeStats(d);
  return ACHIEVEMENTS.filter((x) => !d.badges[x.id] && x.value(s) >= x.goal);
}

/** Ajoute les succès mérités mais absents (ex. après la fusion de deux appareils). Ne retire jamais rien. */
export function withEarnedBadges<T extends AchievementSource>(d: T, now = new Date().toISOString()): T {
  const missing = newlyEarned(d);
  if (!missing.length) return d;
  const badges = { ...d.badges };
  missing.forEach((x) => (badges[x.id] = now));
  return { ...d, badges };
}
