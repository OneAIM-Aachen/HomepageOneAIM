// src/data/application.ts
//
// ZENTRALE KONFIGURATION FÜR BEWERBUNGSPHASEN
//
// Dies ist die EINZIGE Datei, die angepasst werden muss.
// Keine Komponente muss geändert werden.
//
// Bewerbungen öffnen:    isOpen: true
// Bewerbungen schließen: isOpen: false
// Frist ändern:          deadline: "15 February 2027"
// Link ändern:           link: "https://eurer-link.de/bewerben"
//
// Neuen Standort ergänzen:
//   1. CityKey unten erweitern (| "hamburg")
//   2. Eintrag in application {} hinzufügen

export type CityKey = "muenchen" | "aachen";

export interface ApplicationConfig {
  /** true = Text + Button; false = "Applications closed", kein Button */
  isOpen:   boolean;
  /** Anzeigetext der Frist, z.B. "1 January 2026" */
  deadline: string;
  /** Bewerbungslink – Dummy, vor Go-Live ersetzen */
  link:     string;
}

export const application: Record<CityKey, ApplicationConfig> = {
  muenchen: {
    isOpen:   true,
    deadline: "1 January 2026",
    link:     "https://example.com/apply",
  },
  aachen: {
    isOpen:   true,
    deadline: "1 January 2026",
    link:     "https://example.com/apply",
  },
};

/**
 * Gibt die Konfiguration für einen Standort zurück.
 * Gibt null zurück, wenn kein Eintrag existiert → Komponente zeigt nichts.
 */
export function getApplicationData(citySlug: string): ApplicationConfig | null {
  return application[citySlug as CityKey] ?? null;
}
