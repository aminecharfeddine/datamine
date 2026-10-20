import { Landing } from "@/components/landing/Landing";
import { ALL_LESSONS, moduleById } from "@/lib/curriculum";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SITE_NAME} : parcours de data science`,
    description: SITE_DESCRIPTION,
    itemListElement: ALL_LESSONS.filter((l) => l.available).map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Course",
        name: l.title,
        description: l.summary,
        url: `${SITE_URL}/lecons/${l.slug}`,
        inLanguage: "fr",
        isAccessibleForFree: true,
        provider: { "@type": "Organization", name: SITE_NAME, sameAs: SITE_URL },
        about: moduleById(l.moduleId)?.title,
      },
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Landing />
    </>
  );
}
