// URL publique du site (métadonnées, sitemap, images de partage).
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "Datamine";
export const SITE_DESCRIPTION =
  "Un parcours gratuit et interactif pour apprendre la data science, le machine learning, le deep learning, les LLM et les agents, et préparer ses entretiens.";
