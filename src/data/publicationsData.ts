// src/data/publicationsData.ts
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  NEUE PUBLIKATION ERGÄNZEN – zwei Schritte:                              ║
// ║                                                                          ║
// ║  1. Cover nach public/images/publications/ legen                         ║
// ║  2. Einen Eintrag in das Array unten schreiben – Position egal,          ║
// ║     sortiert wird automatisch nach `year` (neueste zuerst).              ║
// ║                                                                          ║
// ║  Danach passiert von selbst:                                             ║
// ║    • die neueste Publikation wird zum Spotlight oben auf /publications   ║
// ║    • alle weiteren erscheinen in der Liste "All publications"            ║
// ║    • unter /publications/<id> entsteht die Detailseite                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// `id` ist zugleich das URL-Segment – bitte englisch und URL-sicher halten.

export interface Publication {
  /** Eindeutiger Bezeichner – wird zur URL /publications/<id> */
  id: string;
  title: string;
  /** Namen immer als "V. Nachname" – erster Buchstabe des Vornamens, Punkt, Nachname. */
  authors: string[];
  year: number;
  /** Kurzbeschreibung – erscheint im Spotlight und in der Liste */
  description: string;
  /** Pfad zum Cover (relativ zu /public) */
  image: string;
  imageAlt?: string;
  /** Art der Veröffentlichung, z. B. "Book", "Course material", "Paper" */
  kind?: string;
  /** Label für das Spotlight, z. B. "New release" */
  badge?: string;
  /** Externer Bezugslink (Verlag, DOI, Download) */
  link?: { label: string; href: string };
  /** Volltext der Detailseite, ein Eintrag je Absatz */
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
  {
    id:          "ml-medical-imaging-2025",
    title:       "Machine learning in medical imaging: an introduction for students",
    authors:     ["S. Bauer", "F. Schmidt", "M. Lindner"],
    year:        2025,
    kind:        "Course material",
    description: "Supplementary material from the AIM Code bootcamp on the fundamentals of image classification and AI-assisted diagnosis.",
    image:       "/images/publications/pub-2.svg",
    imageAlt:    "Cover: machine learning in medical imaging (placeholder)",
    body: [
      "This is the written companion to the imaging module of the AIM Code bootcamp. It assumes no prior background in machine learning and starts from what an image actually is to a model.",
      "The material works through image classification on real diagnostic datasets: preparing data, training a first model, and, the part most introductions skip, reading the result honestly. Class imbalance, leakage between training and test sets, and metrics that flatter a model are covered as first-class topics rather than footnotes.",
      "A closing section deals with what changes when a model is intended for clinical use: how performance claims are evaluated, and why a strong test score is the beginning of the argument rather than the end of it.",
    ],
  },
];

/** Alle Publikationen, neueste zuerst (nach Jahr absteigend). */
export function getSortedPublications(): Publication[] {
  return [...publications].sort((a, b) => b.year - a.year);
}

export function getPublication(id: string): Publication | undefined {
  return publications.find(p => p.id === id);
}
