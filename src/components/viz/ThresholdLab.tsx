"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { auc, histogram, makeDataset, metricsAt, prCurve, rocCurve, type Metrics } from "@/lib/metrics";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Slider } from "./controls";

type Panel = "dist" | "matrix" | "metrics" | "roc" | "pr";
type Control = "threshold" | "separation" | "prevalence";

const fmt = (v: number) => v.toFixed(2).replace(".", ",");
const pct = (v: number) => `${Math.round(v * 100)} %`;

/**
 * Laboratoire du seuil : un modèle fictif produit des scores, l'apprenant déplace le seuil
 * et voit en direct la confusion matrix, les métriques et les courbes ROC / PR.
 */
export function ThresholdLab({
  id = "lab",
  panels = ["dist", "matrix", "metrics"],
  controls = ["threshold"],
  threshold: t0 = 0.5,
  separation: s0 = 2,
  prevalence: p0 = 0.4,
  challenge,
}: {
  id?: string;
  panels?: Panel[];
  controls?: Control[];
  threshold?: number;
  separation?: number;
  prevalence?: number;
  challenge?: string;
}) {
  const [threshold, setThreshold] = useState(t0);
  const [separation, setSeparation] = useState(s0);
  const [prevalence, setPrevalence] = useState(p0);

  const data = useMemo(() => makeDataset(separation, prevalence), [separation, prevalence]);
  const metrics = useMemo(() => metricsAt(data, threshold), [data, threshold]);
  const roc = useMemo(() => rocCurve(data), [data]);
  const rocAuc = useMemo(() => auc(roc), [roc]);
  const pr = useMemo(() => (panels.includes("pr") ? prCurve(data) : []), [data, panels]);

  const ch = challenge ? CHALLENGES[challenge] : undefined;
  const solved = ch ? ch.check({ data, threshold, separation, prevalence, metrics, rocAuc }) : false;

  const reset = () => {
    setThreshold(t0);
    setSeparation(s0);
    setPrevalence(p0);
  };

  return (
    <LabFrame>
      {ch && <ChallengeBanner labId={id} challengeId={ch.id} solved={solved} />}

      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {controls.includes("threshold") && (
          <Slider label="Seuil de décision" value={threshold} min={0} max={1} step={0.01} onChange={setThreshold} display={fmt(threshold)} />
        )}
        {controls.includes("separation") && (
          <Slider
            label="Qualité du modèle (séparation)"
            value={separation}
            min={0}
            max={4}
            step={0.05}
            onChange={setSeparation}
            display={separation < 0.5 ? "≈ hasard" : separation < 1.5 ? "faible" : separation < 2.8 ? "correct" : "excellent"}
          />
        )}
        {controls.includes("prevalence") && (
          <Slider
            label="Prévalence (part de positifs)"
            value={prevalence}
            min={0.02}
            max={0.5}
            step={0.01}
            onChange={setPrevalence}
            display={pct(prevalence)}
          />
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {panels.includes("dist") && (
          <div className="lg:col-span-2">
            <ScoreHistogram data={data} threshold={threshold} onThreshold={setThreshold} />
          </div>
        )}
        {panels.includes("matrix") && <ConfusionGrid m={metrics} />}
        {panels.includes("metrics") && <MetricBars m={metrics} />}
        {panels.includes("roc") && (
          <CurveChart
            title="ROC curve"
            xLabel="False Positive Rate"
            yLabel="True Positive Rate (recall)"
            points={roc}
            current={{ x: metrics.fpr, y: metrics.recall }}
            baseline="diagonal"
            badge={`AUC ${fmt(rocAuc)}`}
          />
        )}
        {panels.includes("pr") && (
          <CurveChart
            title="Precision-Recall curve"
            xLabel="Recall"
            yLabel="Precision"
            points={pr}
            current={{ x: metrics.recall, y: metrics.precision }}
            baseline={prevalence}
            badge={`AP ≈ ${fmt(auc(pr))}`}
          />
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <button onClick={reset} className="btn-ghost px-3 py-1.5 text-xs">
          Réinitialiser
        </button>
      </div>
    </LabFrame>
  );
}

// ---------------------------------------------------------------- Contrôles

// ---------------------------------------------------------------- Histogramme miroir

function ScoreHistogram({
  data,
  threshold,
  onThreshold,
}: {
  data: ReturnType<typeof makeDataset>;
  threshold: number;
  onThreshold: (t: number) => void;
}) {
  const W = 720, H = 260, M = { l: 12, r: 12, t: 26, b: 30 };
  const { pos, neg, bins } = useMemo(() => histogram(data, 30), [data]);
  const max = Math.max(4, ...pos, ...neg);
  const x = scaleLinear().domain([0, 1]).range([M.l, W - M.r]);
  const mid = M.t + (H - M.t - M.b) / 2;
  const y = scaleLinear().domain([0, max]).range([0, (H - M.t - M.b) / 2 - 4]);
  const bw = (W - M.l - M.r) / bins;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const [hover, setHover] = useState<{ i: number; cls: "pos" | "neg" } | null>(null);

  const toThreshold = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    onThreshold(Math.round(Math.min(1, Math.max(0, x.invert(vx))) * 100) / 100);
  };

  const tx = x(threshold);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-lg">Scores du modèle</h4>
        <Legend />
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`Histogramme des scores. Seuil à ${fmt(threshold)}. Glisser pour le déplacer.`}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          toThreshold(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && toThreshold(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => setHover(null)}
      >
        {/* zone « prédit positif » */}
        <rect x={tx} y={M.t - 18} width={W - M.r - tx} height={H - M.t - M.b + 18} fill="var(--ink)" opacity={0.035} />
        <text x={tx + 8} y={M.t - 6} fontSize={11} fill="var(--muted)">
          prédit positif →
        </text>
        <text x={tx - 8} y={M.t - 6} fontSize={11} fill="var(--muted)" textAnchor="end">
          ← prédit négatif
        </text>

        {pos.map((c, i) => {
          const center = (i + 0.5) / bins;
          const fill = center >= threshold ? "var(--pos)" : "var(--fn)";
          const h = y(c);
          return (
            <rect
              key={`p${i}`}
              x={M.l + i * bw + 1}
              y={mid - h - 1}
              width={bw - 2}
              height={h}
              rx={Math.min(3, h / 2)}
              fill={fill}
              opacity={hover && !(hover.i === i && hover.cls === "pos") ? 0.55 : 1}
              onPointerEnter={() => setHover({ i, cls: "pos" })}
            />
          );
        })}
        {neg.map((c, i) => {
          const center = (i + 0.5) / bins;
          const fill = center >= threshold ? "var(--fp)" : "var(--neg)";
          const h = y(c);
          return (
            <rect
              key={`n${i}`}
              x={M.l + i * bw + 1}
              y={mid + 1}
              width={bw - 2}
              height={h}
              rx={Math.min(3, h / 2)}
              fill={fill}
              opacity={hover && !(hover.i === i && hover.cls === "neg") ? 0.55 : 1}
              onPointerEnter={() => setHover({ i, cls: "neg" })}
            />
          );
        })}

        <line x1={M.l} x2={W - M.r} y1={mid} y2={mid} stroke="var(--line)" />
        <text x={M.l} y={M.t + 10} fontSize={11} fill="var(--muted)">
          positifs réels ↑
        </text>
        <text x={M.l} y={H - M.b - 4} fontSize={11} fill="var(--muted)">
          négatifs réels ↓
        </text>

        {/* axe des scores */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text key={v} x={x(v)} y={H - 8} fontSize={11} fill="var(--muted)" textAnchor={v === 0 ? "start" : v === 1 ? "end" : "middle"} className="num">
            {fmt(v)}
          </text>
        ))}

        {/* seuil draggable */}
        <line x1={tx} x2={tx} y1={M.t - 18} y2={H - M.b} stroke="var(--ink)" strokeWidth={2} />
        <g transform={`translate(${tx},${H - M.b})`} style={{ cursor: "ew-resize" }}>
          <rect x={-22} y={2} width={44} height={18} rx={9} fill="var(--ink)" />
          <text y={15} fontSize={11} fill="var(--paper)" textAnchor="middle" className="num" fontWeight={600}>
            {fmt(threshold)}
          </text>
        </g>

        {hover && (() => {
          const count = hover.cls === "pos" ? pos[hover.i] : neg[hover.i];
          const lo = hover.i / bins, hi = (hover.i + 1) / bins;
          const label = `${count} ${hover.cls === "pos" ? "positif" : "négatif"}${count > 1 ? "s" : ""} · score ${fmt(lo)}–${fmt(hi)}`;
          const bx = Math.min(W - 190, Math.max(4, M.l + hover.i * bw - 80));
          return (
            <g pointerEvents="none">
              <rect x={bx} y={hover.cls === "pos" ? M.t + 16 : mid + 12} width={186} height={22} rx={5} fill="var(--surface)" stroke="var(--line)" />
              <text x={bx + 8} y={(hover.cls === "pos" ? M.t + 16 : mid + 12) + 15} fontSize={11} fill="var(--ink)">
                {label}
              </text>
            </g>
          );
        })()}
      </svg>
      <p className="mt-1 text-xs text-muted">Glisse la ligne (ou utilise le curseur). Chaque barre prend la couleur de son issue.</p>
    </div>
  );
}

function Legend() {
  const items = [
    ["var(--pos)", "TP"],
    ["var(--fn)", "FN"],
    ["var(--fp)", "FP"],
    ["var(--neg)", "TN"],
  ] as const;
  return (
    <div className="flex gap-3 text-xs text-muted">
      {items.map(([c, l]) => (
        <span key={l} className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Confusion matrix

function ConfusionGrid({ m }: { m: Metrics }) {
  const cell = (label: string, name: string, v: number, color: string) => (
    <div className="relative overflow-hidden rounded-lg border border-line bg-paper p-3 sm:p-4">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />
        <span className="font-semibold text-ink">{label}</span>
        <span className="hidden sm:inline">· {name}</span>
      </div>
      <div className="num mt-1 text-3xl font-semibold">{v}</div>
    </div>
  );
  return (
    <div>
      <h4 className="mb-3 font-display text-lg">Confusion matrix</h4>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-sm">
        <div />
        <div className="pb-1 text-center text-xs text-muted">prédit positif</div>
        <div className="pb-1 text-center text-xs text-muted">prédit négatif</div>
        <div className="flex items-center pr-2 text-xs text-muted [writing-mode:vertical-rl] rotate-180 justify-center">réel +</div>
        {cell("TP", "true positive", m.tp, "var(--pos)")}
        {cell("FN", "false negative", m.fn, "var(--fn)")}
        <div className="flex items-center pr-2 text-xs text-muted [writing-mode:vertical-rl] rotate-180 justify-center">réel −</div>
        {cell("FP", "false positive", m.fp, "var(--fp)")}
        {cell("TN", "true negative", m.tn, "var(--neg)")}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Barres de métriques

function MetricBars({ m }: { m: Metrics }) {
  const rows: [string, number, React.ReactNode][] = [
    ["Precision", m.precision, <>TP / (TP + FP)</>],
    ["Recall", m.recall, <>TP / (TP + FN)</>],
    ["F1-score", m.f1, <>moyenne harmonique</>],
    ["Accuracy", m.accuracy, <>(TP + TN) / total</>],
  ];
  return (
    <div>
      <h4 className="mb-3 font-display text-lg">Métriques</h4>
      <div className="space-y-3.5">
        {rows.map(([name, v, formula]) => (
          <div key={name}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span>
                <span className="font-semibold">{name}</span>
                <span className="num ml-2 text-xs text-muted">{formula}</span>
              </span>
              <span className="num font-semibold">{fmt(v)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-sunken">
              <div
                className={clsx("h-full rounded-full transition-[width] duration-150", name === "Accuracy" ? "bg-neg" : "bg-mod")}
                style={{ width: `${v * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Courbes ROC / PR

function CurveChart({
  title,
  xLabel,
  yLabel,
  points,
  current,
  baseline,
  badge,
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  points: { x: number; y: number }[];
  current: { x: number; y: number };
  baseline: "diagonal" | number;
  badge: string;
}) {
  const S = 300, M = { l: 40, r: 12, t: 12, b: 40 };
  const x = scaleLinear().domain([0, 1]).range([M.l, S - M.r]);
  const y = scaleLinear().domain([0, 1]).range([S - M.b, M.t]);
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const path = line<{ x: number; y: number }>()
    .x((d) => x(d.x))
    .y((d) => y(d.y))(sorted) ?? "";

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="font-display text-lg">{title}</h4>
        <span className="num rounded-full bg-sunken px-2.5 py-0.5 text-xs font-semibold">{badge}</span>
      </div>
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[380px]" role="img" aria-label={`${title}, point courant x ${fmt(current.x)}, y ${fmt(current.y)}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={x(0)} x2={x(1)} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">
              {fmt(v)}
            </text>
            <text x={x(v)} y={S - M.b + 16} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">
              {fmt(v)}
            </text>
          </g>
        ))}
        {baseline === "diagonal" ? (
          <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--muted)" strokeDasharray="4 4" />
        ) : (
          <line x1={x(0)} y1={y(baseline)} x2={x(1)} y2={y(baseline)} stroke="var(--muted)" strokeDasharray="4 4" />
        )}
        <text
          x={x(0.98)}
          y={baseline === "diagonal" ? y(0.9) : y(baseline) - 6}
          fontSize={10}
          textAnchor="end"
          fill="var(--muted)"
        >
          {baseline === "diagonal" ? "hasard" : `hasard (prévalence ${fmt(baseline)})`}
        </text>
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
        <circle cx={x(current.x)} cy={y(current.y)} r={7} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        <text x={(M.l + S - M.r) / 2} y={S - 6} fontSize={11} textAnchor="middle" fill="var(--muted)">
          {xLabel}
        </text>
        <text transform={`translate(11, ${(M.t + S - M.b) / 2}) rotate(-90)`} fontSize={11} textAnchor="middle" fill="var(--muted)">
          {yLabel}
        </text>
      </svg>
      <p className="mt-1 text-center text-xs text-muted">
        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle" />
        ton seuil actuel
      </p>
    </div>
  );
}
