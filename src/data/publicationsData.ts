// src/data/publicationsData.ts
//
// DUMMY-DATEN. Alle Einträge sind Platzhalter und müssen vor Veröffentlichung
// durch echte Publikationen ersetzt werden.

export interface Publication {
  title: string;
  authors: string[];
  year: number;
  description: string;
}

export const publications: Publication[] = [
  {
    title: "Studierendeninitiativen als Brücke zwischen MedTech-Forschung und klinischer Praxis",
    authors: ["L. Hartmann", "J. Weber"],
    year: 2026,
    description:
      "Eine Analyse, wie interdisziplinäre Studierendenprogramme den Transfer von Forschungsergebnissen in die klinische Anwendung beschleunigen können.",
  },
  {
    title: "Maschinelles Lernen in der medizinischen Bildgebung: Ein Einstieg für Studierende",
    authors: ["S. Bauer", "F. Schmidt", "M. Lindner"],
    year: 2025,
    description:
      "Begleitmaterial aus dem AIM Code Bootcamp zu den Grundlagen von Bildklassifikation und Diagnoseunterstützung mittels KI.",
  },
  {
    title: "Erfahrungsbericht: Aufbau eines studentischen HealthTech-Netzwerks in zwei Städten",
    authors: ["T. Klein", "A. Vogel"],
    year: 2025,
    description:
      "Reflexion über Herausforderungen und Erfolge beim Aufbau von AIM Connect an einem zweiten Hochschulstandort.",
  },
];
