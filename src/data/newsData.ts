// src/data/newsData.ts
//
// DUMMY-DATEN. Alle Einträge sind Platzhalter und müssen vor Veröffentlichung
// durch echte News ersetzt werden. Struktur ist bewusst einfach gehalten,
// damit sie später 1:1 in eine Astro Content Collection migriert werden kann
// (siehe Kommentar am Ende der Datei).

export interface NewsItem {
  title: string;
  date: string; // ISO-Format YYYY-MM-DD
  excerpt: string;
}

export const newsItems: NewsItem[] = [
  {
    title: "AIM Connect Aachen startet mit erster Kohorte",
    date: "2026-04-14",
    excerpt:
      "Der neue Standort Aachen begrüßt die erste Gruppe von Teilnehmenden im AIM Connect Programm – mit Besuchen bei regionalen Kliniken und HealthTech-Start-ups.",
  },
  {
    title: "Makeathon Summit München: Drei Teams ausgezeichnet",
    date: "2026-03-02",
    excerpt:
      "Zum Abschluss des aktuellen AIM Connect-Durchgangs präsentierten 20 Studierende ihre Lösungen vor Vertreter*innen aus Klinik und Industrie.",
  },
  {
    title: "Neue Kooperation mit einem Münchner Klinikpartner",
    date: "2026-01-20",
    excerpt:
      "OneAIM erweitert sein Partner-Netzwerk um eine weitere Klinik – Studierende erhalten dadurch zusätzliche Einblicke in den klinischen Alltag.",
  },
  {
    title: "AIM Code Bootcamp: Anmeldung für das Sommersemester offen",
    date: "2025-12-05",
    excerpt:
      "Ab sofort können sich Studierende für die kostenfreien AIM DataLab- und AIM CodeLab-Kurse im kommenden Semester bewerben.",
  },
];

/*
 * Hinweis für eine spätere Migration:
 * Bei wachsendem Umfang empfiehlt sich der Wechsel zu einer Astro Content
 * Collection (src/content/news/*.md) mit identischem Schema (title, date,
 * excerpt + optional body). Die Seite src/pages/news/index.astro müsste dann
 * lediglich die Datenquelle wechseln, die Darstellung (ListItemCard) bleibt
 * unverändert.
 */
