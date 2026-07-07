// src/data/newsData.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Einzige Datenquelle für alle News-Beiträge.
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  NEUEN BEITRAG ERGÄNZEN – zwei Schritte:                            ║
// ║  1. Vorschaubild nach public/images/news/ legen                     ║
// ║  2. Eintrag am Anfang des Arrays hinzufügen (Datum ISO: YYYY-MM-DD) ║
// ║  → Die Seite sortiert automatisch nach Datum (neueste zuerst).      ║
// ║  → Keine Komponente muss angefasst werden.                          ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// NEUE TAGS: Einfach als String in das tags-Array schreiben.
// Bekannte Tag-Kategorien (für Farbgebung in NewsCard.astro):
//   Standort:  "München" | "Aachen"
//   Programme: "AIM Connect" | "AIM Code" | "AIM Innovate" | "AIM Educate"
//   Events:    "Event" | "Workshop" | "Conference" | "Makeathon"
//   Sonstiges: "Research" | "Partnership" | "Announcement" | …
// ─────────────────────────────────────────────────────────────────────────────

export interface NewsItem {
  /** Eindeutiger Bezeichner (URL-sicher, wird für spätere Detailseiten genutzt) */
  id:        string;
  /** Titel des Beitrags – DUMMY, vor Go-Live ersetzen */
  title:     string;
  /** ISO-Datum YYYY-MM-DD – bestimmt die automatische Sortierung */
  date:      string;
  /** Kurzbeschreibung / Teaser – DUMMY, vor Go-Live ersetzen */
  excerpt:   string;
  /** Pfad zum Vorschaubild (relativ zu /public) – aktuell Platzhalter-SVG */
  image:     string;
  /** Alt-Text für Screenreader */
  imageAlt?: string;
  /** Frei definierbare Tags – beliebig erweiterbar */
  tags:      string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// News-Beiträge
// HINWEIS: Alle Inhalte sind Dummy-Daten – vor Go-Live durch echte Beiträge
// ersetzen. Neue Einträge werden vorne oder hinten eingefügt; die Sortierung
// auf der Seite übernimmt die Reihenfolge automatisch.
// ─────────────────────────────────────────────────────────────────────────────

export const newsItems: NewsItem[] = [
  {
    id:       "aim-connect-aachen-launch",
    title:    "AIM Connect Aachen startet mit erster Kohorte",                // DUMMY
    date:     "2026-04-14",
    excerpt:  "Der neue Standort Aachen begrüßt die erste Gruppe von Teilnehmenden im AIM Connect Programm – mit Besuchen bei regionalen Kliniken und HealthTech-Start-ups.",
    image:    "/images/news/news-1.svg",
    imageAlt: "Abbildung zum Launch von AIM Connect Aachen (Platzhalter)",
    tags:     ["Aachen", "AIM Connect"],
  },
  {
    id:       "makeathon-summit-muenchen-2026",
    title:    "Makeathon Summit München: Drei Teams ausgezeichnet",            // DUMMY
    date:     "2026-03-02",
    excerpt:  "Zum Abschluss des aktuellen AIM Connect-Durchgangs präsentierten 20 Studierende ihre Lösungen vor Vertreter*innen aus Klinik und Industrie.",
    image:    "/images/news/news-2.svg",
    imageAlt: "Bühne beim Makeathon Summit München (Platzhalter)",
    tags:     ["München", "AIM Connect", "Makeathon"],
  },
  {
    id:       "neue-kooperation-muenchen",
    title:    "Neue Kooperation mit einem Münchner Klinikpartner",             // DUMMY
    date:     "2026-01-20",
    excerpt:  "OneAIM erweitert sein Partner-Netzwerk um eine weitere Klinik – Studierende erhalten dadurch zusätzliche Einblicke in den klinischen Alltag.",
    image:    "/images/news/news-3.svg",
    imageAlt: "Handshake-Symbol für neue Kooperation (Platzhalter)",
    tags:     ["München", "Partnership"],
  },
  {
    id:       "aim-code-sommersemester-2025",
    title:    "AIM Code Bootcamp: Anmeldung für das Sommersemester offen",     // DUMMY
    date:     "2025-12-05",
    excerpt:  "Ab sofort können sich Studierende für die kostenfreien AIM DataLab- und AIM CodeLab-Kurse im kommenden Semester bewerben.",
    image:    "/images/news/news-4.svg",
    imageAlt: "Code-Symbole für das AIM Code Bootcamp (Platzhalter)",
    tags:     ["AIM Code", "Workshop", "München"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gibt alle News-Beiträge sortiert nach Datum zurück (neueste zuerst).
 * Wird von der News-Seite genutzt – kein manuelles Sortieren nötig.
 */
export function getSortedNews(): NewsItem[] {
  return [...newsItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Gibt die N neuesten Beiträge zurück (für eine "Latest News"-Sektion).
 */
export function getLatestNews(count = 3): NewsItem[] {
  return getSortedNews().slice(0, count);
}
