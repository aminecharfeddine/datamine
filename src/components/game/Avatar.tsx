import { mulberry32 } from "@/lib/metrics";

// Avatar : un disque coloré, un glyphe (initiale ou symbole mathématique) et un cadre optionnel.
// Les cadres reprennent des motifs de visualisation de données : histogramme, onde, constellation…

const C = 50; // centre du repère 100 × 100
const DISK = 34; // rayon du disque

function radialPath(r: (t: number) => number, n = 240) {
  return (
    Array.from({ length: n + 1 }, (_, i) => {
      const t = (i / n) * 2 * Math.PI;
      const rr = r(t);
      return `${i ? "L" : "M"}${(C + rr * Math.cos(t)).toFixed(2)},${(C + rr * Math.sin(t)).toFixed(2)}`;
    }).join(" ") + "Z"
  );
}

/** Hauteurs d'un histogramme radial en forme de cloche, déterministes. */
const HISTO = (() => {
  const r = mulberry32(17);
  return Array.from({ length: 40 }, (_, i) => {
    const x = (i / 40) * 2 - 1;
    return 2.5 + 7 * Math.exp(-((x * 2.2) ** 2)) + 1.6 * r();
  });
})();

const STARS = (() => {
  const r = mulberry32(5);
  return Array.from({ length: 9 }, (_, i) => {
    const t = (i / 9) * 2 * Math.PI + r() * 0.35;
    const rr = 41 + r() * 6;
    return { x: C + rr * Math.cos(t), y: C + rr * Math.sin(t), s: 1.6 + r() * 1.6 };
  });
})();

export function Frame({ id, color }: { id: string; color: string }) {
  switch (id) {
    case "f-dashed":
      return <circle cx={C} cy={C} r={42} fill="none" stroke={color} strokeWidth={3} strokeDasharray="4.5 4" strokeLinecap="round" />;
    case "f-double":
      return (
        <g fill="none" stroke={color}>
          <circle cx={C} cy={C} r={40} strokeWidth={2.6} />
          <circle cx={C} cy={C} r={45.5} strokeWidth={1.4} opacity={0.6} />
        </g>
      );
    case "f-histogram":
      return (
        <g stroke={color} strokeWidth={3.4} strokeLinecap="round">
          {HISTO.map((h, i) => {
            const t = (i / HISTO.length) * 2 * Math.PI - Math.PI / 2;
            const r0 = 39;
            return (
              <line
                key={i}
                x1={C + r0 * Math.cos(t)}
                y1={C + r0 * Math.sin(t)}
                x2={C + (r0 + h) * Math.cos(t)}
                y2={C + (r0 + h) * Math.sin(t)}
                opacity={0.55 + h / 25}
              />
            );
          })}
        </g>
      );
    case "f-wave":
      return <path d={radialPath((t) => 42.5 + 3.2 * Math.sin(9 * t))} fill="none" stroke={color} strokeWidth={2.6} />;
    case "f-constellation":
      return (
        <g>
          <polyline
            points={[...STARS, STARS[0]].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={1}
            opacity={0.5}
          />
          {STARS.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.s} fill={color} />
          ))}
        </g>
      );
    case "f-prism":
      return (
        <g className="frame-spin">
          {["#f43f5e", "#f59e0b", "#84cc16", "#06b6d4", "#6366f1", "#d946ef"].map((c, i) => {
            const a0 = (i / 6) * 2 * Math.PI, a1 = ((i + 1) / 6) * 2 * Math.PI, r = 43;
            return (
              <path
                key={c}
                d={`M${C + r * Math.cos(a0)},${C + r * Math.sin(a0)} A${r},${r} 0 0 1 ${C + r * Math.cos(a1)},${C + r * Math.sin(a1)}`}
                fill="none"
                stroke={c}
                strokeWidth={5}
              />
            );
          })}
        </g>
      );
    case "f-flame":
      return (
        <g>
          <defs>
            <linearGradient id="flame-g" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#f97316" />
              <stop offset="1" stopColor="#facc15" />
            </linearGradient>
          </defs>
          <path d={radialPath((t) => 40 + 6 * Math.abs(Math.sin(6 * t)) ** 3 + 1.5 * Math.sin(13 * t))} fill="none" stroke="url(#flame-g)" strokeWidth={3} strokeLinejoin="round" />
        </g>
      );
    case "f-orbit":
      return (
        <g>
          <ellipse cx={C} cy={C} rx={45} ry={45} fill="none" stroke={color} strokeWidth={1.2} opacity={0.45} />
          <g className="frame-spin">
            <circle cx={C + 45} cy={C} r={4} fill={color} />
            <circle cx={C - 45} cy={C} r={2.4} fill={color} opacity={0.7} />
          </g>
        </g>
      );
    case "f-laurel":
      return (
        <g fill="#16a34a">
          {Array.from({ length: 7 }, (_, i) => {
            const t = Math.PI * (0.62 + i * 0.075);
            return [1, -1].map((side) => {
              const ang = side === 1 ? t : Math.PI - t;
              const x = C + 43 * Math.cos(ang), y = C + 43 * Math.sin(ang);
              const rot = (ang * 180) / Math.PI + 90 + side * 25;
              return <ellipse key={`${i}${side}`} cx={x} cy={y} rx={3} ry={6.5} transform={`rotate(${rot} ${x} ${y})`} opacity={0.75 + i * 0.035} />;
            });
          })}
          <circle cx={C} cy={C + 44.5} r={3} fill="#eab308" />
        </g>
      );
    default:
      return null;
  }
}

export function Avatar({
  size = 44,
  letter,
  glyph,
  frame = "f-none",
  color = "var(--accent)",
  className,
}: {
  size?: number;
  letter: string;
  glyph?: string;
  frame?: string;
  color?: string;
  className?: string;
}) {
  const text = glyph ?? letter.slice(0, 1).toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label={`Avatar ${text}`}>
      <circle cx={C} cy={C} r={DISK} fill={color} />
      <text
        x={C}
        y={C}
        dy="0.35em"
        textAnchor="middle"
        fill="white"
        fontSize={glyph ? 38 : 34}
        fontWeight={800}
        style={{ fontFamily: glyph ? "Georgia, 'Times New Roman', serif" : "var(--font-display)" }}
      >
        {text}
      </text>
      <Frame id={frame} color={color} />
    </svg>
  );
}
