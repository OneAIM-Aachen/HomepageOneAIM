// src/types/events.ts
//
// Gemeinsames TypeScript-Interface für alle Timeline-Events.
// Wird von Datendateien, Timeline.astro und EventCard.astro importiert.
//
// ZUKUNFTSSICHERHEIT:
// Die Felder location, category, tags und featured sind bereits definiert
// und erlauben später ohne Interface-Änderung:
//   - Filter nach Standort:   events.filter(e => e.location === city)
//   - Filter nach Kategorie:  events.filter(e => e.category === "Workshop")
//   - Filter nach Tags:       events.filter(e => e.tags.includes("AI"))
//   - Hervorhebung:           events.filter(e => e.featured)
//   - Sortierung nach Datum:  events.sort((a,b) => new Date(a.date) - new Date(b.date))

export interface TimelineEvent {
  /** Eindeutiger Bezeichner (URL-sicher, kebab-case) */
  id: string;

  /** Eventtitel – wird als Hauptüberschrift der Karte dargestellt */
  title: string;

  /** ISO-Datum YYYY-MM-DD – Grundlage für Sortierung und Formatierung */
  date: string;

  /** Kurzbeschreibung des Events */
  description: string;

  /** Pfad zum Eventbild (relativ zu /public) */
  image: string;

  /** Alt-Text für Screenreader */
  imageAlt?: string;

  /**
   * Standort des Events.
   * Bereits für spätere Standortfilterung vorgesehen.
   * Beispiele: "Munich" | "Aachen"
   */
  location: string;

  /**
   * Eventtyp / Kategorie.
   * Für spätere Kategoriefilterung und Farbgebung vorgesehen.
   * Beispiele: "Kick-Off" | "Company Visit" | "Workshop" |
   *            "Conference" | "Networking" | "Makeathon" | "Social Event"
   */
  category: string;

  /**
   * Frei definierbare Tags.
   * Für spätere Tag-Filterung vorgesehen.
   * Beispiele: ["AI", "Healthcare", "Robotics", "MedTech"]
   */
  tags: string[];

  /**
   * Hebt das Event optisch besonders hervor.
   * Für spätere "Featured Event"-Darstellung vorgesehen.
   */
  featured?: boolean;
}
