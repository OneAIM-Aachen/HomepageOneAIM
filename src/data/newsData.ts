// src/data/newsData.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Einzige Datenquelle für alle News-Beiträge.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  NEUEN BEITRAG ERGÄNZEN – zwei Schritte:                                 ║
// ║                                                                          ║
// ║  1. Bild nach public/images/news/ legen (optional, aber empfohlen)       ║
// ║  2. Einen Eintrag in das Array unten schreiben – Position egal,          ║
// ║     sortiert wird automatisch nach `date` (neueste zuerst).              ║
// ║     Der Volltext gehört in `body` (ein String je Absatz).                ║
// ║                                                                          ║
// ║  Danach passiert von selbst:                                             ║
// ║    • der neueste Beitrag wird zur großen Aufmacher-Story                 ║
// ║    • die drei folgenden erscheinen im Karten-Raster                      ║
// ║    • alle älteren rutschen in die Liste "Older news"                     ║
// ║    • die Filterleiste kennt Stadt und Programm automatisch               ║
// ║    • unter /news/<id> entsteht automatisch die Artikelseite              ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// WICHTIG zu den Feldern `cities` und `programs`:
// Dort stehen SLUGS, keine Anzeigenamen. Die Beschriftung der Filter kommt
// aus den kanonischen Quellen (navData.ts bzw. programs.ts) – so heißt eine
// Stadt überall gleich und ein neuer Standort taucht ohne Zutun im Filter auf.
//   Städte:    "munich" | "aachen" | "frankfurt"   (siehe navData.ts)
//   Programme: "aim-connect" | "aim-code" | "aim-innovate" | …  (programs.ts)
//
// `tags` ist für alles Übrige gedacht (Makeathon, Partnership, Workshop …).
// Diese Tags erscheinen auf den Karten, aber nicht als eigene Filter.
// ─────────────────────────────────────────────────────────────────────────────

// Kanonische Slugs liegen in cityData.ts (Standort-Datenbank) und werden
// hier nur re-exportiert, damit bestehende Importe weiter funktionieren.
import type { CitySlug } from "./cityData";
export type { CitySlug };

export interface NewsItem {
  /** Eindeutiger Bezeichner (URL-sicher) */
  id: string;
  /** Titel des Beitrags */
  title: string;
  /** ISO-Datum YYYY-MM-DD – bestimmt Sortierung und Jahresfilter */
  date: string;
  /** Kurzbeschreibung / Teaser – erscheint auf Karten und in der Vorschau */
  excerpt: string;
  /**
   * Volltext des Beitrags, ein Eintrag je Absatz.
   * Fehlt das Feld, zeigt die Artikelseite nur den Teaser.
   */
  body?: string[];
  /** Pfad zum Bild (relativ zu /public) */
  image?: string;
  imageAlt?: string;
  /** Standorte, auf die sich der Beitrag bezieht (Slugs) */
  cities?: CitySlug[];
  /** Programme, auf die sich der Beitrag bezieht (Slugs aus programs.ts) */
  programs?: string[];
  /** Freie Zusatz-Tags – erscheinen auf der Karte, sind aber kein Filter */
  tags?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// News-Beiträge
// HINWEIS: Die Inhalte unten sind weiterhin Platzhalter aus der Vorlage.
// ─────────────────────────────────────────────────────────────────────────────

export const newsItems: NewsItem[] = [
  {
    id:       "aim-connect-aachen-launch",
    title:    "AIM Connect Aachen starts with its first cohort",
    date:     "2026-04-14",
    excerpt:  "Our new Aachen chapter welcomes its first group of participants to the AIM Connect program, with visits to regional clinics and HealthTech startups.",
    body: [
      "AIM Connect has arrived in Aachen. Our second chapter welcomed its first cohort this month, bringing together students from medicine, computer science and engineering at RWTH for a semester of curated visits across the regional MedTech landscape.",
      "The opening weekend set the tone: two days of talks and team-building, followed by the first site visit to a university hospital department where participants saw imaging workflows in practice. Over the coming months the group will visit regional clinics, research groups and HealthTech startups.",
      "The program follows the same blueprint as in Munich: the format, the arc from clinical need to working prototype, and the closing makeathon are shared. What differs is local: the partners, the projects and the people.",
      "Applications for the next Aachen cohort open at the start of the coming semester.",
    ],
    image:    "/images/about/kickoff-2026.jpg",
    imageAlt: "OneAIM members at the launch of AIM Connect in Aachen",
    cities:   ["aachen"],
    programs: ["aim-connect"],
  },
  {
    id:       "makeathon-summit-munich-2026",
    title:    "Makeathon Summit Munich: three teams recognised",
    date:     "2026-03-02",
    excerpt:  "Closing the current AIM Connect cycle, 20 students presented their solutions to representatives from hospitals and industry.",
    body: [
      "The current AIM Connect cycle in Munich closed with its makeathon summit. Over three days, 20 students formed teams around problems collected during the semester's clinical visits, and presented working prototypes to a panel from hospitals and industry.",
      "Three teams were recognised. The projects ranged from a triage support tool for emergency intake to a scheduling aid for imaging departments, all built on problems the participants had encountered first-hand rather than briefs handed to them.",
      "The summit closes the program each cycle, and several past projects have continued past it as student research or early-stage ventures.",
    ],
    image:    "/images/news/news-2.svg",
    imageAlt: "Stage at the Makeathon Summit in Munich (placeholder)",
    cities:   ["munich"],
    programs: ["aim-connect"],
    tags:     ["Makeathon"],
  },
  {
    id:       "new-hospital-partnership-munich",
    title:    "New partnership with a Munich hospital",
    date:     "2026-01-20",
    excerpt:  "OneAIM adds another hospital to its partner network, giving students further insight into day-to-day clinical practice.",
    body: [
      "OneAIM has added another Munich hospital to its partner network. The cooperation gives participants access to clinical departments for site visits and shadowing, and opens a channel for clinicians to bring real problems to student teams.",
      "Partnerships like this are the backbone of AIM Connect: the program depends on students seeing clinical practice directly rather than reading about it. Each new partner widens the range of departments a cohort can visit.",
      "Details of the first joint sessions will follow at the start of the semester.",
    ],
    image:    "/images/news/news-3.svg",
    imageAlt: "Handshake symbol for a new partnership (placeholder)",
    cities:   ["munich"],
    tags:     ["Partnership"],
  },
  {
    id:       "aim-code-summer-semester-2025",
    title:    "AIM Code bootcamp: applications open for the summer semester",
    date:     "2025-12-05",
    excerpt:  "Students can now apply for the free AIM DataLab and AIM CodeLab courses running next semester.",
    body: [
      "Registration is open for the next round of AIM Code. Both tracks run again: AIM DataLab, covering Python fundamentals and data handling, and AIM CodeLab, which moves on to machine learning applied to healthcare datasets.",
      "The courses are free and open to students of any background. No prior programming experience is required for DataLab: the sequence is built to take people from a standing start to training their first model.",
      "Places are limited by room capacity. Applications close before the start of the semester.",
    ],
    image:    "/images/about/codelab.jpg",
    imageAlt: "Students in an AIM Code programming course",
    cities:   ["munich"],
    programs: ["aim-code"],
    tags:     ["Workshop"],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // NUR ZUR ANSICHT – frei erfundene Altbeiträge, damit die Liste "Older news"
  // und der Jahresfilter im Layout sichtbar sind. Vor Go-Live ersatzlos
  // löschen oder durch echte Beiträge ersetzen.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id:       "info-evenings-winter-2025",
    title:    "First info evenings for the winter semester in Munich",
    date:     "2025-10-28",
    excerpt:  "Two open evenings introduced the programs to prospective members ahead of the application deadline.",
    body: [
      "Two open evenings in Munich introduced the OneAIM programs to prospective members ahead of the application deadline.",
      "Current participants walked through what a semester actually looks like: the visits, the workload, the makeathon. They also answered questions from students weighing an application alongside their degree.",
    ],
    cities:   ["munich"],
    tags:     ["Event"],
  },
  {
    id:       "medtech-congress-2025",
    title:    "OneAIM represented at the MedTech congress",
    date:     "2025-09-12",
    excerpt:  "Members joined panels on clinical AI and met potential partners from industry and research.",
    body: [
      "OneAIM members attended this year's MedTech congress, joining sessions on clinical AI and regulatory practice.",
      "Beyond the panels, the congress served as a meeting point: several conversations there led to follow-up discussions with potential partners from industry and research.",
    ],
    cities:   ["munich"],
    tags:     ["Conference", "Partnership"],
  },
  {
    id:       "aim-code-summer-2025-wrap",
    title:    "AIM Code wraps up its summer semester cohort",
    date:     "2025-06-30",
    excerpt:  "The final session closed a semester of Python and machine-learning workshops built on healthcare datasets.",
    body: [
      "The summer semester cohort of AIM Code finished with its closing session. Over the semester the group worked through Python fundamentals, data handling and a first pass at machine learning, using healthcare datasets throughout.",
      "The final week was given over to participants' own small projects, presented to the group.",
    ],
    cities:   ["munich"],
    programs: ["aim-code"],
  },
  {
    id:       "aim-educate-public-lectures-2025",
    title:    "AIM Educate opens its lecture series to the public",
    date:     "2025-04-15",
    excerpt:  "Talks on medical AI moved to an open format, with no registration required.",
    body: [
      "AIM Educate moved to a fully open format this year. Lectures on medical AI now run without registration and without prerequisites. Anyone interested can simply turn up.",
      "The change followed consistent feedback that the most valuable part of the series was the discussion afterwards, which worked better with a broader and more mixed audience.",
    ],
    cities:   ["munich"],
    programs: ["aim-educate"],
    tags:     ["Event"],
  },
  {
    id:       "aachen-chapter-announced",
    title:    "Aachen announced as the second OneAIM chapter",
    date:     "2024-11-20",
    excerpt:  "A student team at RWTH began building the groundwork for a second location alongside Munich.",
    body: [
      "OneAIM is expanding beyond Munich. A student team at RWTH Aachen has begun building the groundwork for a second chapter, with the first programs planned for the following academic year.",
      "The Aachen chapter will run the same program formats on the shared OneAIM blueprint, with its own local partners and its own team.",
    ],
    cities:   ["aachen"],
    tags:     ["Announcement"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

/** Alle Beiträge, neueste zuerst. */
export function getSortedNews(): NewsItem[] {
  return [...newsItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/** Die N neuesten Beiträge (z. B. für eine "Latest News"-Sektion). */
export function getLatestNews(count = 3): NewsItem[] {
  return getSortedNews().slice(0, count);
}

/**
 * Die neuesten Beiträge zu einem Standort – speist das News-Band auf den
 * Standortseiten (CityBlueprint.astro). Gefiltert wird über das Feld
 * `cities`, sortiert nach Datum. Ein neuer Beitrag mit passendem Slug
 * erscheint dort damit automatisch, ohne die Seite anzufassen.
 */
export function getNewsByCity(city: CitySlug, count = 2): NewsItem[] {
  return getSortedNews()
    .filter(item => item.cities?.includes(city))
    .slice(0, count);
}

/** Alle im Bestand vorkommenden Jahre, absteigend – für den Jahresfilter. */
export function getNewsYears(): number[] {
  const years = new Set(newsItems.map(n => Number(n.date.slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}
