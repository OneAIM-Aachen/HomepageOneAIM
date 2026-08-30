// src/data/cityData.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Location database – single source for everything location-specific.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ADDING A NEW LOCATION – one step:                                       ║
// ║                                                                          ║
// ║  Add the slug to the CitySlug type and write an entry in `cityData`.     ║
// ║  After that, the following happens automatically:                        ║
// ║    • the page /<slug> is created (blueprint with placeholders)           ║
// ║    • the location appears in the header's "Locations" dropdown           ║
// ║    • the pin appears on the home page map                                ║
// ║    • the city counter in the hero counts up                              ║
// ║    • news/application/team entries can use the slug                      ║
// ║                                                                          ║
// ║  Leave optional fields empty → the blueprint shows placeholders.         ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// The content of a location page comes from THREE layers (in this
// order): explicit props on <CityBlueprint /> → this entry here
// → bracketed placeholders. Applications, news and team still fill in
// automatically from applications.ts, newsData.ts and teamData.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Row of the program timeline ("How the last batch went" in the Connect panel). */
export interface TimelineRow {
  date: string;
  title: string;
  text: string;
  /** "hollow" = application step, "filled" = scheduled event, "accent" = highlight */
  dot?: "hollow" | "filled" | "accent";
  partners?: { name: string; detail?: string; logo?: string; wide?: boolean }[];
}

/** Confirmed partner of the upcoming round (Connect panel, "Already on board"). */
export interface SecuredPartner {
  name: string;
  text: string;
  /** White chips in the detail card, e.g. ["Company visit", "Name · Position"] */
  chips?: string[];
  logo?: string;
  /** true = wide logo tile for wordmarks (instead of square) */
  wide?: boolean;
}

/** Canonical location slugs – the same everywhere in the project. */
export type CitySlug = "munich" | "aachen" | "frankfurt";

export interface CityData {
  slug: CitySlug;
  /** Display name, e.g. "Munich" */
  displayName: string;

  // ── Map on the home page (MapHero) ─────────────────────────
  /** Coordinates of the pin */
  coords: { lon: number; lat: number };
  /** Short label under the pin, e.g. "RWTH" or "LMU · TUM" */
  uniShort: string;

  // ── Hero of the location page (draft 15A) ──────────────────
  heroImage?: string;
  heroImageAlt?: string;
  /** University logo – white chip in the hero */
  universityLogo?: string;
  /**
   * Multiple university logos – one white chip each in the hero, in this
   * order. Takes precedence over `universityLogo` (single logo).
   */
  universityLogos?: { src: string; alt: string }[];
  /** Full name of the university – alt text or fallback without a logo */
  university?: string;
  /** Instagram handle, e.g. "@oneaim.munich" */
  instagram?: string;
  instagramHref?: string;
  /** Contact e-mail of the location – appears on /contact */
  contactEmail?: string;

  // ── Program panel (draft 6a) ───────────────────────────────
  /** Photo next to the AIM Connect intro ("AIM Connect is an exclusive …") */
  connectImage?: string;
  connectImageAlt?: string;
  /** Recap "How the last batch went" – replaces the placeholder timeline */
  connectPastTimeline?: TimelineRow[];
  /** Label of the recap toggle (default: "How the last batch went") */
  connectPastToggleLabel?: string;
  /** Note above the recap, e.g. "Example program from Munich" */
  connectPastNote?: string;
  /**
   * Replace the recap with the timelines of other cities (with a toggle),
   * e.g. ["munich", "aachen"] for locations without their own batch.
   */
  connectExampleFrom?: CitySlug[];
  /** Semester of the last batch, e.g. "SS 26" – label above the recap */
  connectPastTerm?: string;
  /** false = hide the "Already on board for the next batch" section */
  connectShowSecuredPartners?: boolean;
  /** "Already on board for the next batch" – confirmed partners of the upcoming round */
  connectSecuredPartners?: SecuredPartner[];
  /** Fixed dates of the upcoming round (after the application steps in the timeline) */
  connectUpcomingEvents?: TimelineRow[];
  /**
   * true = show the AIM Innovate tab in the program panel (locations that
   * offer the program – currently Munich).
   */
  showInnovate?: boolean;
  /**
   * true = show the participation fee card in the Connect panel (amount and
   * benefits are defined in the panel). Without the flag the card is omitted.
   */
  connectShowFee?: boolean;
  /**
   * true = AIM Code is still being set up at this location: the Code panel
   * shows a "Coming soon" note instead of the recap and sign-up button.
   * Remove once the first course is fixed.
   */
  codeComingSoon?: boolean;

  /**
   * false = hide AIM Code entirely at this location (no tab in the
   * program panel). Omit or true = the tab is shown.
   */
  showCode?: boolean;

  // ── "The chapter" band (draft 2a) ──────────────────────────
  /** Custom heading instead of "Rooted in [City], part of something bigger" */
  introHeading?: string;
  /**
   * Complete paragraph instead of the default sentence ("… was founded in … by
   * students of …") plus `story`. Whoever sets this writes the whole text.
   */
  introText?: string;
  /** Founding year of the chapter, e.g. 2025 */
  foundedYear?: number | string;
  /** Founding university/universities as prose, e.g. "RWTH Aachen" */
  universities?: string;
  /** 1–2 free-form sentences: origins, current activities, local partners */
  story?: string;
  introImage?: string;
  introImageAlt?: string;
}

// AIM Connect recap of the Munich batch. Also embedded on the
// Frankfurt page as an example program as long as there is no
// batch of its own there yet.
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
          { name: "Elucid",
            detail: "Julius Emmerich (Founder & CEO)",
            logo: "/images/partners/elucid.svg" },
        ] },
      { date: "Week 1", dot: "filled", title: "Clinic: Visit",
        text: "Pick one department: neurosurgery, heart surgery, medical laboratory or pathology.",
        partners: [
          { name: "LMU Klinikum",
            logo: "/images/partners/lmu-klinikum-icon.png" },
        ] },
      { date: "Week 2", dot: "filled", title: "Clinic: Focus Session",
        text: "Challenges of bringing technological innovation into everyday clinical practice.",
        partners: [
          { name: "LMU Klinikum",
            detail: "Prof. Konstantinos Dimitriadis",
            logo: "/images/partners/lmu-klinikum-icon.png" },
        ] },
      { date: "Week 3", dot: "filled", title: "Startup: Visit",
        text: "Visit to Avelios Medical, the Munich hospital software startup.",
        partners: [
          { name: "Avelios Medical",
            detail: "Dr. Sebastian Krammer (Co-Founder & CMO)",
            logo: "/images/partners/avelios-icon.png" },
        ] },
      { date: "Week 4", dot: "filled", title: "Research: Focus Session",
        text: "Visit to the CAMP chair (Computer Aided Medical Procedures) at TUM.",
        partners: [
          { name: "CAMP, TUM",
            detail: "Prof. Nassir Navab",
            logo: "/images/partners/tum.png" },
        ] },
      { date: "Week 5", dot: "filled", title: "Research: Visit",
        text: "Tour of the Interfaculty Center for Endocrine and Cardiovascular Disease Network Modeling and Clinical Transfer at LMU Munich.",
        partners: [
          { name: "ICON, LMU Munich",
            detail: "PD Dr. med. Sebastian Clauss (Managing Director & Scientific Coordinator)",
            logo: "/images/universities/lmu-icon.svg" },
        ] },
      { date: "Week 6", dot: "filled", title: "Corporate: Focus Session",
        text: "Deep dive into cardiopulmonary technology: manufacturing and technology behind a heart-lung machine.",
        partners: [
          { name: "LivaNova",
            detail: "Timón D. Riedel, Christian Hofstetter, Lena Kohnen",
            logo: "/images/partners/livanova-icon.jpeg" },
        ] },
      { date: "Week 7", dot: "filled", title: "Startup: Focus Session",
        text: "Digital twins of the lung: Founding journey, lab to finding investors, and how patient-specific lung models could improve ventilation and drug delivery.",
        partners: [
          { name: "Ebenbuild",
            detail: "Dr. Kei Wieland Müller (CEO & Co-Founder), Dr. Maximilian Grill (CCO)",
            logo: "/images/partners/ebenbuild-icon.png" },
        ] },
      { date: "Week 8", dot: "filled", title: "Corporate: Focus Session",
        text: "Hands-on at Smith+Nephew: a hip replacement in virtual reality and robotic bone removal for a knee endoprosthesis.",
        partners: [
          { name: "Smith+Nephew",
            detail: "Dr. Martin Alston Bauer, Clara Maier, Klaudja Ograja",
            logo: "/images/partners/smith-nephew-icon.png" },
        ] },
      { date: "26–28 Jun", dot: "accent", title: "Makeathon",
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

// AIM Connect recap of the Aachen batch (also the example program for Frankfurt).
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
      { date: "Week 1", dot: "filled", title: "Expert Session: Artificial Heart Pumps",
        text: "How mechanical pumps support failing hearts, straight from clinical practice.",
        partners: [
          { name: "Uniklinik RWTH Aachen",
            detail: "PD Dr. Jörg Schröder",
            logo: "/images/partners/uk-aachen.svg" },
        ] },
      { date: "Week 2", dot: "filled", title: "OR Visit: Artificial Heart Pumps",
        text: "Inside the operating room: heart pump surgery up close.",
        partners: [
          { name: "Uniklinik RWTH Aachen",
            logo: "/images/partners/uk-aachen.svg" },
        ] },
      { date: "Week 3", dot: "filled", title: "Expert Session: Medical Robotics",
        text: "Guest lecture on the state of the art in medical robotics.",
        partners: [
          { name: "Imperial College London",
            detail: "Prof. Ferdinando Rodriguez y Baena (Director, Hamlyn Centre for Medical Robotics)",
            logo: "/images/partners/imperial-crest.png" },
        ] },
      { date: "Week 4", dot: "filled", title: "Expert Session: Big Data for Medicine",
        text: "What large-scale health data can and cannot tell us about patients.",
        partners: [
          { name: "Uniklinik RWTH Aachen",
            detail: "Prof. Caroline Schneider (Professor for Big Data in Medicine, Forbes 30 Under 30)",
            logo: "/images/partners/uk-aachen.svg" },
        ] },
      { date: "Week 5", dot: "filled", title: "MRI & AI Visit",
        text: "The development of AI in medical image analysis, plus a live MRI demonstration.",
        partners: [
          { name: "RWTH Aachen",
            detail: "Prof. Daniel Truhn (Professor for AI in Medicine)",
            logo: "/images/partners/rwth-aachen.svg" },
        ] },
      { date: "Week 6", dot: "filled", title: "Hands-on Workshop: Medical Robotics",
        text: "Steering OR robots yourself at RWTH's Chair of Medical Engineering.",
        partners: [
          { name: "mediTEC",
            detail: "Prof. Klaus Radermacher",
            logo: "/images/partners/meditec-icon.png" },
        ] },
      { date: "Week 7–9", dot: "filled", title: "Project Preparation Sessions",
        text: "Three sessions to get your team project ready for the Makeathon.",
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
      { date: "26–28 Jun", dot: "accent", title: "Makeathon",
        text: "An intensive build weekend: 5 teams turned their projects into prototypes." },
      { date: "30 Jun", dot: "accent", title: "OneAIM x CSI Summit",
        text: "The closing event: final pitches in front of partners and guests.",
        partners: [
          { name: "CSI",
            detail: "Host",
            logo: "/images/partners/csi_logo.svg",
            wide: true },
        ] },
    ];

export const cityData: Record<CitySlug, CityData> = {
  munich: {
    slug:        "munich",
    connectShowSecuredPartners: false,
    displayName: "Munich",
    coords:      { lon: 11.582, lat: 48.1351 },
    uniShort:    "LMU · TUM",
    // Image: "Frauenkirche Munich - View from Peterskirche Tower" by Diliff
    // (Wikimedia Commons, CC BY 2.5) – image credit see the imprint page.
    heroImage:    "/images/cities/munich-hero.jpg",
    heroImageAlt: "View over Munich with the Frauenkirche",
    // University logos: TUM/LMU already live under /images/partners/.
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
      { date: "16–18 Oct", dot: "filled", title: "Kickoff Weekend in Berlin",
        text: "Meet the cohort: team building and intro talks." },
      { date: "Week 1–8", dot: "filled", title: "Partner visits & workshops",
        text: "One visit or workshop per week with our partners: hospitals, labs, MedTech companies and startups. Visits take place on Tuesdays at 5 pm." },
      { date: "11–13 Dec", dot: "accent", title: "Makeathon",
        text: "An intensive build weekend. Your team turns its project into a prototype." },
      { date: "15 Dec", dot: "accent", title: "Summit",
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
    // Image: "Aachen, Dom -- 2016 -- 2768" by Dietmar Rabich
    // (Wikimedia Commons, CC BY-SA 4.0) – image credit see the imprint page.
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
      { date: "23–25 Oct", dot: "filled", title: "Kickoff Weekend in Berlin",
        text: "Meet the cohort: team building and intro talks." },
      { date: "Week 1–8", dot: "filled", title: "Partner visits & workshops",
        text: "One visit or workshop per week with our partners: hospitals, labs, MedTech companies and startups. Most visits take place on Tuesday afternoons; exact times will be communicated in October." },
      { date: "15–17 Jan", dot: "accent", title: "Makeathon",
        text: "An intensive build weekend. Your team turns its project into a prototype." },
      { date: "19 Jan", dot: "accent", title: "OneAIM x CSI Summit",
        text: "The closing event: final pitches in front of partners and guests." },
    ],
    connectSecuredPartners: [
      { name: "Abiomed (J&J MedTech)",
        text: "Company visit at Abiomed, the heart pump pioneer from Aachen, with founder and CTO Dr. Thorsten Sieß.",
        chips: ["Company visit", "Dr. Thorsten Sieß · Founder & CTO"],
        logo: "/images/partners/abiomed.svg" },
      { name: "Harvard University",
        text: "Session with Harvard/MIT professor for AI in critical care Leo Celi on the risks and benefits of AI in healthcare.",
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
        text: "MRI & AI session with professor for AI in Medicine Daniel Truhn: how AI is changing medical image analysis.",
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
      "team runs multiple successful programs right here in the city, hand in " +
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
      { date: "24–25 Oct", dot: "filled", title: "Kickoff Weekend in Frankfurt",
        text: "Meet the cohort: team building and intro talks." },
      { date: "Week 1–8", dot: "filled", title: "Partner visits & workshops",
        text: "One visit or workshop per week with our partners: hospitals, labs, MedTech companies and startups. Exact dates will be announced." },
      { date: "Jan", dot: "accent", title: "Makeathon",
        text: "An intensive build weekend. Your team turns its project into a prototype. The exact date will be announced." },
      { date: "Jan", dot: "accent", title: "Summit",
        text: "The closing event: final pitches in front of partners and guests. The exact date will be announced." },
    ],
    connectSecuredPartners: [
      { name: "Cinven", wide: true,
        text: "International private equity firm and one of the world's leading healthcare investors.",
        logo: "/images/partners/cinven.svg" },
      { name: "Uniklinikum Frankfurt", wide: true,
        text: "The university hospital of Goethe University: clinical care, research and teaching under one roof.",
        logo: "/images/partners/uniklinikum-frankfurt.svg" },
      { name: "Futury",
        text: "Frankfurt-based venture builder turning talent and ideas into start-ups.",
        logo: "/images/partners/futury-icon.png" },
      { name: "Goethe University Frankfurt",
        text: "Frankfurt's largest university and the academic home of the chapter.",
        logo: "/images/universities/goethe-uni-icon.svg" },
      { name: "Nordic Capital", wide: true,
        text: "Leading private equity investor with a strong focus on healthcare and technology.",
        logo: "/images/partners/nordic-capital.svg" },
    ],
    displayName: "Frankfurt",
    coords:      { lon: 8.6821, lat: 50.1109 },
    uniShort:    "Goethe Uni",
    // Image: "Frankfurt am Main, Römer -- 2015 -- 6695-9" by Dietmar Rabich
    // (Wikimedia Commons, CC BY-SA 4.0) – image credit see the imprint page.
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

/** All locations as an array – order = order in the dropdown. */
export const cities: CityData[] = Object.values(cityData);

/** Look up a single location (undefined for an unknown slug). */
export function getCity(slug: CitySlug): CityData {
  return cityData[slug];
}

/** Static paths for /[city] – one page per entry above. */
export function getCityStaticPaths() {
  return cities.map(city => ({
    params: { city: city.slug },
    props:  { city },
  }));
}
