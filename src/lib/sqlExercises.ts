// Exercices SQL : requête de départ et solution de référence (le résultat attendu est calculé en exécutant la solution).

export type SqlExercise = { starter: string; solution: string; ordered: boolean };

export const SQL_EXERCISES: Record<string, SqlExercise> = {
  "sql-filter": {
    starter: "SELECT *\nFROM commandes\nLIMIT 5;",
    solution: "SELECT id, date, montant FROM commandes WHERE categorie = 'Tech' AND montant > 100 ORDER BY montant DESC;",
    ordered: true,
  },
  "sql-group": {
    starter: "SELECT categorie, COUNT(*) AS nb\nFROM commandes\nGROUP BY categorie;",
    solution: "SELECT categorie, COUNT(*) AS nb, ROUND(SUM(montant), 2) AS ca FROM commandes GROUP BY categorie HAVING COUNT(*) >= 15;",
    ordered: false,
  },
  "sql-join": {
    starter: "SELECT c.prenom, o.id, o.montant\nFROM clients c\nJOIN commandes o ON o.client_id = c.id\nLIMIT 10;",
    solution:
      "SELECT c.prenom, COUNT(o.id) AS nb FROM clients c LEFT JOIN commandes o ON o.client_id = c.id GROUP BY c.id, c.prenom ORDER BY nb DESC, c.prenom;",
    ordered: true,
  },
  "sql-window": {
    starter: "SELECT c.ville, o.id, o.montant\nFROM commandes o\nJOIN clients c ON c.id = o.client_id\nORDER BY c.ville, o.montant DESC;",
    solution:
      "SELECT ville, id, montant FROM (SELECT c.ville, o.id, o.montant, ROW_NUMBER() OVER (PARTITION BY c.ville ORDER BY o.montant DESC) AS rang FROM commandes o JOIN clients c ON c.id = o.client_id) WHERE rang = 1;",
    ordered: false,
  },
};

export type SqlResult = { columns: string[]; values: (string | number | null)[][] };

const norm = (v: string | number | null) => (typeof v === "number" ? (Math.round(v * 100) / 100).toString() : String(v));

/** Même résultat ? Noms de colonnes ignorés, nombres arrondis au centime, ordre comparé seulement si demandé. */
export function sameResult(got: SqlResult | null, want: SqlResult, ordered: boolean) {
  if (!got || got.columns.length !== want.columns.length || got.values.length !== want.values.length) return false;
  const a = got.values.map((r) => r.map(norm).join("\u0001"));
  const b = want.values.map((r) => r.map(norm).join("\u0001"));
  if (!ordered) {
    a.sort();
    b.sort();
  }
  return a.every((x, i) => x === b[i]);
}
