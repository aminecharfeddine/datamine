"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { ASSET_A, ASSET_B, apply, det, eigen, isZero, minSdOnGrid, mix, W_GRID, type M2 } from "@/lib/maths2";
import { BEST_PROFIT, CAMPAIGN, TOTAL_RESPONDERS, compareModels, fairness, targeting, TARGET_SHARES, TEST_SIZES } from "@/lib/eval2";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Segmented, Slider } from "./controls";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace(".", ",")} %`;
const euros = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;

function Readout({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

// ============================================================ 1. Espérance et variance

/** Combiner deux sources aléatoires : l'espérance se mélange linéairement, le risque dépend de la corrélation. */
export function VarianceLab({ id = "variance", challenge }: { id?: string; challenge?: string }) {
  const [w, setW] = useState(1);
  const [rho, setRho] = useState(0.2);
  const m = mix(w, rho);
  const minSd = minSdOnGrid(rho);
  const solved = challenge ? CHALLENGES[challenge].check({ rho, sd: m.sd, minSd }) : false;

  const W = 520, H = 230, M = { l: 44, r: 12, t: 12, b: 34 };
  const x = scaleLinear().domain([0.05, 0.16]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([0.035, 0.065]).range([H - M.b, M.t]);
  const frontier = W_GRID.map((v) => mix(v, rho));

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">
        A rapporte {pct(ASSET_A.mean)} en moyenne avec un écart-type de {pct(ASSET_A.sd)} ; B rapporte {pct(ASSET_B.mean)} avec {pct(ASSET_B.sd)}. Le même calcul vaut pour la moyenne de deux modèles dont les erreurs sont corrélées.
      </p>
      <div className="mb-5 grid gap-5 sm:grid-cols-2">
        <Slider label="Part placée sur A (w)" value={w} min={0} max={1} step={0.05} onChange={setW} display={pct(w)} />
        <Slider label="Corrélation entre A et B (ρ)" value={rho} min={-1} max={1} step={0.1} onChange={(v) => setRho(Math.round(v * 10) / 10)} display={fmt(rho, 1)} />
      </div>
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Espérance ${pct(m.mean, 1)}, écart-type ${pct(m.sd, 1)}`}>
          {[0.04, 0.05, 0.06].map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
              <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{pct(v)}</text>
            </g>
          ))}
          {[0.06, 0.1, 0.14].map((v) => (
            <text key={v} x={x(v)} y={H - M.b + 15} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{pct(v)}</text>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 3} fontSize={11} textAnchor="middle" fill="var(--muted)">risque (écart-type)</text>
          <text x={12} y={(M.t + H - M.b) / 2} fontSize={11} textAnchor="middle" fill="var(--muted)" transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}>espérance</text>
          <path d={line<{ mean: number; sd: number }>().x((p) => x(p.sd)).y((p) => y(p.mean))(frontier) ?? ""} fill="none" stroke="var(--mod)" strokeWidth={2} opacity={0.5} />
          <circle cx={x(ASSET_A.sd)} cy={y(ASSET_A.mean)} r={5} fill="var(--ink)" />
          <text x={x(ASSET_A.sd) + 8} y={y(ASSET_A.mean) + 4} fontSize={12} fontWeight={700}>A</text>
          <circle cx={x(ASSET_B.sd)} cy={y(ASSET_B.mean)} r={5} fill="var(--ink)" />
          <text x={x(ASSET_B.sd) - 16} y={y(ASSET_B.mean) + 4} fontSize={12} fontWeight={700}>B</text>
          <circle cx={x(m.sd)} cy={y(m.mean)} r={8} fill="var(--mod)" stroke="var(--surface)" strokeWidth={2.5} />
        </svg>
        <div className="grid grid-cols-2 content-start gap-2">
          <Readout label="Espérance" value={pct(m.mean, 2)} />
          <Readout label="Écart-type" value={pct(m.sd, 2)} strong sub={m.sd <= minSd + 1e-9 ? "minimum pour ce ρ" : undefined} />
          <Readout label="Le moins risqué possible" value={pct(minSd, 2)} sub="pour ce ρ" />
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 2. Matrices

const PRESETS: { label: string; m: M2 }[] = [
  { label: "Identité", m: [1, 0, 0, 1] },
  { label: "Étirement", m: [2, 0, 0, 0.5] },
  { label: "Rotation 90°", m: [0, -1, 1, 0] },
  { label: "Cisaillement", m: [1, 1, 0, 1] },
  { label: "Symétrique", m: [2, 1, 1, 2] },
];

/** Une matrice 2 × 2 comme transformation du plan : ce qu'elle fait au carré unité, son déterminant, ses vecteurs propres. */
export function MatrixLab({ id = "matrice", challenge }: { id?: string; challenge?: string }) {
  const [m, setM] = useState<M2>([1, 0, 0, 1]);
  const set = (i: number, v: number) => setM((old) => old.map((x, j) => (j === i ? v : x)) as M2);
  const d = det(m);
  const e = eigen(m);
  const solved = challenge ? CHALLENGES[challenge].check({ det: d, zero: isZero(m) }) : false;

  const S = 300;
  const sc = scaleLinear().domain([-4, 4]).range([0, S]);
  const P = (p: [number, number]) => `${sc(p[0])},${sc(-p[1])}`;
  const sq: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const grid = useMemo(() => Array.from({ length: 9 }, (_, i) => i - 4), []);

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => setM(p.m)} className={clsx("rounded-xl border-2 px-3 py-1.5 text-sm font-semibold", m.join() === p.m.join() ? "border-mod bg-mod text-white" : "border-line bg-surface hover:border-mod")}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr] [&>*]:min-w-0">
        <svg viewBox={`0 0 ${S} ${S}`} className="w-full rounded-xl bg-paper" role="img" aria-label={`Déterminant ${fmt(d, 2)}`}>
          {grid.map((g) => (
            <g key={g}>
              <line x1={sc(-4)} x2={sc(4)} y1={sc(g)} y2={sc(g)} stroke="var(--line)" strokeWidth={g === 0 ? 1.5 : 0.6} />
              <line x1={sc(g)} x2={sc(g)} y1={sc(-4)} y2={sc(4)} stroke="var(--line)" strokeWidth={g === 0 ? 1.5 : 0.6} />
            </g>
          ))}
          {grid.map((g) => (
            <g key={`t${g}`} opacity={0.5}>
              <line x1={sc(apply(m, [-4, g])[0])} y1={sc(-apply(m, [-4, g])[1])} x2={sc(apply(m, [4, g])[0])} y2={sc(-apply(m, [4, g])[1])} stroke="var(--mod)" strokeWidth={0.7} />
              <line x1={sc(apply(m, [g, -4])[0])} y1={sc(-apply(m, [g, -4])[1])} x2={sc(apply(m, [g, 4])[0])} y2={sc(-apply(m, [g, 4])[1])} stroke="var(--mod)" strokeWidth={0.7} />
            </g>
          ))}
          <polygon points={sq.map(P).join(" ")} fill="var(--muted)" opacity={0.15} />
          <polygon points={sq.map((p) => P(apply(m, p))).join(" ")} fill="var(--mod)" opacity={0.3} stroke="var(--mod)" strokeWidth={2} />
          <line x1={sc(0)} y1={sc(0)} x2={sc(m[0])} y2={sc(-m[2])} stroke="#b45309" strokeWidth={3} />
          <line x1={sc(0)} y1={sc(0)} x2={sc(m[1])} y2={sc(-m[3])} stroke="#0f766e" strokeWidth={3} />
          {e.real &&
            e.vectors.map((v, i) => (
              <line key={i} x1={sc(-4 * v[0])} y1={sc(4 * v[1])} x2={sc(4 * v[0])} y2={sc(-4 * v[1])} stroke="var(--ink)" strokeDasharray="5 4" strokeWidth={1.4} />
            ))}
        </svg>
        <div>
          <div className="mb-2 text-sm font-semibold text-muted">Matrice</div>
          <div className="grid max-w-xs grid-cols-2 gap-x-5 gap-y-3">
            {(["a (x → x)", "b (y → x)", "c (x → y)", "d (y → y)"] as const).map((lab, i) => (
              <Slider key={lab} label={lab} value={m[i]} min={-2} max={2} step={0.5} onChange={(v) => set(i, v)} display={fmt(m[i], 1)} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Readout label="Déterminant (aire du carré)" value={fmt(d, 2)} strong />
            <Readout label="Valeurs propres" value={e.real ? e.values.map((v) => fmt(v, 2)).join(" ; ") : "complexes"} sub={e.real ? "pointillés : vecteurs propres" : "rotation : aucune direction conservée"} />
          </div>
          <p className="mt-3 text-sm text-muted">
            Orange : image de (1, 0), la première colonne. Vert : image de (0, 1), la seconde colonne. Le carré gris devient le parallélogramme coloré.
          </p>
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 3. Comparer deux modèles

/** Deux classifieurs évalués sur les mêmes exemples : test non apparié contre test apparié (McNemar). */
export function CompareLab({ id = "comparaison", challenge }: { id?: string; challenge?: string }) {
  const [ni, setNi] = useState(0);
  const n = TEST_SIZES[ni];
  const r = compareModels(n);
  const smaller = ni > 0 ? compareModels(TEST_SIZES[ni - 1]).paired.p : 1;
  const solved = challenge ? CHALLENGES[challenge].check({ n, pairedP: r.paired.p, unpairedP: r.unpaired.p, smallerPairedP: smaller }) : false;

  const W = 520, H = 120;
  const x = scaleLinear().domain([-0.12, 0.12]).range([20, W - 20]);
  const row = (label: string, ci: { lo: number; hi: number; p: number }, yy: number) => (
    <g>
      <text x={20} y={yy - 12} fontSize={12} fontWeight={700} fill="var(--ink)">{label}</text>
      <text x={W - 20} y={yy - 12} fontSize={12} textAnchor="end" fill={ci.p < 0.05 ? "#067647" : "var(--muted)"} className="num">
        p = {ci.p < 0.001 ? "< 0,001" : fmt(ci.p, 3)}
      </text>
      <line x1={x(Math.max(-0.12, ci.lo))} x2={x(Math.min(0.12, ci.hi))} y1={yy} y2={yy} stroke={ci.p < 0.05 ? "#067647" : "var(--muted)"} strokeWidth={6} strokeLinecap="round" />
      <circle cx={x(r.diff)} cy={yy} r={6} fill="var(--ink)" />
    </g>
  );

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 max-w-md">
        <Slider label="Taille du jeu de test" value={ni} min={0} max={TEST_SIZES.length - 1} step={1} onChange={setNi} display={`${n} exemples`} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Readout label="Accuracy A" value={pct(r.accA, 1)} />
        <Readout label="Accuracy B" value={pct(r.accB, 1)} />
        <Readout label="A juste, B faux" value={String(r.b)} />
        <Readout label="A faux, B juste" value={String(r.c)} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 w-full" role="img" aria-label={`Différence d'accuracy ${pct(r.diff, 1)}`}>
        <line x1={x(0)} x2={x(0)} y1={8} y2={H - 8} stroke="var(--line)" strokeWidth={2} />
        <text x={x(0) + 4} y={H - 4} fontSize={10} fill="var(--muted)">aucune différence</text>
        {row("Non apparié (deux échantillons indépendants)", r.unpaired, 40)}
        {row("Apparié (McNemar, désaccords seulement)", r.paired, 92)}
      </svg>
      <p className="mt-2 text-sm text-muted">Barres : intervalle de confiance à 95 % de la différence d'accuracy (B − A). En vert, l'intervalle exclut zéro.</p>
    </LabFrame>
  );
}

// ============================================================ 4. Gain et lift

/** Cibler une campagne avec un score : courbe de gain, lift, et profit selon la part de clients contactés. */
export function LiftLab({ id = "lift", challenge }: { id?: string; challenge?: string }) {
  const [si, setSi] = useState(9);
  const share = TARGET_SHARES[si];
  const t = targeting(share);
  const curve = useMemo(() => [{ s: 0, g: 0 }, ...TARGET_SHARES.map((s) => ({ s, g: targeting(s).gain }))], []);
  const profits = useMemo(() => TARGET_SHARES.map((s) => targeting(s).profit), []);
  const solved = challenge ? CHALLENGES[challenge].check({ profit: t.profit, best: BEST_PROFIT }) : false;

  const W = 300, H = 240, M = { l: 34, r: 10, t: 10, b: 30 };
  const x = scaleLinear().domain([0, 1]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([0, 1]).range([H - M.b, M.t]);
  const py = scaleLinear().domain([Math.min(0, ...profits), Math.max(...profits)]).range([H - M.b, M.t]);

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">
        {CAMPAIGN.n.toLocaleString("fr-FR")} clients, environ 3 % répondent à l'offre. Un contact coûte {CAMPAIGN.contactCost} €, une réponse rapporte {CAMPAIGN.responseValue} €. On contacte les clients les mieux notés par le modèle.
      </p>
      <div className="mb-5 max-w-md">
        <Slider label="Part des clients contactés" value={si} min={0} max={TARGET_SHARES.length - 1} step={1} onChange={setSi} display={pct(share)} />
      </div>
      <div className="grid gap-5 md:grid-cols-2 [&>*]:min-w-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Gain cumulé ${pct(t.gain)}`}>
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
              <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{pct(v)}</text>
            </g>
          ))}
          <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--muted)" strokeDasharray="5 4" />
          <path d={line<{ s: number; g: number }>().x((p) => x(p.s)).y((p) => y(p.g))(curve) ?? ""} fill="none" stroke="var(--mod)" strokeWidth={2.5} />
          <circle cx={x(share)} cy={y(t.gain)} r={6} fill="var(--mod)" stroke="var(--surface)" strokeWidth={2} />
          <text x={(M.l + W - M.r) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">clients contactés</text>
          <text x={M.l + 4} y={M.t + 12} fontSize={11} fill="var(--muted)">répondants captés</text>
        </svg>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Profit ${euros(t.profit)}`}>
          <line x1={M.l} x2={W - M.r} y1={py(0)} y2={py(0)} stroke="var(--line)" />
          {profits.map((p, i) => (
            <rect key={i} x={x(TARGET_SHARES[i]) - 5} y={Math.min(py(p), py(0))} width={10} height={Math.abs(py(p) - py(0))} rx={2} fill={i === si ? "var(--mod)" : "var(--neg)"} />
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">profit selon la part contactée</text>
        </svg>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Readout label="Répondants captés (gain)" value={pct(t.gain)} sub={`${t.caught} sur ${TOTAL_RESPONDERS}`} />
        <Readout label="Lift" value={`× ${fmt(t.lift, 1)}`} sub="vs un ciblage au hasard" />
        <Readout label="Taux de réponse" value={pct(t.rate, 1)} />
        <Readout label="Profit" value={euros(t.profit)} strong />
      </div>
    </LabFrame>
  );
}

// ============================================================ 5. Équité

/** Un seuil commun ou un seuil par groupe : selection rate, recall et precision par groupe. */
export function FairnessLab({ id = "equite", challenge }: { id?: string; challenge?: string }) {
  const [mode, setMode] = useState<"single" | "group">("single");
  const [tA, setTA] = useState(0.5);
  const [tB, setTB] = useState(0.5);
  const thrB = mode === "single" ? tA : tB;
  const f = fairness(tA, thrB);
  const solved = challenge ? CHALLENGES[challenge].check({ tprGap: f.tprGap, minTpr: Math.min(f.a.tpr, f.b.tpr), precision: f.precision }) : false;

  const Row = ({ label, a, b }: { label: string; a: number; b: number }) => (
    <tr className="border-t border-line">
      <td className="py-2 pr-3">{label}</td>
      <td className="num">{pct(a, 1)}</td>
      <td className="num">{pct(b, 1)}</td>
      <td className="num text-muted">{(Math.abs(a - b) * 100).toFixed(1).replace(".", ",")} pts</td>
    </tr>
  );

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">
        Un modèle présélectionne des candidats. Groupe A : 60 % des candidats. Groupe B : 40 %, moins représenté dans les données d'entraînement, et le modèle le note moins bien.
      </p>
      <div className="mb-5 grid gap-5 sm:grid-cols-3 [&>*]:min-w-0">
        <Segmented label="Seuils" value={mode} onChange={setMode} options={[{ value: "single", label: "Un seuil commun" }, { value: "group", label: "Un seuil par groupe" }]} />
        <Slider label={mode === "single" ? "Seuil" : "Seuil du groupe A"} value={tA} min={0.1} max={0.9} step={0.01} onChange={setTA} display={fmt(tA, 2)} />
        {mode === "group" && <Slider label="Seuil du groupe B" value={tB} min={0.1} max={0.9} step={0.01} onChange={setTB} display={fmt(tB, 2)} />}
      </div>
      <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] [&>*]:min-w-0">
        <div className="overflow-x-auto" tabIndex={0}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1.5 font-semibold">Mesure</th>
                <th className="font-semibold">Groupe A</th>
                <th className="font-semibold">Groupe B</th>
                <th className="font-semibold">Écart</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Taux de sélection" a={f.a.selectionRate} b={f.b.selectionRate} />
              <Row label="Recall (bons candidats retenus)" a={f.a.tpr} b={f.b.tpr} />
              <Row label="Precision (retenus vraiment bons)" a={f.a.precision} b={f.b.precision} />
              <Row label="Part de bons candidats" a={f.a.baseRate} b={f.b.baseRate} />
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 content-start gap-2">
          <Readout label="Écart de recall" value={`${(f.tprGap * 100).toFixed(1).replace(".", ",")} pts`} strong sub="égalité des chances" />
          <Readout label="Precision globale" value={pct(f.precision, 1)} />
          <Readout label="Ratio des taux de sélection" value={fmt(f.selectionRatio, 2)} sub="règle des 4/5 : ≥ 0,8" />
          <Readout label="Recall global" value={pct(f.recall, 1)} />
        </div>
      </div>
    </LabFrame>
  );
}
