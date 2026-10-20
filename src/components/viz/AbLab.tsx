"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import { AB_BASE, normalPdf, runAb, type AbResult } from "@/lib/sims";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabButton, LabFrame, Segmented, Slider } from "./controls";

const pts = (v: number, d = 1) => `${(v * 100).toFixed(d).replace(".", ",").replace("-", "−")} pts`;
const fmtP = (p: number) => (p < 0.001 ? "< 0,001" : p.toFixed(3).replace(".", ","));

type Control = "n" | "effect";
const EFFECTS = ["0", "0.01", "0.02", "0.05"] as const;

/**
 * Test A/B : la version A convertit 10 % des visiteurs ; la version B a un effet réel réglable.
 * Chaque expérience compare les deux et calcule une p-value. On voit la distribution sous H0,
 * la différence observée, et la part d'expériences « significatives » (faux positifs ou puissance).
 */
export function AbLab({
  id = "ab",
  n: n0 = 1000,
  effect: e0 = 0,
  controls = ["n", "effect"],
  challenge,
}: {
  id?: string;
  n?: number;
  effect?: number;
  controls?: Control[];
  challenge?: string;
}) {
  const [n, setN] = useState(n0);
  const [effect, setEffect] = useState(e0);
  const [runs, setRuns] = useState<AbResult[]>([]);
  const last = runs[runs.length - 1];
  const significant = runs.filter((r) => r.p < 0.05).length;

  const reset = () => setRuns([]);
  const run = (k: number) => {
    const out: AbResult[] = [];
    for (let i = 0; i < k; i++) out.push(runAb(n, AB_BASE, AB_BASE + effect, Math.random));
    setRuns((r) => [...r, ...out].slice(-400));
  };

  const solved = challenge ? CHALLENGES[challenge].check({ n, effect, runs: runs.length, significant }) : false;

  // Distribution de la différence sous H0 (aucun effet) : N(0, se0)
  const se0 = Math.sqrt((AB_BASE * (1 - AB_BASE) * 2) / n);
  const span = Math.max(4 * se0, Math.abs(effect) * 1.6, last ? Math.abs(last.diff) * 1.2 : 0, 0.01);
  const W = 640, H = 220, M = { l: 12, r: 12, t: 16, b: 34 };
  const x = scaleLinear().domain([-span, span]).range([M.l, W - M.r]);
  const peak = normalPdf(0, 0, se0);
  const y = scaleLinear().domain([0, peak * 1.12]).range([H - M.b, M.t]);
  const xs = useMemo(() => Array.from({ length: 241 }, (_, i) => -span + (2 * span * i) / 240), [span]);
  const curve = line<number>().x((v) => x(v)).y((v) => y(normalPdf(v, 0, se0)))(xs) ?? "";
  const thr = last ? Math.abs(last.diff) : Infinity;
  const tailArea = (side: 1 | -1) =>
    area<number>()
      .x((v) => x(v))
      .y0(y(0))
      .y1((v) => y(normalPdf(v, 0, se0)))(xs.filter((v) => side * v >= thr)) ?? "";

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}

      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {controls.includes("n") && (
          <Slider
            label="Visiteurs par version"
            value={n}
            min={100}
            max={6000}
            step={100}
            onChange={(v) => {
              setN(v);
              reset();
            }}
            display={v2s(n)}
          />
        )}
        {controls.includes("effect") && (
          <Segmented
            label="Effet réel de la version B"
            value={String(effect) as (typeof EFFECTS)[number]}
            options={EFFECTS.map((e) => ({ value: e, label: e === "0" ? "Aucun" : `+${Number(e) * 100} pts` }))}
            onChange={(v) => {
              setEffect(Number(v));
              reset();
            }}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <h3 className="font-display text-lg font-bold">Ce qu'on observerait si B ne changeait rien</h3>
          <p className="mb-2 text-sm text-muted">Distribution de l'écart B − A sous l'hypothèse nulle H₀</p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Distribution sous H0. ${last ? `Écart observé ${pts(last.diff)}, p-value ${fmtP(last.p)}` : "Aucune expérience lancée"}`}>
            <path d={curve} fill="none" stroke="var(--ink)" strokeWidth={2} />
            {last && (
              <>
                <path d={tailArea(1)} fill="var(--fp)" opacity={0.75} />
                <path d={tailArea(-1)} fill="var(--fp)" opacity={0.75} />
                <line x1={x(last.diff)} x2={x(last.diff)} y1={M.t} y2={H - M.b} stroke="var(--mod)" strokeWidth={3} />
                <text
                  x={x(last.diff) + (last.diff >= 0 ? 6 : -6)}
                  y={M.t + 12}
                  fontSize={12}
                  fontWeight={700}
                  textAnchor={last.diff >= 0 ? "start" : "end"}
                  fill="var(--ink)"
                >
                  écart observé
                </text>
              </>
            )}
            <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--line)" strokeWidth={2} />
            {x.ticks(5).map((t) => (
              <text key={t} x={x(t)} y={H - 12} fontSize={11} textAnchor="middle" fill="var(--muted)" className="num">
                {pts(t, 1)}
              </text>
            ))}
          </svg>
          {last && (
            <p className="text-xs text-muted">
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-fp align-middle" /> aire orange = p-value : la probabilité, si B ne changeait rien,
              d'observer un écart au moins aussi grand
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Readout label="Conversion A" value={last ? `${(last.convA * 100).toFixed(1).replace(".", ",")} %` : "–"} />
            <Readout label="Conversion B" value={last ? `${(last.convB * 100).toFixed(1).replace(".", ",")} %` : "–"} />
          </div>
          <div className="rounded-2xl p-4" style={{ background: last && last.p < 0.05 ? "#ecfdf3" : "color-mix(in srgb, var(--mod) 9%, white)" }}>
            <div className="text-sm font-semibold text-muted">p-value de la dernière expérience</div>
            <div className="num font-display text-4xl font-bold">{last ? fmtP(last.p) : "–"}</div>
            {last && (
              <div className="mt-1 text-sm font-semibold" style={{ color: last.p < 0.05 ? "var(--good)" : "var(--muted)" }}>
                {last.p < 0.05 ? "Significatif au seuil de 5 %" : "Pas significatif au seuil de 5 %"}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <LabButton primary onClick={() => run(1)}>
              Lancer une expérience
            </LabButton>
            <LabButton onClick={() => run(20)}>+20</LabButton>
            <LabButton onClick={reset}>Effacer</LabButton>
          </div>
        </div>
      </div>

      <PValueStrip runs={runs} significant={significant} />
    </LabFrame>
  );
}

const v2s = (n: number) => n.toLocaleString("fr-FR");

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
    </div>
  );
}

/** Chaque expérience = un point placé selon sa p-value ; à gauche du trait, « significatif ». */
function PValueStrip({ runs, significant }: { runs: AbResult[]; significant: number }) {
  const W = 640, H = 70;
  const x = scaleLinear().domain([0, 1]).range([10, W - 10]);
  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">Toutes tes expériences</h3>
        <span className="text-sm font-semibold">
          <span className="num" style={{ color: "var(--mod-deep)" }}>
            {significant} / {runs.length}
          </span>{" "}
          <span className="text-muted">significatives{runs.length ? ` (${Math.round((significant / runs.length) * 100)} %)` : ""}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`${runs.length} expériences, ${significant} avec p < 0,05`}>
        <rect x={x(0)} y={4} width={x(0.05) - x(0)} height={H - 26} rx={4} fill="var(--mod)" opacity={0.12} />
        {runs.map((r, i) => (
          <circle
            key={i}
            cx={x(r.p)}
            cy={10 + ((i * 37) % (H - 36))}
            r={4}
            fill={r.p < 0.05 ? "var(--mod)" : "var(--neg)"}
            opacity={0.85}
          />
        ))}
        <line x1={x(0.05)} x2={x(0.05)} y1={2} y2={H - 20} stroke="var(--mod-deep)" strokeWidth={2} strokeDasharray="4 3" />
        {[0, 0.05, 0.25, 0.5, 0.75, 1].map((t) => (
          <text key={t} x={x(t)} y={H - 4} fontSize={10} textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"} fill="var(--muted)" className="num">
            {String(t).replace(".", ",")}
          </text>
        ))}
      </svg>
      <p className="text-xs text-muted">Chaque point est une expérience, placé selon sa p-value. La zone colorée correspond à p &lt; 0,05.</p>
    </div>
  );
}
