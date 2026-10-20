import { QUESTIONS } from "@/lib/interview";
import { ogCard, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Préparer ses entretiens data et IA";

export default function Image() {
  return ogCard({
    title: "Préparer ses entretiens data et IA",
    subtitle: `${QUESTIONS.length} questions : concepts à expliquer, choix de modèles, bugs à trouver, études de cas et pièges, avec un entretien blanc chronométré.`,
    kicker: "Module spécial",
    color: "#141627",
  });
}
