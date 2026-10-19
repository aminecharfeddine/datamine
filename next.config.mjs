import createMDX from "@next/mdx";

const withMDX = createMDX({
  options: {
    // Noms de plugins en chaîne : requis par Turbopack (Next 16)
    remarkPlugins: ["remark-gfm", "remark-math"],
    rehypePlugins: ["rehype-katex"],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  turbopack: {
    // sql.js contient un chemin de code Node (require("fs")) jamais exécuté dans le navigateur.
    resolveAlias: {
      fs: { browser: "./src/lib/empty-module.ts" },
      path: { browser: "./src/lib/empty-module.ts" },
      crypto: { browser: "./src/lib/empty-module.ts" },
    },
  },
};

export default withMDX(nextConfig);
