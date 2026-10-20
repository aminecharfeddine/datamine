// Images de partage (Open Graph) générées au build, dans la typographie du site.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

const font = (pkg: string, file: string) => readFile(path.join(process.cwd(), "node_modules/@fontsource", pkg, "files", file));

// Les polices embarquées couvrent le latin ; on remplace les rares symboles mathématiques.
const clean = (t?: string) => t?.replace(/√n/g, "racine de n").replace(/√/g, "racine de ");

export async function ogCard({ title: rawTitle, subtitle: rawSub, kicker, color = "#4f46e5" }: { title: string; subtitle?: string; kicker?: string; color?: string }) {
  const title = clean(rawTitle)!;
  const subtitle = clean(rawSub);
  const [display, body] = await Promise.all([font("bricolage-grotesque", "bricolage-grotesque-latin-800-normal.woff"), font("figtree", "figtree-latin-600-normal.woff")]);
  const size = title.length > 48 ? 64 : title.length > 30 ? 76 : 88;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4f5fa", padding: 64, fontFamily: "Figtree" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 30 30">
            <rect width="30" height="30" rx="9" fill="#4f46e5" />
            <line x1="6" y1="22" x2="24" y2="8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
            <circle cx="9" cy="19" r="2.6" fill="#fff" />
            <circle cx="15.5" cy="16" r="2.6" fill="#ffd166" />
            <circle cx="21" cy="10" r="2.6" fill="#fff" />
          </svg>
          <span style={{ fontFamily: "Bricolage", fontSize: 40, color: "#141627" }}>Datamine</span>
          {kicker && <span style={{ marginLeft: "auto", fontSize: 28, color, background: "white", padding: "10px 22px", borderRadius: 999, border: `3px solid ${color}` }}>{kicker}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontFamily: "Bricolage", fontSize: size, lineHeight: 1.02, color: "#141627", letterSpacing: -1.5 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 32, lineHeight: 1.3, color: "#5d6283", maxWidth: 1000 }}>{subtitle}</div>}
        </div>
        <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden" }}>
          <div style={{ flex: 3, background: color }} />
          <div style={{ flex: 1, background: "#ffd166" }} />
          <div style={{ flex: 2, background: "#dfe2ee" }} />
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Bricolage", data: display, weight: 800, style: "normal" },
        { name: "Figtree", data: body, weight: 600, style: "normal" },
      ],
    },
  );
}
