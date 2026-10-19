// Module « ML en pratique » : données d'une boutique fictive et calculs des labos
// (pandas, pipelines scikit-learn, feature engineering, SQL, dérive en production).
import { mulberry32, normals } from "./metrics";
import { fitLogistic, sigmoid, solve } from "./models";
import { foldAssignment } from "./ml";

// ============================================================ La boutique (clients et commandes)

export const VILLES = ["Lyon", "Paris", "Lille", "Nantes", "Marseille"] as const;
export const CATEGORIES = ["Livres", "Maison", "Sport", "Tech"] as const;
const PRENOMS = ["Alice", "Bilal", "Chloé", "David", "Emma", "Farid", "Gaëlle", "Hugo", "Inès", "Jules", "Karim", "Léa", "Malik", "Nina", "Oscar", "Paul", "Rania", "Sami", "Théo", "Yasmine", "Zoé", "Adam", "Lina", "Noah"];

export type Client = { id: number; prenom: string; ville: string; age: number; inscription: string };
export type Commande = { id: number; client_id: number; date: string; categorie: string; montant: number };

function makeShop(seed = 12) {
  const r = mulberry32(seed);
  const clients: Client[] = PRENOMS.map((prenom, i) => ({
    id: i + 1,
    prenom,
    ville: VILLES[Math.floor(r() * VILLES.length)],
    age: 19 + Math.floor(r() * 50),
    inscription: `2025-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-${String(1 + Math.floor(r() * 28)).padStart(2, "0")}`,
  }));
  const commandes: Commande[] = [];
  let id = 1;
  for (const c of clients) {
    const n = Math.floor(r() * 7); // certains clients n'ont jamais commandé
    for (let k = 0; k < n; k++) {
      const cat = CATEGORIES[Math.floor(r() * CATEGORIES.length)];
      const base = { Livres: 18, Maison: 55, Sport: 40, Tech: 120 }[cat];
      commandes.push({
        id: id++,
        client_id: c.id,
        date: `2026-${String(1 + Math.floor(r() * 6)).padStart(2, "0")}-${String(1 + Math.floor(r() * 28)).padStart(2, "0")}`,
        categorie: cat,
        montant: Math.round(base * (0.5 + r() * 1.5) * 100) / 100,
      });
    }
  }
  commandes.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  commandes.forEach((c, i) => (c.id = i + 1));
  return { clients, commandes };
}
export const SHOP = makeShop();

/** Script SQL qui crée et remplit les deux tables. */
export function shopSql() {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  return [
    "CREATE TABLE clients (id INTEGER PRIMARY KEY, prenom TEXT, ville TEXT, age INTEGER, inscription TEXT);",
    "CREATE TABLE commandes (id INTEGER PRIMARY KEY, client_id INTEGER REFERENCES clients(id), date TEXT, categorie TEXT, montant REAL);",
    `INSERT INTO clients VALUES ${SHOP.clients.map((c) => `(${c.id}, ${q(c.prenom)}, ${q(c.ville)}, ${c.age}, ${q(c.inscription)})`).join(", ")};`,
    `INSERT INTO commandes VALUES ${SHOP.commandes.map((c) => `(${c.id}, ${c.client_id}, ${q(c.date)}, ${q(c.categorie)}, ${c.montant})`).join(", ")};`,
  ].join("\n");
}

// ============================================================ Mini-pandas (pour le labo)

export type Row = Record<string, string | number>;
export type Agg = "sum" | "mean" | "count" | "max";
export type GroupKey = "none" | "ville" | "categorie" | "mois";
export type PandasQuery = { categorie: string; minMontant: number; group: GroupKey; agg: Agg; sortDesc: boolean; head: number };

/** Commandes enrichies de la ville du client et du mois (équivalent d'un merge). */
export const ORDERS: Row[] = SHOP.commandes.map((o) => ({
  ...o,
  ville: SHOP.clients.find((c) => c.id === o.client_id)!.ville,
  mois: o.date.slice(0, 7),
}));

const round2 = (v: number) => Math.round(v * 100) / 100;

export function runPandas(q: PandasQuery): { columns: string[]; rows: Row[] } {
  let df = ORDERS.filter((r) => (q.categorie === "toutes" || r.categorie === q.categorie) && (r.montant as number) > q.minMontant);
  let columns: string[];
  let rows: Row[];
  if (q.group === "none") {
    columns = ["id", "date", "ville", "categorie", "montant"];
    rows = df.map((r) => Object.fromEntries(columns.map((c) => [c, r[c]])));
    if (q.sortDesc) rows = [...rows].sort((a, b) => (b.montant as number) - (a.montant as number));
  } else {
    const groups = new Map<string, number[]>();
    for (const r of df) {
      const k = String(r[q.group]);
      groups.set(k, [...(groups.get(k) ?? []), r.montant as number]);
    }
    const f = (xs: number[]) =>
      q.agg === "sum" ? xs.reduce((a, b) => a + b, 0) : q.agg === "mean" ? xs.reduce((a, b) => a + b, 0) / xs.length : q.agg === "count" ? xs.length : Math.max(...xs);
    columns = [q.group, "montant"];
    rows = [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, xs]) => ({ [q.group]: k, montant: round2(f(xs)) }));
    if (q.sortDesc) rows.sort((a, b) => (b.montant as number) - (a.montant as number));
  }
  return { columns, rows: rows.slice(0, q.head) };
}

export function pandasCode(q: PandasQuery) {
  const lines = ['villes = clients[["id", "ville"]].rename(columns={"id": "client_id"})', 'df = commandes.merge(villes, on="client_id", how="left")'];
  const conds: string[] = [];
  if (q.categorie !== "toutes") conds.push(`(df["categorie"] == "${q.categorie}")`);
  if (q.minMontant > 0) conds.push(`(df["montant"] > ${q.minMontant})`);
  if (conds.length) lines.push(`df = df[${conds.join(" & ")}]`);
  let expr = "df";
  if (q.group !== "none") {
    if (q.group === "mois") lines.push('df["mois"] = df["date"].str[:7]');
    expr = `df.groupby("${q.group}")["montant"].${q.agg}()`;
    if (q.sortDesc) expr += ".sort_values(ascending=False)";
  } else if (q.sortDesc) expr = 'df.sort_values("montant", ascending=False)';
  expr += `.head(${q.head})`;
  lines.push(`resultat = ${expr}`);
  return lines.join("\n");
}

// ============================================================ Broadcasting NumPy

export type Shape = number[];

/** Forme du résultat d'une opération élément par élément, ou null si incompatible (règles NumPy). */
export function broadcast(a: Shape, b: Shape): Shape | null {
  const n = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = a[a.length - n + i] ?? 1, y = b[b.length - n + i] ?? 1;
    if (x !== y && x !== 1 && y !== 1) return null;
    out.push(Math.max(x, y));
  }
  return out;
}

// ============================================================ Pipeline scikit-learn (données de churn)

export type ChurnRow = { age: number | null; revenu: number | null; ville: number; anciennete: number; y: 0 | 1 };

/** 400 clients : revenu en euros (grande échelle), valeurs manquantes, une ville très prédictive. */
export function churnData(n = 400, seed = 8): ChurnRow[] {
  const r = mulberry32(seed);
  const z = normals(3 * n, seed + 1);
  // Effet de la ville : non ordonné (la ville 2 résilie beaucoup, la 4 très peu).
  const villeEffect = [0.2, -0.6, 1.8, 0.1, -1.5];
  return Array.from({ length: n }, (_, i) => {
    const age = Math.round(Math.min(80, Math.max(18, 42 + 14 * z[3 * i])));
    const revenu = Math.round(Math.max(15000, 45000 + 20000 * z[3 * i + 1]));
    const ville = Math.floor(r() * 5);
    const anciennete = Math.floor(r() * 60);
    const logit = -0.4 + villeEffect[ville] - 0.045 * (anciennete - 30) + 0.035 * (age - 42) - 0.00002 * (revenu - 45000);
    const y = (r() < sigmoid(logit) ? 1 : 0) as 0 | 1;
    return {
      age: r() < 0.08 ? null : age,
      revenu: r() < 0.12 ? null : revenu,
      ville,
      anciennete,
      y,
    };
  });
}
export const CHURN = churnData();

export type PipeConfig = {
  impute: "drop" | "mean" | "median";
  scale: "none" | "standard";
  ville: "drop" | "ordinal" | "onehot";
  model: "knn" | "logreg";
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Préprocessing appris sur `fitRows` uniquement, appliqué à `rows` : exactement ce que fait un Pipeline. */
function makeTransformer(fitRows: ChurnRow[], cfg: PipeConfig) {
  const nums = ["age", "revenu", "anciennete"] as const;
  const fill = Object.fromEntries(
    nums.map((k) => {
      const vals = fitRows.map((r) => r[k]).filter((v): v is number => v !== null);
      return [k, cfg.impute === "median" ? median(vals) : vals.reduce((a, b) => a + b, 0) / vals.length];
    }),
  ) as Record<(typeof nums)[number], number>;
  const raw = (r: ChurnRow) => {
    const v = nums.map((k) => r[k] ?? fill[k]);
    if (cfg.ville === "ordinal") v.push(r.ville);
    if (cfg.ville === "onehot") for (let j = 0; j < 5; j++) v.push(r.ville === j ? 1 : 0);
    return v;
  };
  const M = fitRows.map(raw);
  const p = M[0].length;
  const mu = Array.from({ length: p }, (_, j) => M.reduce((s, x) => s + x[j], 0) / M.length);
  const sd = Array.from({ length: p }, (_, j) => Math.sqrt(M.reduce((s, x) => s + (x[j] - mu[j]) ** 2, 0) / M.length) || 1);
  return (r: ChurnRow) => {
    const v = raw(r);
    return cfg.scale === "standard" ? v.map((x, j) => (x - mu[j]) / sd[j]) : v;
  };
}

function predictor(train: number[][], y: number[], cfg: PipeConfig) {
  if (cfg.model === "logreg") {
    // Pénalité L2 (comme LogisticRegression par défaut) : sensible à l'échelle.
    const w = fitLogistic(train.map((x) => [1, ...x]), y, 0.01, 30);
    return (x: number[]) => (sigmoid(w[0] + x.reduce((s, v, j) => s + v * w[j + 1], 0)) >= 0.5 ? 1 : 0);
  }
  return (x: number[]) => {
    const d = train.map((t, i) => [t.reduce((s, v, j) => s + (v - x[j]) ** 2, 0), y[i]] as const).sort((a, b) => a[0] - b[0]);
    let votes = 0;
    for (let k = 0; k < 15; k++) votes += d[k][1];
    return votes > 7 ? 1 : 0;
  };
}

/** Validation croisée 5 plis, préprocessing réappris dans chaque pli. */
export function pipelineCv(cfg: PipeConfig, data: ChurnRow[] = CHURN) {
  const rows = cfg.impute === "drop" ? data.filter((r) => r.age !== null && r.revenu !== null) : data;
  const fold = foldAssignment(rows.length, 5, 4);
  const accs = Array.from({ length: 5 }, (_, f) => {
    const tr = rows.filter((_, i) => fold[i] !== f);
    const te = rows.filter((_, i) => fold[i] === f);
    const T = makeTransformer(tr, cfg);
    const pred = predictor(tr.map(T), tr.map((r) => r.y), cfg);
    return te.filter((r) => pred(T(r)) === r.y).length / te.length;
  });
  return { acc: accs.reduce((a, b) => a + b, 0) / 5, n: rows.length, dropped: data.length - rows.length };
}

export function pipelineCode(cfg: PipeConfig) {
  const imp = cfg.impute === "drop" ? null : `SimpleImputer(strategy="${cfg.impute}")`;
  const numSteps = [imp && `("imputer", ${imp})`, cfg.scale === "standard" && '("scaler", StandardScaler())'].filter(Boolean);
  const lines = [] as string[];
  if (cfg.impute === "drop") lines.push('df = df.dropna(subset=["age", "revenu"])  # lignes perdues, et impossible en production', "");
  lines.push(`num = ${numSteps.length ? `Pipeline([${numSteps.join(", ")}])` : '"passthrough"'}`);
  const trans = ['("num", num, ["age", "revenu", "anciennete"])'];
  if (cfg.ville === "ordinal") trans.push('("ville", OrdinalEncoder(), ["ville"])');
  if (cfg.ville === "onehot") trans.push('("ville", OneHotEncoder(handle_unknown="ignore"), ["ville"])');
  lines.push(`pre = ColumnTransformer([\n    ${trans.join(",\n    ")},\n])`);
  lines.push(`model = Pipeline([\n    ("pre", pre),\n    ("clf", ${cfg.model === "knn" ? "KNeighborsClassifier(n_neighbors=15)" : "LogisticRegression()"}),\n])`);
  lines.push('scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")');
  return lines.join("\n");
}

// ============================================================ Feature engineering (ventes quotidiennes)

export type Day = { t: number; dow: number; temp: number; promo: 0 | 1; ventes: number };

/** Deux ans de ventes : effet du week-end, température en cloche, promo plus forte le week-end, tendance. */
export function salesData(seed = 21): Day[] {
  const r = mulberry32(seed);
  const z = normals(2 * 730, seed + 3);
  return Array.from({ length: 730 }, (_, t) => {
    const dow = t % 7; // 5 et 6 : week-end
    const we = dow >= 5 ? 1 : 0;
    const temp = 14 + 10 * Math.sin((2 * Math.PI * (t - 100)) / 365) + 3 * z[2 * t];
    const promo = (r() < 0.15 ? 1 : 0) as 0 | 1;
    const ventes = 200 + 0.12 * t + 60 * we - 0.5 * (temp - 21) ** 2 + promo * (25 + 45 * we) + 12 * z[2 * t + 1];
    return { t, dow, temp, promo, ventes };
  });
}
export const SALES = salesData();

export type FeatSet = { dow: boolean; temp2: boolean; inter: boolean; split: "temporel" | "aleatoire" };

export function featureRow(d: Day, f: FeatSet) {
  const x = [1, d.t, d.temp, d.promo];
  if (f.dow) for (let j = 1; j < 7; j++) x.push(d.dow === j ? 1 : 0);
  if (f.temp2) x.push((d.temp - 20) ** 2);
  if (f.inter) x.push(d.promo * (d.dow >= 5 ? 1 : 0));
  return x;
}

/** Régression linéaire (moindres carrés, petite pénalité numérique) et R² de validation. */
export function featureFit(f: FeatSet, data: Day[] = SALES) {
  const order = f.split === "temporel" ? data.map((_, i) => i) : [...data.keys()].sort((a, b) => ((a * 7919) % 730) - ((b * 7919) % 730));
  const cut = Math.round(data.length * 0.8);
  const tr = order.slice(0, cut).map((i) => data[i]);
  const va = order.slice(cut).map((i) => data[i]);
  const X = tr.map((d) => featureRow(d, f));
  const p = X[0].length;
  const A = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) => X.reduce((s, x) => s + x[a] * x[b], 0) + (a === b ? 1e-6 : 0)));
  const bv = Array.from({ length: p }, (_, a) => X.reduce((s, x, i) => s + x[a] * tr[i].ventes, 0));
  const w = solve(A, bv);
  const pred = (d: Day) => featureRow(d, f).reduce((s, v, j) => s + v * w[j], 0);
  const r2 = (pts: Day[]) => {
    const m = pts.reduce((s, d) => s + d.ventes, 0) / pts.length;
    const ssr = pts.reduce((s, d) => s + (d.ventes - pred(d)) ** 2, 0);
    const sst = pts.reduce((s, d) => s + (d.ventes - m) ** 2, 0);
    return 1 - ssr / sst;
  };
  return { trainR2: r2(tr), valR2: r2(va), nFeatures: p, predict: pred, val: va };
}

// ============================================================ Dérive en production

export const MONTHS = 12;
const DRIFT = 0.28; // déplacement mensuel de la distribution et du seuil

/** Données du mois t : panier moyen (standardisé) qui monte, et la définition de « gros client » qui suit. */
export function monthData(t: number, n = 600, seed = 40) {
  const z = normals(2 * n, seed + 17 * t);
  return Array.from({ length: n }, (_, i) => {
    const x = DRIFT * t + z[2 * i];
    return { x, y: (x - DRIFT * t + 0.45 * z[2 * i + 1] > 0 ? 1 : 0) as 0 | 1 };
  });
}

/** Modèle à un seuil appris sur le mois `m` (régression logistique à une variable). */
export function trainOnMonth(m: number) {
  const d = monthData(m);
  const [b, a] = fitLogistic(d.map((p) => [1, p.x]), d.map((p) => p.y), 0, 30);
  return { month: m, thr: -b / a };
}

export const monthAccuracy = (thr: number, t: number) => {
  const d = monthData(t);
  return d.filter((p) => (p.x > thr ? 1 : 0) === p.y).length / d.length;
};

/** Population Stability Index entre deux échantillons, sur 10 intervalles définis par les déciles de référence. */
export function psi(ref: number[], cur: number[]) {
  const s = [...ref].sort((a, b) => a - b);
  const edges = Array.from({ length: 9 }, (_, i) => s[Math.floor(((i + 1) * s.length) / 10)]);
  const bin = (x: number) => edges.filter((e) => x > e).length;
  const share = (xs: number[]) => {
    const c = new Array(10).fill(0);
    xs.forEach((x) => c[bin(x)]++);
    return c.map((v) => Math.max(v / xs.length, 1e-4));
  };
  const p = share(ref), q = share(cur);
  return p.reduce((acc, pi, i) => acc + (q[i] - pi) * Math.log(q[i] / pi), 0);
}

/** Simule une année : à chaque mois, le modèle en service est le dernier réentraîné (au plus tard au mois précédent). */
export function simulateYear(retrainAt: number[]) {
  let model = trainOnMonth(0);
  return Array.from({ length: MONTHS + 1 }, (_, t) => {
    if (t > 0 && retrainAt.includes(t)) model = trainOnMonth(t - 1);
    const ref = monthData(model.month).map((p) => p.x);
    const cur = monthData(t).map((p) => p.x);
    return { t, version: model.month, acc: monthAccuracy(model.thr, t), psi: psi(ref, cur) };
  });
}
