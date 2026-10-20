import { describe, expect, it } from "vitest";
import sitemap from "../app/sitemap";
import robots from "../app/robots";
import { ALL_LESSONS } from "./curriculum";

describe("SEO", () => {
  it("le sitemap contient l'accueil, les pages publiques et toutes les leçons publiées", () => {
    const urls = sitemap().map((u) => u.url);
    for (const l of ALL_LESSONS.filter((x) => x.available)) expect(urls.some((u) => u.endsWith(`/lecons/${l.slug}`)), l.slug).toBe(true);
    expect(urls.some((u) => u.endsWith("/entretiens"))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });
  it("robots exclut les pages personnelles et pointe vers le sitemap", () => {
    const r = robots();
    expect(JSON.stringify(r.rules)).toContain("/profil");
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
