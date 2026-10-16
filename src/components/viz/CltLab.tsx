"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { binCounts, DISTS, meanSd, normalPdf, sampleMeans, type DistId } from "@/lib/sims";
import { mulberry32 } from "@/lib/metrics";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabButton, LabFrame, Segmented, Slider } from "./controls";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

/** Domaine et nombre de classes : pour le dé, une classe par valeur possible de la moyenne (évite les « peignes »). */
function binning(dist: DistId, n: number): { domain: [number, number]; bins: number } {
  if (dist === "de") {
    const h = 0.5 / n;
    return { domain: [1 - h, 6 + h], bins: Math.min(5 * n + 1, 121) };
  }
  return { domain: DISTS[dist].domain, bins: 48 };
}

/**
 * Simulateur du théorème central limite : on tire des échantillons de taille n,
 * on calcule leur moyenne, et on regarde la distribution de ces moyennes se former.
 */
export function CltLab({
  id = "clt",
  dist: d0 = "uniforme",
  n: n0 = 1,
  dists = ["uniforme", "exponentielle", "bimodale", "de"],
  challenge,
}: {
  id?: string;
  dist?: DistId;
  n?: number;
  dists?: DistId[];
  challenge?: string;
}) {
  const [distId, setDistId] = useState<DistId>(d0);
  const [n, setN] = useState(n0);
  const [means, setMeans] = useState<number[]>([]);
  const [last, setLast] = useState<number[]>([]);
  const dist = DISTS[distId];

  const draw = (count: number) => {
    const rand = Math.random;
    if (count === 1) {
      const s = Array.from({ length: n }, () => dist.sample(rand));
      setLast(s);
      setMeans((m) => [...m, s.reduce((a, b) => a + b, 0) / n]);
    } else {
      setLast([]);
      setMeans((m) => [...m, ...sampleMeans(dist, n, count, rand)]);
    }
  };
  const clear = () => {
    setMeans([]);
    setLast([]);
  };

  const solved = challenge ? CHALLENGES[challenge].check({ dist: distId, n, count: means.length }) : false;

  // Population : 20 000 tirages fixes pour dessiner la forme de la distribution de départ.
  const population = useMemo(() => sampleMeans(dist, 1, 20000, mulberry32(5)), [dist]);
  const { domain, bins } = binning(distId, n);
  const popBin = binning(distId, 1);
  const popCounts = useMemo(() => binCounts(population, popBin.domain, popBin.bins), [population, popBin.domain, popBin.bins]);
  const meanCounts = binCounts(means, domain, bins);
  const stats = meanSd(means);
  const theoSd = dist.sd / Math.sqrt(n);

  const W = 600, Hp = 120, Hm = 220, ML = 10, MR = 10;
  const x = scaleLinear().domain(dist.domain).range([ML, W - MR]);

  // Courbe normale théorique N(μ, σ/√n), mise à l'échelle des effectifs.
  const binW = (domain[1] - domain[0]) / bins;
  const normal = useMemo(() => {
    const xs = Array.from({ length: 200 }, (_, i) => dist.domain[0] + ((dist.domain[1] - dist.domain[0]) * i) / 199);
    return xs.map((v) => ({ x: v, y: normalPdf(v, dist.mean, theoSd) * binW * Math.max(means.length, 1) }));
  }, [dist, theoSd, binW, means.length]);

  const maxM = Math.max(5, ...meanCounts, means.length >= 30 ? Math.max(...normal.map((p) => p.y)) : 0);
  const yM = scaleLinear().domain([0, maxM]).range([Hm - 24, 8]);
  const maxP = Math.max(...popCounts);
  const yP = scaleLinear().domain([0, maxP]).range([Hp - 22, 8]);
  const normalPath = line<{ x: number; y: number }>().x((p) => x(p.x)).y((p) => yM(p.y))(normal) ?? "";

  return (
    <LabFrame>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}

      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {dists.length > 1 && (
          <Segmented
            label="Distribution de départ"
            value={distId}
            options={dists.map((d) => ({ value: d, label: DISTS[d].label }))}
            onChange={(v) => {
              setDistId(v);
              clear();
            }}
          />
        )}
        <Slider
          label="Taille de chaque échantillon n"
          value={n}
          min={1}
          max={50}
          step={1}
          onChange={(v) => {
            setN(v);
            clear();
          }}
          display={String(n)}
        />
      </div>

      {/* Population */}
      <div className="mb-1 flex items-baseline justify-between">
        <h4 className="font-display text-lg">Population · {dist.label.toLowerCase()}</h4>
        <span className="num text-xs text-muted">μ = {fmt(dist.mean)} · σ = {fmt(dist.sd)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${Hp}`} className="w-full" role="img" aria-label={`Distribution de départ : ${dist.label}`}>
        {popCounts.map((c, i) => {
          const bw = (W - ML - MR) / popBin.bins;
          const h = Hp - 22 - yP(c);
          return <rect key={i} x={ML + i * bw + 1} y={yP(c)} width={bw - 2} height={h} rx={Math.min(3, h / 2)} fill="var(--neg)" />;
        })}
        {last.map((v, i) => (
          <circle key={i} cx={x(v)} cy={Hp - 14} r={3} fill="var(--fn)" opacity={0.8} />
        ))}
        {last.length > 0 && (
          <g>
            <line x1={x(means[means.length - 1])} x2={x(means[means.length - 1])} y1={8} y2={Hp - 18} stroke="var(--accent)" strokeWidth={2} />
            <text x={x(means[means.length - 1]) + 5} y={18} fontSize={11} fill="var(--ink)">moyenne de l'échantillon</text>
          </g>
        )}
        <line x1={ML} x2={W - MR} y1={Hp - 22} y2={Hp - 22} stroke="var(--line)" />
      </svg>
      <p className="mb-6 text-xs text-muted">
        {last.length > 0 ? (
          <>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-fn align-middle" />
            les {n} valeurs tirées · <span className="mx-1 inline-block h-2 w-0.5 bg-accent align-middle" /> leur moyenne, ajoutée en bas
          </>
        ) : (
          "Tire un échantillon pour voir ses valeurs et leur moyenne."
        )}
      </p>

      {/* Moyennes */}
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-lg">Distribution des moyennes</h4>
        <span className="num text-xs text-muted">{means.length} moyennes</span>
      </div>
      <svg viewBox={`0 0 ${W} ${Hm}`} className="w-full" role="img" aria-label={`Histogramme de ${means.length} moyennes d'échantillons de taille ${n}`}>
        {meanCounts.map((c, i) => {
          const bw = x(domain[0] + binW) - x(domain[0]);
          const h = Hm - 24 - yM(c);
          return (
            <rect key={i} x={x(domain[0] + i * binW) + 0.5} y={yM(c)} width={Math.max(1, bw - 1)} height={h} rx={Math.min(2, h / 2)} fill="var(--accent)" />
          );
        })}
        {means.length >= 30 && <path d={normalPath} fill="none" stroke="var(--ink)" strokeWidth={2} />}
        <line x1={ML} x2={W - MR} y1={Hm - 24} y2={Hm - 24} stroke="var(--line)" />
        {x.ticks(6).map((t) => (
          <text key={t} x={x(t)} y={Hm - 8} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">
            {fmt(t, 1)}
          </text>
        ))}
      </svg>
      {means.length >= 30 && (
        <p className="text-xs text-muted">
          <span className="mr-1 inline-block h-0.5 w-4 bg-ink align-middle" /> loi normale prédite par le TCL : N(μ, σ/√n)
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <LabButton primary onClick={() => draw(1)}>
          +1 échantillon
        </LabButton>
        <LabButton onClick={() => draw(100)}>+100</LabButton>
        <LabButton onClick={() => draw(1000)}>+1 000</LabButton>
        <LabButton onClick={clear}>Effacer</LabButton>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Readout label="Moyenne des moyennes" value={means.length ? fmt(stats.mean) : "–"} />
        <Readout label="μ (population)" value={fmt(dist.mean)} />
        <Readout label="Écart-type des moyennes" value={means.length > 1 ? fmt(stats.sd, 3) : "–"} />
        <Readout label="σ / √n (théorie)" value={fmt(theoSd, 3)} />
      </div>
    </LabFrame>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}
