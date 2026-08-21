// src/data/cityData.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Standort-Datenbank – einzige Quelle für alles Standortspezifische.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  NEUEN STANDORT ERGÄNZEN – ein Schritt:                                  ║
// ║                                                                          ║
// ║  Slug zum Typ CitySlug hinzufügen und einen Eintrag in `cityData`        ║
// ║  schreiben. Danach passiert von selbst:                                  ║
// ║    • die Seite /<slug> entsteht (Blaupause mit Platzhaltern)             ║
// ║    • der Standort erscheint im "Locations"-Dropdown der Kopfzeile        ║
// ║    • der Pin erscheint auf der Karte der Startseite                      ║
// ║    • der Städte-Zähler im Hero zählt hoch                                ║
// ║    • News-/Bewerbungs-/Team-Einträge können den Slug verwenden           ║
// ║                                                                          ║
// ║  Optionale Felder leer lassen → die Blaupause zeigt Platzhalter.         ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// Die Inhalte der Standortseite kommen aus DREI Schichten (in dieser
// Reihenfolge): explizite Props an <CityBlueprint /> → dieser Eintrag hier
// → eckige Platzhalter. Bewerbungen, News und Team füllen sich weiterhin
// automatisch aus applications.ts, newsData.ts und teamData.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Kanonische Standort-Slugs – überall im Projekt dieselben. */
export type CitySlug = "munich" | "aachen" | "frankfurt";

export interface CityData {
  slug: CitySlug;
  /** Anzeigename, z. B. "Munich" */
  displayName: string;

  // ── Karte auf der Startseite (MapHero) ─────────────────────
  /** Koordinaten des Pins */
  coords: { lon: number; lat: number };
  /** Kurzlabel unter dem Pin, z. B. "RWTH" oder "LMU · TUM" */
  uniShort: string;

  // ── Hero der Standortseite (Entwurf 15A) ───────────────────
  heroImage?: string;
  heroImageAlt?: string;
  /** Logo der Universität – weißer Chip im Hero */
  universityLogo?: string;
  /** Voller Name der Universität – Alt-Text bzw. Ersatz ohne Logo */
  university?: string;
  /** Instagram-Handle, z. B. "@oneaim.munich" */
  instagram?: string;
  instagramHref?: string;

  // ── "The chapter"-Band (Entwurf 2a) ────────────────────────
  /** Gründungsjahr des Chapters, z. B. 2025 */
  foundedYear?: number | string;
  /** Gründende Hochschule(n) als Fließtext, z. B. "RWTH Aachen" */
  universities?: string;
  /** 1–2 freie Sätze: Entstehung, heutige Aktivitäten, lokale Partner */
  story?: string;
  introImage?: string;
  introImageAlt?: string;
}

export const cityData: Record<CitySlug, CityData> = {
  munich: {
    slug:        "munich",
    displayName: "Munich",
    coords:      { lon: 11.582, lat: 48.1351 },
    uniShort:    "LMU · TUM",
    // TODO: heroImage, universityLogo, instagram, foundedYear, story, …
  },
  aachen: {
    slug:        "aachen",
    displayName: "Aachen",
    coords:      { lon: 6.0839, lat: 50.7753 },
    uniShort:    "RWTH",
    // TODO: heroImage, universityLogo, instagram, foundedYear, story, …
  },
  frankfurt: {
    slug:        "frankfurt",
    displayName: "Frankfurt",
    coords:      { lon: 8.6821, lat: 50.1109 },
    uniShort:    "Goethe Uni",
    // TODO: heroImage, universityLogo, instagram, foundedYear, story, …
  },
};

/** Alle Standorte als Array – Reihenfolge = Reihenfolge im Dropdown. */
export const cities: CityData[] = Object.values(cityData);

/** Einzelnen Standort nachschlagen (undefined bei unbekanntem Slug). */
export function getCity(slug: CitySlug): CityData {
  return cityData[slug];
}

/** Statische Pfade für /[city] – eine Seite pro Eintrag oben. */
export function getCityStaticPaths() {
  return cities.map(city => ({
    params: { city: city.slug },
    props:  { city },
  }));
}
