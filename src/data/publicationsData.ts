// src/data/publicationsData.ts
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ADDING A NEW PUBLICATION – two steps:                                   ║
// ║                                                                          ║
// ║  1. Put the cover into public/images/publications/                       ║
// ║  2. Write an entry into the array below – position does not matter,      ║
// ║     sorting happens automatically by `year` (newest first).              ║
// ║                                                                          ║
// ║  After that, the following happens automatically:                        ║
// ║    • the newest publication becomes the spotlight at the top of          ║
// ║      /publications; all others appear in the "All publications" list     ║
// ║    • the detail page is created under /publications/<id>                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// `id` is also the URL segment – please keep it English and URL-safe.

export interface Publication {
  /** Unique identifier – becomes the URL /publications/<id> */
  id: string;
  title: string;
  /** Names always as "F. Lastname" – first letter of the first name, dot, last name. */
  authors: string[];
  year: number;
  /** Short description – appears in the spotlight and in the list */
  description: string;
  /** Path to the cover (relative to /public) */
  image: string;
  imageAlt?: string;
  /** Kind of publication, e.g. "Book", "Course material", "Paper" */
  kind?: string;
  /** Label for the spotlight, e.g. "New release" */
  badge?: string;
  /** External link (publisher, DOI, download) */
  link?: { label: string; href: string };
  /** Full text of the detail page, one entry per paragraph */
  body?: string[];
}

export const publications: Publication[] = [
  {
    id:          "ai-in-medicine-book-2025",
    title:       "The first OneAIM book is out now!",
    authors:     ["T. Wiegand", "L. Velezmoro"],
    year:        2025,
    kind:        "Book",
    badge:       "New release",
    description: "A hands-on introduction to the AI algorithms that matter in medicine, from the underlying mathematics to Python code you can run yourself.",
    image:       "/images/publications/oneAimBook1.jpeg",
    imageAlt:    "Tim Wiegand and Laura Velezmoro holding their book Künstliche Intelligenz in der Medizin",
    link:        { label: "Buy the book", href: "https://shop.elsevier.de/kuenstliche-intelligenz-in-der-medizin-anwendungen-algorithmen-und-programmierung-9783437412080.html" },
    body: [
      "Most introductions to medical AI stop at the level of analogy. This one does not: it explains the algorithms that matter in medicine in plain terms, then shows the mathematics underneath them and the code that implements them.",
      "The book moves from foundational concepts through the mathematical principles to Python programming, with code examples throughout. A recurring theme is error identification: recognising where a model has gone wrong, and why a good-looking result may not survive contact with clinical data.",
      "It is written for medical students, researchers and practitioners who want to analyse medical data themselves, or to build AI-based tools rather than only evaluate them. No prior programming background is assumed.",
      "Published as \"Künstliche Intelligenz in der Medizin: Anwendungen, Algorithmen und Programmierung\" by Urban & Fischer / Elsevier (ISBN 978-3-437-41208-0).",
    ],
  },
];

/** All publications, newest first (by year, descending). */
export function getSortedPublications(): Publication[] {
  return [...publications].sort((a, b) => b.year - a.year);
}

export function getPublication(id: string): Publication | undefined {
  return publications.find(p => p.id === id);
}
