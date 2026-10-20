import type { MetadataRoute } from "next";
import { ALL_LESSONS } from "@/lib/curriculum";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/parcours", "/entretiens", "/fiches"].map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.8 }));
  const lessons = ALL_LESSONS.filter((l) => l.available).map((l) => ({ url: `${SITE_URL}/lecons/${l.slug}`, changeFrequency: "monthly" as const, priority: 0.7 }));
  return [...pages, ...lessons];
}
