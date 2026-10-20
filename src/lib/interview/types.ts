// Banque de questions d'entretien : types communs.

export type ItvTopic = "fondamentaux" | "stats" | "modeles" | "choix" | "evaluation" | "data" | "deep" | "llm" | "prod" | "cas";
export type ItvKind = "qcm" | "oral" | "bug" | "calcul";
/** 1 = classique (junior), 2 = confirmé, 3 = avancé. */
export type ItvLevel = 1 | 2 | 3;

type Base = {
  id: string;
  topic: ItvTopic;
  level: ItvLevel;
  /** Question piège : la réponse intuitive est fausse. */
  trap?: boolean;
  /** Leçon à revoir. */
  lesson?: string;
  q: string;
};

export type QcmQ = Base & { kind: "qcm"; options: string[]; answer: number; explain: string };
/** Réponse ouverte, comme à l'oral : l'apprenant s'auto-évalue sur les points attendus. */
export type OralQ = Base & { kind: "oral"; points: string[]; answer: string };
/** Trouver la ligne fautive. `line` est 1-indexé. */
export type BugQ = Base & { kind: "bug"; lang: "python" | "sql"; code: string; line: number; explain: string; fix: string };
export type CalcQ = Base & { kind: "calcul"; answer: number; tolerance: number; unit?: string; explain: string };

export type ItvQuestion = QcmQ | OralQ | BugQ | CalcQ;

export const TOPICS: { id: ItvTopic; title: string; short: string }[] = [
  { id: "fondamentaux", title: "Fondamentaux ML", short: "Fondamentaux" },
  { id: "stats", title: "Stats & probas", short: "Stats" },
  { id: "modeles", title: "Modèles classiques", short: "Modèles" },
  { id: "choix", title: "Choisir un modèle", short: "Choix de modèle" },
  { id: "evaluation", title: "Évaluation", short: "Évaluation" },
  { id: "data", title: "Data, SQL & features", short: "Data & SQL" },
  { id: "deep", title: "Deep learning", short: "Deep learning" },
  { id: "llm", title: "LLM, RAG & agents", short: "LLM & agents" },
  { id: "prod", title: "Production & MLOps", short: "Production" },
  { id: "cas", title: "Études de cas", short: "Études de cas" },
];

export const KINDS: { id: ItvKind; title: string; description: string }[] = [
  { id: "qcm", title: "QCM", description: "Une seule bonne réponse, souvent un piège dans les autres." },
  { id: "oral", title: "Réponse orale", description: "Formule ta réponse, puis compare-la aux points attendus." },
  { id: "bug", title: "Trouve le bug", description: "Clique sur la ligne fautive." },
  { id: "calcul", title: "Calcul", description: "Le calcul de tête ou sur papier qu'on te demande au tableau." },
];

export const LEVELS: Record<ItvLevel, string> = { 1: "Classique", 2: "Confirmé", 3: "Avancé" };
