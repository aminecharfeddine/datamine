"use client";

import { useMemo, useRef, useState } from "react";
import { histogram, makeDataset, metricsAt } from "@/lib/metrics";

const BINS = 24;

/** Le mini-labo de la page d'accueil : un seuil de décision qu'on déplace, et ses conséquences en direct. */
export function HeroLab() {
  const data = useMemo(() => makeDataset(2.4, 0.3, 300), []);
  const hist = useMemo(() => histogram(data, BINS), [data]);
  const [t, setT] = useState(0.5);
  const m = metricsAt(data, t);
  const svg = useRef<SVGSVGElement>(null);

  const W = 480, H = 190, M = { l: 8, r: 8, t: 10, b: 26 };
  const bw = (W - M.l - M.r) / BINS;
  const max = Math.max(...hist.pos, ...hist.neg);
  const y = (v: number) => ((H - M.b - M.t) * v) / max;
  const x = (s: number) => M.l + s * (W - M.l - M.r);

  const fromPointer = (clientX: number) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return;
    const s = ((clientX - r.left) / r.width) * W;
    setT(Math.min(0.98, Math.max(0.02, Math.round(((s - M.l) / (W - M.l - M.r)) * 100) / 100)));
  };

  const cell = (label: string, value: number, tone: string, hint: string) => (
    <div className="rounded-xl px-3 py-2" style={{ background: `color-mix(in srgb, ${tone} 13%, white)` }}>
      <div className="num text-2xl font-bold" style={{ color: tone }}>{value}</div>
      <div className="text-xs font-semibold text-ink">{label}</div>
      <div className="text-[11px] text-muted">{hint}</div>
    </div>
  );

  return (
    <figure className="m-0 rounded-[28px] border-2 border-line bg-surface p-5 shadow-[0_18px_50px_-30px_rgba(40,40,90,0.45)] sm:p-6">
      <figcaption className="mb-3">
        <span className="block font-display text-lg font-bold leading-tight">Un modèle note 300 transactions. Où places-tu le seuil d'alerte ?</span>
        <span className="mt-1 block text-sm text-muted">Glisse la ligne. En rouge, les fraudes ; en gris, les transactions légitimes.</span>
      </figcaption>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-ew-resize touch-none select-none"
        role="img"
        aria-label={`Seuil ${t.toFixed(2)} : ${m.tp} fraudes détectées, ${m.fn} ratées, ${m.fp} fausses alertes`}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && fromPointer(e.clientX)}
      >
        <rect x={x(t)} y={M.t} width={x(1) - x(t)} height={H - M.b - M.t} fill="var(--accent)" opacity={0.07} />
        {hist.neg.map((v, i) => (
          <rect key={`n${i}`} x={M.l + i * bw + 1} y={H - M.b - y(v)} width={bw - 2} height={y(v)} rx={2} fill="var(--neg)" opacity={0.75} />
        ))}
        {hist.pos.map((v, i) => (
          <rect key={`p${i}`} x={M.l + i * bw + 3} y={H - M.b - y(v)} width={bw - 6} height={y(v)} rx={2} fill="#e5484d" opacity={0.85} />
        ))}
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--line)" strokeWidth={2} />
        <text x={M.l} y={H - 8} fontSize={11} fill="var(--muted)">score 0 : sûrement légitime</text>
        <text x={W - M.r} y={H - 8} fontSize={11} textAnchor="end" fill="var(--muted)">score 1 : sûrement une fraude</text>
        <line x1={x(t)} x2={x(t)} y1={M.t - 4} y2={H - M.b} stroke="var(--accent)" strokeWidth={3} />
        <circle cx={x(t)} cy={M.t + 4} r={9} fill="var(--accent)" stroke="white" strokeWidth={3} />
        <text x={x(t) + 14} y={M.t + 8} fontSize={12} fontWeight={700} fill="var(--accent-deep)">alerte au-delà</text>
      </svg>
      <label className="sr-only" htmlFor="hero-seuil">Seuil d'alerte</label>
      <input id="hero-seuil" type="range" min={0.02} max={0.98} step={0.01} value={t} onChange={(e) => setT(Number(e.target.value))} className="mt-2 w-full" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cell("fraudes détectées", m.tp, "#067647", "vrais positifs")}
        {cell("fraudes ratées", m.fn, "#c4320a", "faux négatifs")}
        {cell("fausses alertes", m.fp, "#b54708", "faux positifs")}
        {cell("transactions tranquilles", m.tn, "#5d6283", "vrais négatifs")}
      </div>
      <p className="mt-3 text-sm">
        Precision <b className="num">{Math.round(m.precision * 100)} %</b>, recall <b className="num">{Math.round(m.recall * 100)} %</b>. Baisser le seuil attrape plus de fraudes, et réveille plus souvent l'équipe pour rien.
      </p>
    </figure>
  );
}
