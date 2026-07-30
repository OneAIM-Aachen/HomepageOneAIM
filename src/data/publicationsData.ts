// src/data/publicationsData.ts
//
// Einzige Datenquelle für alle Publikationen.
//
// Neue Publikation ergänzen:
//   1. Bild nach public/images/publications/ legen
//   2. Eintrag in das Array unten hinzufügen
//   → Die Seite sortiert automatisch nach Jahr (neueste zuerst).
//
// HINWEIS: Alle Inhalte sind Dummy-Daten.

export interface Publication {
  id:          string;
  title:       string;
  authors:     string[];
  year:        number;
  description: string;
  /** Pfad zum Vorschaubild (relativ zu /public) */
  image:       string;
  imageAlt?:   string;
}

export const publications: Publication[] = [
  {
    id:          "studierendeninitiativen-2026",
    title:       "The first OneAIM book is out now!",
    authors:     ["L. Hartmann", "J. Weber"],
    year:        2026,
    description: "An analysis of how interdisciplinary student programs can accelerate the transfer of research findings into clinical practice.",
    image:       "/images/publications/oneAimBook1.jpeg",
    imageAlt:    "Publikation: Studierendeninitiativen und MedTech-Forschung (Platzhalter)",
  },
  {
    id:          "ml-bildgebung-2025",
    title:       "Maschinelles Lernen in der medizinischen Bildgebung: Ein Einstieg für Studierende",
    authors:     ["S. Bauer", "F. Schmidt", "M. Lindner"],
    year:        2025,
    description: "Supplementary material from the AIM Code Bootcamp on the fundamentals of image classification and AI-assisted diagnosis.",
    image:       "/images/publications/pub-2.svg",
    imageAlt:    "Publikation: Maschinelles Lernen in der Bildgebung (Platzhalter)",
  },
];

/** Alle Publikationen, neueste zuerst (nach Jahr absteigend). */
export function getSortedPublications(): Publication[] {
  return [...publications].sort((a, b) => b.year - a.year);
}
