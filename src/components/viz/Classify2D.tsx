"use client";

import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { MOON_DOMAIN, type P2 } from "@/lib/ml";

// Composants partagés des labos de classification 2D (k-NN, arbres).
// Classe 0 = bleu, classe 1 = orange : paire validée pour le daltonisme, et toujours rappelée en légende.

export const CLASS_COLORS = ["var(--fn)", "var(--fp)"] as const;

type Domain = { x: [number, number]; y: [number, number] };

/** Segment visible de la droite a·x + b·y + c = 0 dans le domaine, ou null. */
function clipLine(a: number, b: number, c: number, d: Domain): [number, number, number, number] | null {
  const pts: [number, number][] = [];
  if (Math.abs(b) > 1e-12) for (const x of d.x) { const y = -(a * x + c) / b; if (y >= d.y[0] && y <= d.y[1]) pts.push([x, y]); }
  if (Math.abs(a) > 1e-12) for (const y of d.y) { const x = -(b * y + c) / a; if (x >= d.x[0] && x <= d.x[1]) pts.push([x, y]); }
  return pts.length >= 2 ? [pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]] : null;
}

export function DecisionMap({
  predict,
  cols,
  rows,
  points,
  title,
  domain = MOON_DOMAIN,
  lines = [],
}: {
  predict: (0 | 1)[];
  cols: number;
  rows: number;
  points: P2[];
  title: string;
  domain?: Domain;
  /** Droites a·x + b·y + c = 0 à superposer (ex. un neurone caché chacune). */
  lines?: [number, number, number][];
}) {
  const W = 480, H = Math.round((W * (domain.y[1] - domain.y[0])) / (domain.x[1] - domain.x[0]));
  const x = scaleLinear().domain(domain.x).range([0, W]);
  const y = scaleLinear().domain(domain.y).range([H, 0]);
  const cw = W / cols, ch = H / rows;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-fn" /> classe A</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-fp" /> classe B</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-hidden rounded-xl border border-line" role="img" aria-label={`${title} : régions de décision et ${points.length} points d'entraînement`}>
        {predict.map((c, idx) => (
          <rect
            key={idx}
            x={(idx % cols) * cw}
            y={Math.floor(idx / cols) * ch}
            width={cw + 0.5}
            height={ch + 0.5}
            fill={CLASS_COLORS[c]}
            opacity={0.16}
          />
        ))}
        {lines.map(([a, b, c], i) => {
          const seg = clipLine(a, b, c, domain);
          return seg ? <line key={`l${i}`} x1={x(seg[0])} y1={y(seg[1])} x2={x(seg[2])} y2={y(seg[3])} stroke="var(--ink)" strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="5 4" /> : null;
        })}
        {points.map((p, i) => (
          <circle key={i} cx={x(p.x)} cy={y(p.y)} r={4.2} fill={CLASS_COLORS[p.c]} stroke="white" strokeWidth={1.4} />
        ))}
      </svg>
    </div>
  );
}

/** Précision d'entraînement et de test en fonction d'un hyperparamètre. */
export function AccCurve({
  xs,
  train,
  test,
  current,
  xLabel,
  title,
  leftNote,
  rightNote,
}: {
  xs: number[];
  train: number[];
  test: number[];
  current: number;
  xLabel: string;
  title: string;
  leftNote: string;
  rightNote: string;
}) {
  const W = 420, H = 260, M = { l: 40, r: 12, t: 16, b: 36 };
  const x = scaleLinear().domain([xs[0], xs[xs.length - 1]]).range([M.l, W - M.r]);
  const lo = Math.max(0, Math.floor(Math.min(...train, ...test) * 10) / 10 - 0.05);
  const y = scaleLinear().domain([lo, 1]).range([H - M.b, M.t]);
  const mk = (vals: number[]) => line<number>().x((_, i) => x(xs[i])).y((v) => y(v))(vals) ?? "";
  const ci = xs.indexOf(current);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-ink" /> entraînement</span>
          <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-mod" /> test</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}. Valeur actuelle ${current}.`}>
        {y.ticks(5).map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{Math.round(v * 100)}%</text>
          </g>
        ))}
        {x.ticks(6).map((v) => (
          <text key={v} x={x(v)} y={H - M.b + 16} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{v}</text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">{xLabel}</text>
        <text x={M.l + 4} y={H - M.b - 6} fontSize={10} fill="var(--muted)">{leftNote}</text>
        <text x={W - M.r - 4} y={H - M.b - 6} fontSize={10} textAnchor="end" fill="var(--muted)">{rightNote}</text>
        <path d={mk(train)} fill="none" stroke="var(--ink)" strokeWidth={2} />
        <path d={mk(test)} fill="none" stroke="var(--mod)" strokeWidth={2.5} />
        {ci >= 0 && (
          <>
            <line x1={x(current)} x2={x(current)} y1={M.t} y2={H - M.b} stroke="var(--mod)" strokeDasharray="4 3" />
            <circle cx={x(current)} cy={y(train[ci])} r={5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
            <circle cx={x(current)} cy={y(test[ci])} r={6} fill="var(--mod)" stroke="var(--surface)" strokeWidth={2} />
          </>
        )}
      </svg>
    </div>
  );
}

export function AccReadouts({ train, test }: { train: number; test: number }) {
  const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-line bg-paper p-3">
        <div className="text-xs font-semibold text-muted">Précision d'entraînement</div>
        <div className="num mt-0.5 text-xl font-bold">{pct(train)}</div>
      </div>
      <div className="rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--mod) 10%, white)" }}>
        <div className="text-xs font-semibold text-muted">Précision de test</div>
        <div className="num mt-0.5 text-xl font-bold">{pct(test)}</div>
      </div>
    </div>
  );
}
