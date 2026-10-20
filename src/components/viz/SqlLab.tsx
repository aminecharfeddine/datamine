"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Play } from "lucide-react";
import type { Database, SqlJsStatic } from "sql.js";
import { shopSql } from "@/lib/practice";
import { sameResult, SQL_EXERCISES, type SqlResult } from "@/lib/sqlExercises";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { Highlighted } from "@/components/code/Code";
import { LabButton, LabFrame } from "./controls";

// Un seul chargement du moteur SQLite (WebAssembly) par page ; une base neuve par labo.
let engine: Promise<SqlJsStatic> | null = null;
function loadEngine() {
  engine ??= import("sql.js").then((m) => m.default({ locateFile: () => "/sql-wasm.wasm" }));
  return engine;
}

const SCHEMA = [
  { table: "clients", cols: ["id", "prenom", "ville", "age", "inscription"] },
  { table: "commandes", cols: ["id", "client_id", "date", "categorie", "montant"] },
];

function exec(db: Database, q: string): SqlResult {
  const r = db.exec(q);
  const last = r.at(-1);
  return last ? { columns: last.columns, values: last.values as SqlResult["values"] } : { columns: [], values: [] };
}

/** Un vrai SQLite dans le navigateur, avec les tables de la boutique. Ctrl + Entrée pour exécuter. */
export function SqlLab({ id = "sql", challenge, starter }: { id?: string; challenge?: string; starter?: string }) {
  const ex = challenge ? SQL_EXERCISES[challenge] : undefined;
  const [query, setQuery] = useState(starter ?? ex?.starter ?? "SELECT * FROM clients LIMIT 5;");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tries, setTries] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [match, setMatch] = useState(false);
  const db = useRef<Database | null>(null);
  const expected = useRef<SqlResult | null>(null);

  useEffect(() => {
    let alive = true;
    loadEngine().then((SQL) => {
      if (!alive) return;
      const d = new SQL.Database();
      d.run(shopSql());
      db.current = d;
      if (ex) expected.current = exec(d, ex.solution);
      setReady(true);
    });
    return () => {
      alive = false;
      db.current?.close();
    };
  }, [ex]);

  const run = () => {
    if (!db.current) return;
    try {
      const r = exec(db.current, query);
      setResult(r);
      setError(null);
      if (ex && expected.current) {
        const ok = sameResult(r, expected.current, ex.ordered);
        setMatch(ok);
        if (!ok) setTries((t) => t + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
      setMatch(false);
      setTries((t) => t + 1);
    }
  };

  const solved = challenge ? CHALLENGES[challenge].check({ match }) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {SCHEMA.map((t) => (
          <span key={t.table} className="rounded-lg bg-paper px-2.5 py-1.5 font-mono">
            <b>{t.table}</b>({t.cols.join(", ")})
          </span>
        ))}
      </div>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            run();
          }
        }}
        spellCheck={false}
        rows={Math.max(4, query.split("\n").length + 1)}
        aria-label="Requête SQL"
        className="w-full rounded-2xl border-0 bg-[#171a2e] px-4 py-3 font-mono text-[0.86rem] leading-relaxed text-[#eef0fb] outline-none ring-2 ring-transparent focus:ring-mod"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <LabButton primary onClick={run} disabled={!ready}>
          <span className="flex items-center gap-1.5">
            <Play size={14} fill="currentColor" /> {ready ? "Exécuter" : "Chargement de SQLite…"}
          </span>
        </LabButton>
        <span className="text-xs text-muted">Ctrl + Entrée</span>
        {ex && result && !error && (
          <span className={clsx("text-sm font-semibold", match ? "text-good" : "text-muted")}>
            {match ? "Résultat identique à celui attendu." : "Pas encore le résultat attendu."}
          </span>
        )}
        {ex && tries >= 3 && !match && !showSolution && (
          <button onClick={() => setShowSolution(true)} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
            Voir une solution
          </button>
        )}
      </div>
      {showSolution && ex && (
        <pre className="mt-3 overflow-x-auto rounded-2xl bg-[#171a2e] px-4 py-3" tabIndex={0}>
          <Highlighted code={ex.solution.replace(/ (FROM|WHERE|GROUP BY|HAVING|ORDER BY|LEFT JOIN|JOIN|LIMIT) /g, "\n$1 ")} />
        </pre>
      )}
      {error && <p className="mt-3 rounded-xl bg-[#fff4ed] px-4 py-3 font-mono text-xs text-[#9c2a10]">{error}</p>}
      {result && (
        <div className="mt-4 max-h-80 overflow-auto rounded-2xl border border-line" tabIndex={0}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-paper text-left text-xs text-muted">
              <tr>{result.columns.map((c, i) => <th key={i} className="px-3 py-2 font-semibold">{c}</th>)}</tr>
            </thead>
            <tbody>
              {result.values.slice(0, 50).map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((v, j) => (
                    <td key={j} className={clsx("px-3 py-1.5", typeof v === "number" && "num text-right")}>
                      {v === null ? <span className="text-muted">NULL</span> : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
              {!result.values.length && (
                <tr><td className="px-3 py-3 text-muted">Aucune ligne.</td></tr>
              )}
            </tbody>
          </table>
          {result.values.length > 50 && <p className="border-t border-line px-3 py-2 text-xs text-muted">{result.values.length} lignes, 50 affichées.</p>}
        </div>
      )}
    </LabFrame>
  );
}
