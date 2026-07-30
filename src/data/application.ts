// src/data/application.ts
//
// Zentrale Konfiguration für Bewerbungsphasen – pro Stadt UND pro Programm.
//
// STRUKTUR: application[city][program]
//
// Bewerbungen öffnen:  isOpen: true
// Bewerbungen schließen: isOpen: false
// Frist ändern:        deadline: "15 March 2027"
// Link ändern:         link: "https://..."
//
// Neues Programm:  ProgramKey um weiteren String erweitern
// Neue Stadt:      CityKey erweitern + Eintrag ergänzen

export type CityKey    = "muenchen" | "aachen";
export type ProgramKey = "aimConnect" | "aimCode";

export interface ApplicationConfig {
  /** true = Text + Button; false = "closed", kein Button */
  isOpen:   boolean;
  /** Anzeigetext der Frist, z.B. "1 January 2026" */
  deadline: string;
  /** Bewerbungslink – vor Go-Live ersetzen */
  link:     string;
}

export const application: Record<CityKey, Record<ProgramKey, ApplicationConfig>> = {

  muenchen: {
    aimConnect: {
      isOpen:   true,
      deadline: "1 January 2026",
      link:     "https://example.com/apply",
    },
    aimCode: {
      isOpen:   true,
      deadline: "1 February 2026",
      link:     "https://example.com/apply",
    },
  },

  aachen: {
    aimConnect: {
      isOpen:   true,
      deadline: "1 January 2026",
      link:     "https://example.com/apply",
    },
    aimCode: {
      isOpen:   false,
      deadline: "",
      link:     "",
    },
  },

};

/**
 * Gibt die Konfiguration für Stadt + Programm zurück.
 * Gibt null zurück wenn kein Eintrag existiert → Hero zeigt nichts an.
 */
export function getApplicationData(
  citySlug: string,
  program:  ProgramKey
): ApplicationConfig | null {
  return application[citySlug as CityKey]?.[program] ?? null;
}
