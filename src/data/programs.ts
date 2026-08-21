// src/data/programs.ts
//
// Einzige Quelle aller Programmdaten.
//
// ╔══════════════════════════════════════════════════════════════╗
// ║  NEUES PROGRAMM ERGÄNZEN – ein Schritt:                      ║
// ║  Einen Eintrag unten hinzufügen. Daraus entstehen automatisch ║
// ║    • die Karte im Bento-Raster der Startseite                 ║
// ║    • die Unterseite /programs/<slug>                          ║
// ║    • der Eintrag im "Programs"-Dropdown der Kopfzeile         ║
// ╚══════════════════════════════════════════════════════════════╝

/** Layoutvariante der Karte im Bento-Raster auf der Startseite. */
export type ProgramVariant = "feature" | "photo" | "gradient" | "light" | "outline";

export interface Program {
  /** URL-Segment unter /programs/ */
  slug: string;
  name: string;
  /** Kurztext für die Karte auf der Startseite */
  text: string;
  variant: ProgramVariant;
  /** Optionales Label auf der Karte, z. B. "Flagship" */
  badge?: string;
  image?: string;
  imageAlt?: string;

  /** Einleitung auf der Programmseite */
  intro: string;
  /** Stichpunkte auf der Programmseite */
  highlights: { title: string; text: string }[];
  /**
   * Städte mit einer eigenen Seite zu diesem Programm.
   * Erzeugt auf der Programmseite die Links "In deiner Stadt".
   * Leer lassen, solange es keine stadtspezifische Seite gibt.
   */
  citySlugs?: ("munich" | "aachen")[];
}

export const programs: Program[] = [
  {
    slug: "aim-connect",
    name: "AIM Connect",
    badge: "Flagship",
    variant: "feature",
    image: "/images/about/kickoff-2026.jpg",
    imageAlt: "Teilnehmende des AIM-Connect-Programms bei einem Event",
    text:
      "An exclusive add-on study program at the intersection of medicine, " +
      "entrepreneurship and technology, with insights from hospitals, research, " +
      "startups and industry.",
    intro:
      "AIM Connect is our flagship program: a curated add-on to your degree that " +
      "takes you inside the places where MedTech actually happens. Over the course " +
      "of a semester you visit hospitals, research institutes, startups and " +
      "established companies, and work alongside the people building the field.",
    highlights: [
      {
        title: "Curated visits",
        text: "A series of on-site sessions with clinics, research groups, startups and industry partners.",
      },
      {
        title: "Opening and makeathon",
        text: "The program is framed by a multi-day opening event and closes with a makeathon and summit.",
      },
      {
        title: "End-to-end perspective",
        text: "You follow an idea from clinical need through technology and regulation to a working solution.",
      },
    ],
    citySlugs: ["munich", "aachen"],
  },
  {
    slug: "aim-code",
    name: "AIM Code",
    variant: "photo",
    image: "/images/about/codelab.jpg",
    imageAlt: "Studierende in einem Programmierkurs von AIM Code",
    text: "Free coding courses, from Python workshops to AI in healthcare.",
    intro:
      "AIM Code makes the technical side of MedTech accessible, free of charge and " +
      "open to students of every background. Courses start at the basics and build " +
      "towards machine learning on real healthcare data.",
    highlights: [
      {
        title: "From zero to model",
        text: "Python fundamentals, data handling and machine learning, taught in sequence.",
      },
      {
        title: "Healthcare use cases",
        text: "Exercises use medical datasets and diagnostic problems rather than generic examples.",
      },
      {
        title: "Free and open",
        text: "No fees and no prior programming experience required.",
      },
    ],
    citySlugs: ["munich", "aachen"],
  },
  {
    slug: "aim-innovate",
    name: "AIM Innovate",
    variant: "gradient",
    text:
      "From idea to startup: regulation, policy and strategy with entrepreneurs, " +
      "investors and experts.",
    intro:
      "AIM Innovate follows what happens after the prototype. Together with founders, " +
      "investors and regulatory experts, you work through what it takes to turn a " +
      "MedTech idea into something that can reach patients.",
    highlights: [
      {
        title: "Regulation and approval",
        text: "How medical devices and software are classified, certified and brought to market.",
      },
      {
        title: "Strategy and funding",
        text: "Business models, reimbursement and the funding landscape for health ventures.",
      },
      {
        title: "Founders and investors",
        text: "Sessions with people who have built and financed MedTech companies.",
      },
    ],
  },
  {
    slug: "aim-educate",
    name: "AIM Educate",
    variant: "light",
    text: "Open lectures on Medical AI in a relaxed, informal setting, open to everyone.",
    intro:
      "AIM Educate is our open format: talks on medical AI with no prerequisites and " +
      "no registration. Come for a single evening, ask questions, and stay for the " +
      "conversation afterwards.",
    highlights: [
      {
        title: "Open to all",
        text: "No application, no fee and no particular background required.",
      },
      {
        title: "Informal by design",
        text: "Short talks in a relaxed setting, built around discussion rather than slides.",
      },
      {
        title: "Broad topics",
        text: "From diagnostic models to ethics, data protection and clinical practice.",
      },
    ],
  },
  {
    slug: "aim-science",
    name: "AIM Science",
    variant: "outline",
    text:
      "Advancing AI research in healthcare, from chatbots taking the medical state " +
      "exam to generative patient imagery.",
    intro:
      "AIM Science is where members run their own research. Projects are student-led, " +
      "supervised by researchers and clinicians, and aimed at results worth publishing.",
    highlights: [
      {
        title: "Student-led projects",
        text: "You propose and run the work, with supervision from research and clinical partners.",
      },
      {
        title: "Real research questions",
        text: "Past themes include language models on medical exams and generative patient imaging.",
      },
      {
        title: "Towards publication",
        text: "Projects are set up so results can be written up and submitted.",
      },
    ],
  },
];

export function getProgram(slug: string): Program | undefined {
  return programs.find(p => p.slug === slug);
}

/** Einträge für das "Programs"-Dropdown in der Kopfzeile. */
export const programNavItems = programs.map(p => ({
  label: p.name,
  href: `/programs/${p.slug}`,
}));
