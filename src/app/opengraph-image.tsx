import { ogCard, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Datamine : la data science, en manipulant";

export default function Image() {
  return ogCard({
    title: "La data science, en manipulant.",
    subtitle: "Statistiques, machine learning, deep learning, LLM et agents : des labos interactifs, des défis et la préparation aux entretiens.",
  });
}
