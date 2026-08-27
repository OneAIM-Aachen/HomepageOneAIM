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

/** Zeile der Programm-Timeline ("How the last batch went" im Connect-Panel). */
export interface TimelineRow {
  date: string;
  title: string;
  text: string;
  /** "hollow" = Bewerbungsschritt, "filled" = Termin, "accent" = Höhepunkt */
  dot?: "hollow" | "filled" | "accent";
  fixed?: boolean;
  partners?: { name: string; detail?: string; logo?: string; wide?: boolean }[];
}

/** Gesicherter Partner der kommenden Runde (Connect-Panel, "Already on board"). */
export interface SecuredPartner {
  name: string;
  text: string;
  /** Weiße Chips in der Detailkarte, z. B. ["Company visit", "Name · Position"] */
  chips?: string[];
  logo?: string;
}

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
  /**
   * Mehrere Hochschul-Logos – je ein weißer Chip im Hero, in dieser
   * Reihenfolge. Hat Vorrang vor `universityLogo` (Einzel-Logo).
   */
  universityLogos?: { src: string; alt: string }[];
  /** Voller Name der Universität – Alt-Text bzw. Ersatz ohne Logo */
  university?: string;
  /** Instagram-Handle, z. B. "@oneaim.munich" */
  instagram?: string;
  instagramHref?: string;
  /** Kontakt-E-Mail des Standorts – erscheint auf /contact */
  contactEmail?: string;

  // ── Programm-Panel (Entwurf 6a) ────────────────────────────
  /** Foto neben dem AIM-Connect-Intro ("AIM Connect is an exclusive …") */
  connectImage?: string;
  connectImageAlt?: string;
  /** Rückblick "How the last batch went" – ersetzt die Platzhalter-Timeline */
  connectPastTimeline?: TimelineRow[];
  /** Beschriftung des Rückblick-Umschalters (Standard: "How the last batch went") */
  connectPastToggleLabel?: string;
  /** Hinweistext über dem Rückblick, z. B. "Beispielprogramm aus München" */
  connectPastNote?: string;
  /**
   * Rückblick durch die Timelines anderer Städte ersetzen (mit Umschalter),
   * z. B. ["munich", "aachen"] für Standorte ohne eigenen Jahrgang.
   */
  connectExampleFrom?: CitySlug[];
  /** Semester des letzten Jahrgangs, z. B. "SS 26" – Beschriftung über dem Rückblick */
  connectPastTerm?: string;
  /** "Already on board for the next batch" – gesicherte Partner der kommenden Runde */
  connectSecuredPartners?: SecuredPartner[];
  /** Feste Termine der kommenden Runde (nach den Bewerbungsschritten in der Timeline) */
  connectUpcomingEvents?: TimelineRow[];
  /**
   * true = AIM-Innovate-Tab im Programm-Panel anzeigen (Standorte, die
   * das Programm anbieten – aktuell München).
   */
  showInnovate?: boolean;
  /**
   * true = Teilnahmegebühr-Karte im Connect-Panel anzeigen (Betrag und
   * Leistungen stehen im Panel). Ohne Flag entfällt die Karte.
   */
  connectShowFee?: boolean;
  /**
   * true = AIM Code ist an diesem Standort noch im Aufbau: das Code-Panel
   * zeigt statt Rückblick und Anmelde-Button einen "Coming soon"-Hinweis.
   * Entfernen, sobald der erste Kurs feststeht.
   */
  codeComingSoon?: boolean;

  /**
   * false = AIM Code an diesem Standort komplett ausblenden (kein Tab im
   * Programm-Panel). Weglassen oder true = Tab wird angezeigt.
   */
  showCode?: boolean;

  // ── "The chapter"-Band (Entwurf 2a) ────────────────────────
  /** Eigene Überschrift statt "Rooted in [City], part of something bigger" */
  introHeading?: string;
  /**
   * Kompletter Absatz statt des Standardsatzes ("… was founded in … by
   * students of …") plus `story`. Wer das setzt, schreibt den ganzen Text.
   */
  introText?: string;
  /** Gründungsjahr des Chapters, z. B. 2025 */
  foundedYear?: number | string;
  /** Gründende Hochschule(n) als Fließtext, z. B. "RWTH Aachen" */
  universities?: string;
  /** 1–2 freie Sätze: Entstehung, heutige Aktivitäten, lokale Partner */
  story?: string;
  introImage?: string;
  introImageAlt?: string;
}

// AIM-Connect-Rückblick des Münchner Jahrgangs. Wird auch auf der
// Frankfurt-Seite als Beispielprogramm eingebunden, solange es dort
// noch keinen eigenen Jahrgang gibt.
const munichConnectTimeline: TimelineRow[] = [
      { date: "24–26 Apr", dot: "filled", title: "Kickoff Weekend",
        text: "Three days in Berlin: intro talks, team building and the first partner sessions.",
        partners: [
          { name: "AMBOSS",
            detail: "Madjid Salimi (Founder & CEO), Valentin von Seggern (Head of AI)",
            logo: "/images/partners/amboss-icon.svg" },
          { name: "Heidi Health",
            detail: "Franz Lesche",
            logo: "/images/partners/heidi-health-icon.svg" },
          { name: "Charité",
            detail: "Laura Velezmoro",
            logo: "/images/partners/charite-icon.jpg" },
          { name: "Heal Capital",
            detail: "Dr. Lucas Mittelmeier",
            logo: "/images/partners/heal-capital-icon.jpg" },
        ] },
      { date: "[Week 1]", dot: "filled", title: "Clinic: Visit",
        text: "Pick one department: neurosurgery, heart surgery, medical laboratory or pathology.",
        partners: [
          { name: "LMU Klinikum",
            logo: "/images/partners/lmu-klinikum-icon.png" },
        ] },
      { date: "[Week 2]", dot: "filled", title: "Clinic: Focus Session",
        text: "Challenges of bringing technological innovation into everyday clinical practice.",
        partners: [
          { name: "LMU Klinikum",
            detail: "Prof. Konstantinos Dimitriadis",
            logo: "/images/partners/lmu-klinikum-icon.png" },
        ] },
      { date: "[Week 3]", dot: "filled", title: "Startup: Visit",
        text: "Visit to Avelios Medical, the Munich hospital software startup.",
        partners: [
          { name: "Avelios Medical",
            detail: "Dr. Sebastian Krammer (Co-Founder & CMO)",
            logo: "/images/partners/avelios-icon.png" },
        ] },
      { date: "[Week 4]", dot: "filled", title: "Research: Focus Session",
        text: "Visit to the CAMP chair (Computer Aided Medical Procedures) at TUM.",
        partners: [
          { name: "CAMP, TUM",
            detail: "Prof. Nassir Navab",
            logo: "/images/partners/tum.png" },
        ] },
      { date: "[Week 5]", dot: "filled", title: "Research: Visit",
        text: "Tour of the Interfaculty Center for Endocrine and Cardiovascular Disease Network Modeling and Clinical Transfer at LMU Munich.",
        partners: [
          { name: "ICON, LMU Munich",
            detail: "PD Dr. med. Sebastian Clauss (Managing Director & Scientific Coordinator)",
            logo: "/images/universities/lmu-icon.svg" },
        ] },
      { date: "[Week 6]", dot: "filled", title: "Corporate: Focus Session",
        text: "Deep dive into cardiopulmonary technology: manufacturing and technology behind a heart-lung machine.",
        partners: [
          { name: "LivaNova",
            detail: "Timón D. Riedel, Christian Hofstetter, Lena Kohnen",
            logo: "/images/partners/livanova-icon.jpeg" },
        ] },
      { date: "[Week 7]", dot: "filled", title: "Startup: Focus Session",
        text: "Digital twins of the lung: Founding journey, lab to finding investors, and how patient-specific lung models could improve ventilation and drug delivery.",
        partners: [
          { name: "Ebenbuild",
            detail: "Dr. Kei Wieland Müller (CEO & Co-Founder), Dr. Maximilian Grill (CCO)",
            logo: "/images/partners/ebenbuild-icon.png" },
        ] },
      { date: "[Week 8]", dot: "filled", title: "Corporate: Focus Session",
        text: "Hands-on at Smith+Nephew: a hip replacement in virtual reality and robotic bone removal for a knee endoprosthesis.",
        partners: [
          { name: "Smith+Nephew",
            detail: "Dr. Martin Alston Bauer, Clara Maier, Klaudja Ograja",
            logo: "/images/partners/smith-nephew-icon.png" },
        ] },
      { date: "26–28 Jun", dot: "accent", title: "Make-A-Thon",
        text: "An intensive build weekend in partnership with Strategy&: [n] teams turned their projects into prototypes.",
        partners: [
          { name: "Strategy&",
            detail: "Makeathon partner",
            logo: "/images/partners/strategyand.png",
            wide: true },
        ] },
      { date: "30 Jun", dot: "accent", title: "Summit",
        text: "The closing event: final pitches in front of partners and guests." },
    ];

// AIM-Connect-Rückblick des Aachener Jahrgangs (auch Beispielprogramm für Frankfurt).
const aachenConnectTimeline: TimelineRow[] = [
      { date: "24–26 Apr", dot: "filled", title: "Kickoff Weekend",
        text: "Getting to know the Berlin MedTech startup scene, from seed round to unicorn.",
        partners: [
          { name: "AMBOSS",
            detail: "Madjid Salimi (Founder & CEO), Valentin von Seggern (Head of AI)",
            logo: "/images/partners/amboss-icon.svg" },
          { name: "SynagenAI",
            detail: "Christiane Höper (CMO), Dyke Ferber (CTO)",
            logo: "/images/partners/synagen-ai-icon.svg" },
          { name: "Elucid",
            detail: "Julius Emmerich (Founder & CEO)",
            logo: "/images/partners/elucid.svg" },
        ] },
      { date: "[Week 1]", dot: "filled", title: "Expert Session: Artificial Heart Pumps",
        text: "How mechanical pumps support failing hearts, straight from clinical practice.",
        partners: [
          { name: "Uniklinik RWTH Aachen",
            detail: "PD Dr. Jörg Schröder",
            logo: "/images/partners/uk-aachen.svg" },
        ] },
      { date: "[Week 2]", dot: "filled", title: "OR Visit: Artificial Heart Pumps",
        text: "Inside the operating room: heart pump surgery up close.",
        partners: [
          { name: "Uniklinik RWTH Aachen",
            logo: "/images/partners/uk-aachen.svg" },
        ] },
      { date: "[Week 3]", dot: "filled", title: "Expert Session: Medical Robotics",
        text: "Guest lecture on the state of the art in medical robotics.",
        partners: [
          { name: "Imperial College London",
            detail: "Prof. Ferdinando Rodriguez y Baena (Director, Hamlyn Centre for Medical Robotics)",
            logo: "/images/partners/imperial-crest.png" },
        ] },
      { date: "[Week 4]", dot: "filled", title: "Expert Session: Big Data for Medicine",
        text: "What large-scale health data can and cannot tell us about patients.",
        partners: [
          { name: "Uniklinik RWTH Aachen",
            detail: "Prof. Caroline Schneider (Professor for Big Data in Medicine, Forbes 30 Under 30)",
            logo: "/images/partners/uk-aachen.svg" },
        ] },
      { date: "[Week 5]", dot: "filled", title: "MRI & AI Visit",
        text: "The development of AI in medical image analysis, plus a live MRI demonstration.",
        partners: [
          { name: "RWTH Aachen",
            detail: "Prof. Daniel Truhn (Professor for AI in Medicine)",
            logo: "/images/partners/rwth-aachen.svg" },
        ] },
      { date: "[Week 6]", dot: "filled", title: "Hands-on Workshop: Medical Robotics",
        text: "Steering OR robots yourself at RWTH's Chair of Medical Engineering.",
        partners: [
          { name: "mediTEC",
            detail: "Prof. Klaus Radermacher",
            logo: "/images/partners/meditec-icon.png" },
        ] },
      { date: "[Week 7–9]", dot: "filled", title: "Project Preparation Sessions",
        text: "Three sessions to get your team project ready for the Make-A-Thon.",
        partners: [
          { name: "digitalHUB Aachen",
            detail: "How to: User interview, with Malvine Klecha",
            logo: "/images/partners/digitalhub-aachen-icon.svg" },
          { name: "AppInnovators",
            detail: "How to: Code with AI, with David Forster (Founder)",
            logo: "/images/partners/appinnovators-icon.png" },
          { name: "With Love and Data",
            detail: "How to: Start-up pitch, with Alex Jacobi (Serial Founder)",
            logo: "/images/partners/withloveanddata-icon.png" },
        ] },
      { date: "26–28 Jun", dot: "accent", title: "Make-A-Thon",
        text: "An intensive build weekend: 5 teams turned their projects into prototypes." },
      { date: "30 Jun", dot: "accent", title: "OneAIM x CSI Summit",
        text: "The closing event: final pitches in front of partners and guests.",
        partners: [
          { name: "CSI Aachen",
            detail: "Host",
            logo: "/images/partners/csi_logo.svg",
            wide: true },
        ] },
    ];

export const cityData: Record<CitySlug, CityData> = {
  munich: {
    slug:        "munich",
    displayName: "Munich",
    coords:      { lon: 11.582, lat: 48.1351 },
    uniShort:    "LMU · TUM",
    // Bild: "Frauenkirche Munich - View from Peterskirche Tower" von Diliff
    // (Wikimedia Commons, CC BY 2.5) – Bildnachweis siehe Impressum.
    heroImage:    "/images/cities/munich-hero.jpg",
    heroImageAlt: "View over Munich with the Frauenkirche",
    // Hochschul-Logos: TUM/LMU liegen bereits unter /images/partners/.
    universityLogos: [
      { src: "/images/partners/tum.png", alt: "Technische Universität München (TUM)" },
      { src: "/images/universities/lmu-icon.svg", alt: "Ludwig-Maximilians-Universität München (LMU)" },
    ],
    universities: "TUM and LMU",
    codeComingSoon: true,
    showInnovate: true,
    foundedYear:  2023,
    introHeading: "Where it all started",
    introText:
      "OneAIM Munich was founded in 2023, back when OneAIM was still a " +
      "single chapter and simply called OneAIM. Students of LMU and TUM " +
      "started it to bridge the gap between medicine, engineering and " +
      "business, bringing together everything it takes for MedTech " +
      "innovation. With the first programs and the development of AIM " +
      "Connect, AIM Innovate and AIM Code, Munich laid the foundation for a " +
      "community that is now growing all across Germany.",
    connectImage:    "/images/cities/munich-connect.jpg",
    connectImageAlt: "AIM Connect Munich cohort at the Brandenburg Gate during the Berlin kickoff weekend",
    connectUpcomingEvents: [
      { date: "16–18 Oct", dot: "filled", fixed: true, title: "Kickoff Weekend in Berlin",
        text: "Meet the cohort: team building and intro talks." },
      { date: "Week 1–8", dot: "filled", title: "Partner visits & workshops",
        text: "One visit or workshop per week with our partners: hospitals, labs, MedTech companies and startups. Visits take place on Tuesdays at 5 pm." },
      { date: "11–13 Dec", dot: "accent", fixed: true, title: "Make-A-Thon",
        text: "An intensive build weekend. Your team turns its project into a prototype." },
      { date: "15 Dec", dot: "accent", fixed: true, title: "Summit",
        text: "The closing event: final pitches in front of partners and guests." },
    ],
    connectPastTerm: "SS 26",
    connectPastTimeline: munichConnectTimeline,
    // TODO: foundedYear, story, …
    instagram:     "@oneaim.munich",
    instagramHref: "https://www.instagram.com/oneaim.munich/",
    contactEmail:  "contact@one-aim.org",
  },
  aachen: {
    slug:        "aachen",
    introHeading: "The first chapter outside of Munich",
    displayName: "Aachen",
    coords:      { lon: 6.0839, lat: 50.7753 },
    uniShort:    "RWTH",
    // Bild: "Aachen, Dom -- 2016 -- 2768" von Dietmar Rabich
    // (Wikimedia Commons, CC BY-SA 4.0) – Bildnachweis siehe Impressum.
    heroImage:    "/images/cities/aachen-hero.jpg",
    heroImageAlt: "Aachen Cathedral",
    universityLogos: [
      { src: "/images/partners/rwth-aachen.svg", alt: "RWTH Aachen University" },
    ],
    connectImage:    "/images/cities/aachen-connect.jpg",
    connectImageAlt: "AIM Connect Aachen cohort at a partner visit",
    codeComingSoon: true,
    connectShowFee: true,
    connectUpcomingEvents: [
      { date: "23–25 Oct", dot: "filled", fixed: true, title: "Kickoff Weekend in Berlin",
        text: "Meet the cohort: team building and intro talks." },
      { date: "[Week 1–8]", dot: "filled", title: "Partner visits & workshops",
        text: "One visit or workshop per week with our partners: hospitals, labs, MedTech companies and startups. Most visits take place on Tuesday afternoons; exact times will be communicated in October." },
      { date: "15–17 Jan", dot: "accent", fixed: true, title: "Make-A-Thon",
        text: "An intensive build weekend. Your team turns its project into a prototype." },
      { date: "19 Jan", dot: "accent", fixed: true, title: "OneAIM x CSI Summit",
        text: "The closing event: final pitches in front of partners and guests." },
    ],
    connectSecuredPartners: [
      { name: "Abiomed (Johnson & Johnson MedTech)",
        text: "Company visit at Abiomed, the heart pump pioneer from Aachen, with founder and CTO Dr. Thorsten Sieß.",
        chips: ["Company visit", "Dr. Thorsten Sieß · Founder & CTO"],
        logo: "/images/partners/abiomed.svg" },
      { name: "Harvard University",
        text: "Presentation and discussion with Prof. Leo Celi on the risks and benefits of AI in healthcare.",
        chips: ["Presentation & discussion", "Prof. Leo Celi · Professor for AI in Critical Care"],
        logo: "/images/partners/harvard-shield.svg" },
      { name: "Uniklinik RWTH Aachen",
        text: "OR visit at the Uniklinik: experience surgery and medical technology up close.",
        chips: ["OR visit"],
        logo: "/images/partners/uk-aachen.svg" },
      { name: "Vivalyx",
        text: "Startup visit at Vivalyx, the Aachen company developing organ perfusion technology for transplantation.",
        chips: ["Startup visit", "Organ perfusion"],
        logo: "/images/partners/vivalyx.png" },
      { name: "RWTH Aachen",
        text: "MRI & AI session with Prof. Daniel Truhn: how AI is changing medical image analysis.",
        chips: ["MRI & AI", "Prof. Daniel Truhn · Professor for AI in Medicine"],
        logo: "/images/partners/rwth-aachen.svg" },
    ],
    connectPastTerm: "SS 26",
    connectPastTimeline: aachenConnectTimeline,
    universities: "RWTH Aachen",
    foundedYear:  2025,
    story:
      "As the first chapter beyond Munich, Aachen turned OneAIM from a " +
      "local initiative into a growing network across Germany. Today the " +
      "team runs AIM Connect and AIM Code right here in the city, hand in " +
      "hand with Aachen's remarkable MedTech scene: global players like " +
      "Abiomed (Johnson & Johnson MedTech), Uniklinik RWTH Aachen, a " +
      "vibrant startup community and many more local and international " +
      "partners.",
    instagram:     "@oneaimaachen",
    instagramHref: "https://www.instagram.com/oneaimaachen/",
    contactEmail:  "aachen@one-aim.org",
  },
  frankfurt: {
    slug:        "frankfurt",
    showCode:    false,
    connectImage:    "/images/cities/frankfurt-connect.jpg",
    connectImageAlt: "The OneAIM cohort at the kickoff event",
    introHeading: "The third OneAIM Chapter",
    introText:
      "OneAIM Frankfurt was founded by students of Goethe University, Frankfurt " +
      "School and TU Darmstadt who wanted to bridge the gap between medical " +
      "innovation in the Frankfurt and Darmstadt area and the finance industry in " +
      "Frankfurt. By bringing medicine, technology and capital together, the " +
      "chapter builds the stack needed to turn MedTech ideas into solutions that " +
      "reach patients.",
    connectPastToggleLabel: "Example program",
    connectPastNote:
      "This will be the first AIM Connect batch in Frankfurt, so there is no past " +
      "batch to look back on yet. The timeline below shows the program of other " +
      "cities as an example: it is representative of the general structure of " +
      "AIM Connect, but Frankfurt will run its sessions with local partners.",
    connectExampleFrom: ["munich", "aachen"],
    connectUpcomingEvents: [
      { date: "24–25 Oct", dot: "filled", fixed: true, title: "Kickoff Weekend in Frankfurt",
        text: "Meet the cohort: team building and intro talks." },
      { date: "[Week 1–8]", dot: "filled", title: "Partner visits & workshops",
        text: "One visit or workshop per week with our partners: hospitals, labs, MedTech companies and startups. Exact dates will be announced." },
      { date: "Jan", dot: "accent", title: "Make-A-Thon",
        text: "An intensive build weekend. Your team turns its project into a prototype. The exact date will be announced." },
      { date: "Jan", dot: "accent", title: "Summit",
        text: "The closing event: final pitches in front of partners and guests. The exact date will be announced." },
    ],
    displayName: "Frankfurt",
    coords:      { lon: 8.6821, lat: 50.1109 },
    uniShort:    "Goethe Uni",
    // Bild: "Frankfurt am Main, Römer -- 2015 -- 6695-9" von Dietmar Rabich
    // (Wikimedia Commons, CC BY-SA 4.0) – Bildnachweis siehe Impressum.
    heroImage:    "/images/cities/frankfurt-hero.jpg",
    heroImageAlt: "The Römer in Frankfurt am Main",
    universityLogos: [
      { src: "/images/universities/goethe-uni-icon.svg",       alt: "Goethe University Frankfurt" },
      { src: "/images/universities/frankfurt-school-icon.svg", alt: "Frankfurt School of Finance & Management" },
      { src: "/images/universities/tu-darmstadt.svg",     alt: "TU Darmstadt" },
    ],
    universities: "Goethe University, Frankfurt School and TU Darmstadt",
    // TODO: foundedYear, story, …
    instagram:     "@oneaim.frankfurt",
    instagramHref: "https://www.instagram.com/oneaim.frankfurt/",
    contactEmail:  "frankfurt@one-aim.org",
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
