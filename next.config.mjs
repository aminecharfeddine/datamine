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
};

export default withMDX(nextConfig);
