import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/ui/Header";
import { Toaster } from "@/components/ui/Toaster";
import { SyncProvider } from "@/components/ui/SyncProvider";

export const metadata: Metadata = {
  title: { default: "Datamine — apprendre la data science en manipulant", template: "%s · Datamine" },
  description:
    "Statistiques, Machine Learning, Deep Learning, LLM : des visualisations interactives, des défis et de la répétition espacée pour vraiment comprendre.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
        />
      </head>
      <body className="min-h-screen">
        <div className="relative z-10">
          <Header />
          <main>{children}</main>
          <footer className="mx-auto mt-24 max-w-6xl border-t border-line px-4 py-8 text-sm text-muted">
            Datamine — un laboratoire pour comprendre la data science en la manipulant.
          </footer>
        </div>
        <Toaster />
        <SyncProvider />
      </body>
    </html>
  );
}
