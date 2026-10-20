import { FichesList } from "@/components/pages/FichesList";
export const metadata = { description: "Une fiche récap par leçon : l'essentiel, les formules, les pièges et les réponses d'entretien.", title: "Fiches récap" };
export default function Page() {
  return <FichesList />;
}
