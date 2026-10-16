"use client";

import { useState } from "react";
import { scaleLinear } from "d3-scale";
import { ciHalfWidth, CI_MU, CI_SIGMA, drawInterval, type Interval } from "@/lib/sims";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabButton, LabFrame, Segmented, Slider } from "./controls";

const LEVELS = ["0.8", "0.9", "0.95", "0.99"] as const;
const SHOWN = 60;
const fmt = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

type Control = "n" | "level";

/**
 * Des sondages répétés : chacun donne un intervalle de confiance. La vraie moyenne μ est fixe ;
 * ce sont les intervalles qui bougent, et une part d'entre eux la manque.
 */
export function CiLab({
  id = "ci",
  n: n0 = 20,
  level: l0 = 0.95,
  controls = ["n", "level"],
  challenge,
}: {
  id?: string;
  n?: number;
  level?: number;
  controls?: Control[];
  challenge?: string;
}) {
  const [n, setN] = useState(n0);
  const [level, setLevel] = useState(l0);
  const [intervals, setIntervals] = useState<Interval[]>([]);
  const [count, setCount] = useState(0);
  const [hits, setHits] = useState(0);

  const clear = () => {
    setIntervals([]);
    setCount(0);
    setHits(0);
  };
  const draw = (k: number) => {
    const out = Array.from({ length: k }, () => drawInterval(n, level, Math.random));
    setIntervals((iv) => [...iv, ...out].slice(-SHOWN));
    setCount((c) => c + k);
    setHits((h) => h + out.filter((o) => o.hit).length);
  };

  const solved = challenge ? CHALLENGES[challenge].check({ n, level, count, hits }) : false;
  const half = ciHalfWidth(n, level);

  const W = 640, row = 6, H = SHOWN * row + 40;
  const x = scaleLinear().domain([CI_MU - 14, CI_MU + 14]).range([10, W - 10]).clamp(true);

  return (
    <LabFrame>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}

      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {controls.includes("n") && (
          <Slider
            label="Taille de chaque sondage n"
            value={n}
            min={5}
            max={300}
            step={5}
            onChange={(v) => {
              setN(v);
              clear();
            }}
            display={String(n)}
          />
        )}
        {controls.includes("level") && (
          <Segmented
            label="Niveau de confiance"
            value={String(level) as (typeof LEVELS)[number]}
            options={LEVELS.map((l) => ({ value: l, label: `${Math.round(Number(l) * 100)} %` }))}
            onChange={(v) => {
              setLevel(Number(v));
              clear();
            }}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <h4 className="font-display text-lg font-bold">Les {SHOWN} derniers sondages</h4>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${count} intervalles tracés, ${hits} contiennent la vraie moyenne`}>
            {intervals.map((iv, i) => {
              const yy = 8 + (SHOWN - intervals.length + i) * row;
              const c = iv.hit ? "var(--mod)" : "var(--fp)";
              return (
                <g key={i}>
                  <line x1={x(iv.lo)} x2={x(iv.hi)} y1={yy} y2={yy} stroke={c} strokeWidth={iv.hit ? 2.5 : 3.5} strokeLinecap="round" opacity={iv.hit ? 0.75 : 1} />
                  <circle cx={x(iv.mean)} cy={yy} r={1.8} fill="var(--ink)" />
                </g>
              );
            })}
            <line x1={x(CI_MU)} x2={x(CI_MU)} y1={0} y2={H - 26} stroke="var(--ink)" strokeWidth={2} strokeDasharray="5 4" />
            <text x={x(CI_MU) + 6} y={H - 30} fontSize={12} fontWeight={700} fill="var(--ink)">
              vraie moyenne μ = {CI_MU}
            </text>
            {[40, 45, 50, 55, 60].map((t) => (
              <text key={t} x={x(t)} y={H - 8} fontSize={11} textAnchor="middle" fill="var(--muted)" className="num">
                {t}
              </text>
            ))}
          </svg>
          <p className="text-xs text-muted">
            <span className="mr-1 inline-block h-1 w-4 rounded bg-mod align-middle" /> contient μ
            <span className="ml-3 mr-1 inline-block h-1 w-4 rounded bg-fp align-middle" /> rate μ
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl p-4" style={{ background: "color-mix(in srgb, var(--mod) 9%, white)" }}>
            <div className="text-sm font-semibold text-muted">Intervalles qui contiennent μ</div>
            <div className="num font-display text-4xl font-bold" style={{ color: "var(--mod-deep)" }}>
              {count ? `${fmt((hits / count) * 100)} %` : "–"}
            </div>
            <div className="num text-sm text-muted">
              {hits} sur {count} · promesse : {Math.round(level * 100)} %
            </div>
          </div>
          <div className="rounded-xl border border-line bg-paper p-3">
            <div className="text-xs font-semibold text-muted">Marge de chaque intervalle</div>
            <div className="num mt-0.5 text-xl font-bold">± {fmt(half, 2)}</div>
            <div className="num text-xs text-muted">
              z × σ / √n avec σ = {CI_SIGMA}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <LabButton primary onClick={() => draw(1)}>
              +1 sondage
            </LabButton>
            <LabButton onClick={() => draw(20)}>+20</LabButton>
            <LabButton onClick={() => draw(100)}>+100 sondages</LabButton>
            <LabButton onClick={clear}>Effacer</LabButton>
          </div>
        </div>
      </div>
    </LabFrame>
  );
}
