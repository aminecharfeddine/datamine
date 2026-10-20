import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/ui/Header";
import { Toaster } from "@/components/ui/Toaster";
import { SyncProvider } from "@/components/ui/SyncProvider";
import { Celebrations } from "@/components/game/Celebrations";
import { ThemeApplier } from "@/components/game/ThemeApplier";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Datamine : apprendre la data science en manipulant", template: "%s · Datamine" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Amine Charfeddine", url: "https://github.com/aminecharfeddine" }],
  keywords: ["data science", "machine learning", "deep learning", "LLM", "agents IA", "entretien data scientist", "cours en français", "statistiques"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "fr_FR", siteName: SITE_NAME, url: "/", title: "Datamine : la data science, en manipulant", description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image", title: "Datamine : la data science, en manipulant", description: SITE_DESCRIPTION },
};

export const viewport = { themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap"
        />
      </head>
      <body className="min-h-screen">
        <a href="#contenu" className="skip-link">
          Aller au contenu
        </a>
        <div className="relative z-10">
          <Header />
          <main id="contenu" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <footer className="site-footer mx-auto mt-24 max-w-6xl border-t border-line px-4 py-8 text-sm text-muted">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span>Datamine, un labo pour apprendre la data science en la manipulant.</span>
              <nav aria-label="Liens du pied de page" className="flex flex-wrap gap-x-5 gap-y-1 sm:ml-auto">
                <a href="/parcours" className="hover:text-ink">Parcours</a>
                <a href="/entretiens" className="hover:text-ink">Entretiens</a>
                <a href="/fiches" className="hover:text-ink">Fiches</a>
                <a href="https://github.com/aminecharfeddine/datamine" className="hover:text-ink">Code source</a>
              </nav>
            </div>
          </footer>
        </div>
        <Toaster />
        <SyncProvider />
        <ThemeApplier />
        <Celebrations />
      </body>
    </html>
  );
}
