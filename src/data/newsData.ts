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
// ─────────────────────────────────────────────────────────────────────────────

export const newsItems: NewsItem[] = [
  {
    id:       "frankfurt-chapter-announced",
    title:    "The third chapter of OneAIM has begun!",
    date:     "2026-08-09",
    excerpt:  "OneAIM goes Frankfurt!",
    body: [
      "After establishing ourselves in Aachen last year, we are proud to announce that Frankfurt is the next step in our journey!",
      "Together with Goethe University Frankfurt, Frankfurt School, and TU Darmstadt, we are excited to connect with many new students from different fields, all sharing one common mission: improving the future of healthcare!",
      "We are happy to see our network growing and can’t wait to discover all the new adventures and opportunities that await us in our new location.",
      "Over the next week, we’ll give you a closer look at what we have in store for you. So make sure to follow our socials and stay tuned!",
    ],
    image:    "/images/news/oneaim-logo.png",
    imageAlt: "The OneAIM logo",
    cities:   ["frankfurt"],
    programs: ["aim-connect"],
  },
  {
    id:       "aachen-semester-wrapup-2026",
    title:    "Semester Wrap-Up Aachen",
    date:     "2026-08-19",
    excerpt:  "Let's take a look back at what we achieved during our first batch in Aachen!",
    body: [
      "It all started with our Kickoff Weekend in April, where we brought together 16 highly motivated students from diverse academic backgrounds in Berlin to visit three innovative MedTech startups.",
      "What followed were eight exciting weeks full of insights into the world of MedTech, from research and industry to startups. Our participants also had the opportunity to develop their skills in creating and pitching ideas during our Make-A-Thon workshops.",
      "Our Summit in cooperation with CSI Aachen marked the grand finale of our first batch. It gave our students the chance to pitch their ideas in front of an expert jury and the audience, followed by a shared buffet where everyone could connect and wrap up the program together.",
      "A huge thank you to everyone who made this program possible. From our visiting partners to our participants: without you, this program wouldn’t have been possible!",
      "Applications for the next batch will open soon, and we already have some exciting things in store for you. So stay tuned!"
    ],
    image:    "/images/news/aachen-wrapup-2026.jpg",
    imageAlt: "The first Aachen batch with their certificates at the OneAIM x CSI Summit",
    cities:   ["aachen"],
    programs: ["aim-connect"],
    tags:     ["Wrap-Up"],
  },
  {
    id:       "aachen-summit-makeathon-2026",
    title:    "Summit & Make-A-Thon Aachen 2026",
    date:     "2026-06-30",
    excerpt:  "CSI x OneAIM Summit Summer 2026",
    body: [
      "After an intensive Make-A-Thon weekend, our participants had the opportunity to present the results of their semester projects on our Summit hosted together with CSI Aachen!",
      "During the semester, they worked in small teams with different academic backgrounds to figure out solutions in the area of intelligent wearables, AI-based healthcare chatbots and software monitoring your vital status. All of these problems were real challenges given by our partners.",
      "In the end, the idea of an app assisting women during menopause convinced our expert jury the most and earned the first prize. After the presentations, our participants, jury members and the OneAIM team had the opportunity to get together at our buffet and talk together in a relaxed atmosphere.",
      "A huge thank you to everyone who supported our program during this semester, including our visit partners, the jury members, CSI Aachen and of course our participants who enriched our program with their creativity!",
      "We are already looking forward to the upcoming programs and events!"
    ],
    image:    "/images/news/aachen-summit-2026.jpg",
    imageAlt: "The audience at the OneAIM x CSI Summit in Aachen",
    cities:   ["aachen"],
    programs: ["aim-connect"],
    tags:     ["Make-A-Thon"],
  },
  {
    id:       "munich-summit-makeathon-2026",
    title:    "Summit & Make-A-Thon Munich 2026",
    date:     "2026-06-30",
    excerpt:  "OneAIM Summit Summer 2026",
    body: [
      "It all began with our Kickoff at the Strategy& office, where the HealthTech challenge was introduced, teams came together and the evening continued over dinner. In the following weeks, our batch participants had the opportunity to develop their ideas together to make them ready for the big stage. ",
      "Today, everything came together and each team delivered brilliant pitches of their solutions of real-world healthcare problems. In addition to that, our keynote speakers Simone M. Giehl (Strategy& Manager Pharma & LifeScience) and Jennifer Altomonte (Managing Director & CSO, Fusix Biotech) provided us with inspiring insights into their experience in MedTech.",
      "To everyone who joined, pitched, or simply showed up curious: Thank you for making this year's OneAIM Summit such a great evening!",
    ],
    image:    "/images/about/codelab.jpg",
    imageAlt: "Students in an AIM Code programming course",
    cities:   ["munich"],
    programs: ["aim-connect"],
    tags:     ["Make-A-Thon"],
  },

  {
    id:       "aim-code-summer-2026-recap",
    title:    "AIM Code Summer 2026 Recap",
    date:     "2026-07-14",
    excerpt:  "Another successful semester with AIM Code has officially wrapped up!",
    body: [
      "With our AIM Code program, we offer elective courses for preclinical medical students and a CodeLab open to all students interested in learning programming.",
      "During this semester, we accompanied and assisted our participants on their journey from writing their very first lines of Python to training their first Convolutional Neural Network and diving into Deep Learning.",
      "Thank you to our teaching team consisting of Jonathan Welte, Michael Röhrl, Nikita Z., Martin Zborowski, Rafi Al Attrach and Rajna Fani who made this program possible. We are already looking forward to next semester, when the AIM Code program will also arrive at our fellows in Aachen!"
    ],
    image:    "/images/about/codelab.jpg",
    imageAlt: "Students in an AIM Code programming course",
    cities:   ["munich"],
    programs: ["aim-code"],
    tags:     ["Event"],
  },
  {
    id:       "aim-innovate-winter-2025-recap",
    title:    "AIM Innovate Winter 2025/26 Recap",
    date:     "2026-05-18",
    excerpt:  "Let's take a step back and revisit our journey across the MedTech innovation landscape!",
    body: [
      "With our AIM Innovate program, we want to introduce our participants into the end-to-end journey of innovation in healthcare: From legal foundations and regulatory pathways to venture capital, product development and digital therapies!",
      "This year, we went from patent law firms (Bardehle Pagenberg) to clinical trials (Brainlab) and regulatory institutions (TÜV SÜD) before exploring the entrepreneurial side of healthcare with Restone and Ebenbuild. Finally, we had the opportunity at Smith+Nephew and Cogthera to explore how innovation translated into real patient outcomes.",
      "A huge thank you to all partners and participants without whom this program would not have been possible!",
    ],
    image:    "/images/about/codelab.jpg",
    imageAlt: "Students in an AIM Code programming course",
    cities:   ["munich"],
    programs: ["aim-innovate"],
    tags:     ["Conference", "Partnership"],
  },
  {
    id:       "start-labs-medtech-2026",
    title:    "START Labs: MedTech Edition",
    date:     "2026-05-17",
    excerpt:  "OneAIM meets START Munich!",
    body: [
      "At the Launch Night, OneAIM and START Munich brought together 2x more participants than last year and the event was fully booked 3 days in advance.",
      "Following the keynotes on building and scaling in MedTech by Dr. Nicolai Heinzelmann (TUM Venture Labs) and Hannes Funk (Cogthera), the presenters started to pitch their fascinating startup concepts:",
      "Together with Helmholtz Munich, presented by Matthias Hehr: How do you build a “control tower” for clinical AI ensuring models remain safe and reliable long after deployment inside hospitals?",
      "Together with LMU Klinikum München, presented by Prof. Dr. Solveig Vieluf, Prof. Dr. Stefan Brunner and Iraklis Kolokas: How do you turn a smartphone into a biomechanical lab, detecting injury risks in runners in real training conditions?",
      "Together with Custom Surgical: How do you bring AI directly into ophthalmic microsurgery tracking instruments in 3D, analyzing movement efficiency, and detecting deviations in real time?",
      "These are not feature ideas. They are entry points into systems that affect millions."
    ],
    image:    "/images/news/start-labs-2026.jpg",
    imageAlt: "The audience at the START Labs MedTech Edition launch night",
    cities:   ["munich"],
  },
  {
    id:       "aachen-kickoff-summer-2026",
    title:    "AIM Connect Aachen Kickoff Summer 2026",
    date:     "2026-05-03",
    excerpt:  "Startup Visits & Insights into the World of AI in Medicine",
    body: [
      "Last weekend, the first AIM Connect Aachen batch ever started gaining insights into the world of AI in medicine and MedTech!",
      "During our stay in Berlin, we had our first visit at SynagenAI where Dyke Ferber and Christiane Höper introduced us into the process of tumor board preparation and methods for AI to tackle this problem.",
      "At Amboss, we got hosted by their CEO and founder Madjid Salimi and their head of AI Valentin von Seggern. There we also met our fellows from OneAIM Munich for the first time. In a warm atmosphere (and unlimited drinks and homemade Argentinian barbecue for 70 students!) they gave us an insight into how Amboss is moving from a small medical student study to a clinical AI partner for doctors.",
      "Our last visit was Elucid, a social medicine startup that provides healthcare and health insurance to over 100,000 farmers in globally underserved areas. There Julius Emmerich gave us insights into how a startup can have large social impact while still operating economically.",
      "Overall, it was an amazing weekend with awesome people! We are really looking forward to all upcoming events!"
    ],
    image:    "/images/news/aachen-kickoff-2026.jpg",
    imageAlt: "The AIM Connect cohorts in front of the BIH Charité building in Berlin",
    cities:   ["aachen"],
    programs: ["aim-connect"],
    tags:     ["Kickoff"],
  },
  {
    id:       "aachen-chapter-announced",
    title:    "OneAIM is coming to Aachen!",
    date:     "2025-10-20",
    excerpt:  "Next semester, we will have an AIM Connect program in Aachen for the very first time!",
    body: [
      "After having launched in Munich in 2023, we can finally announce that the second chapter has officially started in Aachen! Just like our fellows in Munich, our AIM Connect program will consist of various workshops and visits in industry, research and startups with focus on MedTech.",
      "We aim to bring together motivated students from medicine, business, engineering and related fields who are interested in shaping the future of healthcare. More information will follow soon, so stay tuned!",
    ],
    image:    "/images/news/oneaim-logo.png",
    imageAlt: "The OneAIM logo",
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

/** Die neuesten Beiträge zu einem Programm (Slug aus programs.ts) – für die Programmseiten. */
export function getNewsByProgram(program: string, count = 3): NewsItem[] {
  return getSortedNews()
    .filter(item => item.programs?.includes(program))
    .slice(0, count);
}

/** Alle im Bestand vorkommenden Jahre, absteigend – für den Jahresfilter. */
export function getNewsYears(): number[] {
  const years = new Set(newsItems.map(n => Number(n.date.slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}
