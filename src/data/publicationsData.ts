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
    description: "Eine Analyse, wie interdisziplinäre Studierendenprogramme den Transfer von Forschungsergebnissen in die klinische Anwendung beschleunigen können.",
    image:       "/images/publications/oneAimBook1.jpeg",
    imageAlt:    "Publikation: Studierendeninitiativen und MedTech-Forschung (Platzhalter)",
  },
  {
    id:          "ml-bildgebung-2025",
    title:       "Maschinelles Lernen in der medizinischen Bildgebung: Ein Einstieg für Studierende",
    authors:     ["S. Bauer", "F. Schmidt", "M. Lindner"],
    year:        2025,
    description: "Begleitmaterial aus dem AIM Code Bootcamp zu den Grundlagen von Bildklassifikation und Diagnoseunterstützung mittels KI.",
    image:       "/images/publications/pub-2.svg",
    imageAlt:    "Publikation: Maschinelles Lernen in der Bildgebung (Platzhalter)",
  },
  {
    id:          "healthtech-netzwerk-2025",
    title:       "Erfahrungsbericht: Aufbau eines studentischen HealthTech-Netzwerks in zwei Städten",
    authors:     ["T. Klein", "A. Vogel"],
    year:        2025,
    description: "Reflexion über Herausforderungen und Erfolge beim Aufbau von AIM Connect an einem zweiten Hochschulstandort.",
    image:       "/images/publications/pub-3.svg",
    imageAlt:    "Publikation: HealthTech-Netzwerk Erfahrungsbericht (Platzhalter)",
  },
];

/** Alle Publikationen, neueste zuerst (nach Jahr absteigend). */
export function getSortedPublications(): Publication[] {
  return [...publications].sort((a, b) => b.year - a.year);
}
