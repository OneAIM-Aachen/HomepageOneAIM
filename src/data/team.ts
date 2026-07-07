// src/data/team.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Einzige Datenquelle für alle Teammitglieder von OneAIM.
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  NEUES TEAMMITGLIED ERGÄNZEN – zwei Schritte:                       ║
// ║  1. Foto nach public/images/team/ legen (Format: vorname-name.svg)  ║
// ║  2. Eintrag im Array unten hinzufügen                               ║
// ║  → Keine Komponente muss angefasst werden.                          ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// HINWEIS: Alle Fotos und Namen sind aktuell Dummy-Daten.
// Echte Fotos: gleichen Dateinamen behalten und Datei ersetzen.
// ─────────────────────────────────────────────────────────────────────────────

export type CitySlug = "muenchen" | "aachen";

export interface TeamMember {
  /** Eindeutiger Bezeichner (URL-sicher, kebab-case) */
  id: string;
  /** Vollständiger Anzeigename – DUMMY, vor Go-Live ersetzen */
  name: string;
  /** Rolle / Position – DUMMY, vor Go-Live ersetzen */
  role: string;
  /** Pfad zum Profilbild (relativ zu /public) – aktuell Platzhalter-SVG */
  photo: string;
  /** Alternativer Bildtext für Screenreader */
  photoAlt?: string;
  /** Standort-Zugehörigkeit des Mitglieds */
  city: CitySlug | "both";
  /** Optionaler LinkedIn-Link (macht die Karte anklickbar) */
  linkedin?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Team-Mitglieder
// ─────────────────────────────────────────────────────────────────────────────

export const teamMembers: TeamMember[] = [
  // ── München ────────────────────────────────────────────────────────────
  {
    id:       "lena-hartmann",
    name:     "Lena Hartmann",           // DUMMY – ersetzen
    role:     "Programmleitung AIM Connect",
    photo:    "/images/team/lena-hartmann.svg",
    photoAlt: "Profilfoto Lena Hartmann (Platzhalter)",
    city:     "muenchen",
  },
  {
    id:       "jonas-weber",
    name:     "Jonas Weber",             // DUMMY – ersetzen
    role:     "Programmleitung AIM Code",
    photo:    "/images/team/jonas-weber.svg",
    photoAlt: "Profilfoto Jonas Weber (Platzhalter)",
    city:     "muenchen",
  },
  {
    id:       "sophie-bauer",
    name:     "Sophie Bauer",            // DUMMY – ersetzen
    role:     "Partnerships & Sponsoring",
    photo:    "/images/team/sophie-bauer.svg",
    photoAlt: "Profilfoto Sophie Bauer (Platzhalter)",
    city:     "muenchen",
  },
  {
    id:       "felix-schmidt",
    name:     "Felix Schmidt",           // DUMMY – ersetzen
    role:     "Community & Events",
    photo:    "/images/team/felix-schmidt.svg",
    photoAlt: "Profilfoto Felix Schmidt (Platzhalter)",
    city:     "muenchen",
  },

  // ── Aachen ─────────────────────────────────────────────────────────────
  {
    id:       "mara-lindner",
    name:     "Mara Lindner",            // DUMMY – ersetzen
    role:     "Standortleitung Aachen",
    photo:    "/images/team/mara-lindner.svg",
    photoAlt: "Profilfoto Mara Lindner (Platzhalter)",
    city:     "aachen",
  },
  {
    id:       "tobias-klein",
    name:     "Tobias Klein",            // DUMMY – ersetzen
    role:     "Programmleitung AIM Connect",
    photo:    "/images/team/tobias-klein.svg",
    photoAlt: "Profilfoto Tobias Klein (Platzhalter)",
    city:     "aachen",
  },
  {
    id:       "anna-vogel",
    name:     "Anna Vogel",              // DUMMY – ersetzen
    role:     "Programmleitung AIM Code",
    photo:    "/images/team/anna-vogel.svg",
    photoAlt: "Profilfoto Anna Vogel (Platzhalter)",
    city:     "aachen",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

/** Gibt alle Mitglieder eines Standorts zurück (inkl. city="both"). */
export function getTeamByCity(city: CitySlug): TeamMember[] {
  return teamMembers.filter(m => m.city === city || m.city === "both");
}

/** Gibt alle Mitglieder beider Standorte zurück (kein Duplikat bei "both"). */
export function getAllTeamMembers(): TeamMember[] {
  return teamMembers;
}
