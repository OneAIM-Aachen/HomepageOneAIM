// src/data/faq.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Zentrale FAQ-Datenquelle für alle Programme und Standorte.
//
// NEUE FRAGE ERGÄNZEN:
//   Einfach einen weiteren Eintrag { question: "...", answer: "..." }
//   in das jeweilige Array einfügen – fertig.
//   Keine Komponente muss angefasst werden.
//
// STRUKTUR:
//   faq.aimConnect.muenchen  →  FAQ für AIM Connect München
//   faq.aimConnect.aachen    →  FAQ für AIM Connect Aachen
//   faq.aimCode.muenchen     →  FAQ für AIM Code München
//   faq.aimCode.aachen       →  FAQ für AIM Code Aachen
// ─────────────────────────────────────────────────────────────────────────────

export interface FAQItem {
  question: string;
  answer:   string;
}

export type CityKey = "muenchen" | "aachen";

export interface ProgramFAQ {
  muenchen: FAQItem[];
  aachen:   FAQItem[];
}

export interface FAQData {
  aimConnect: ProgramFAQ;
  aimCode:    ProgramFAQ;
}

export const faq: FAQData = {

  // ── AIM Connect ────────────────────────────────────────────────────────────
  aimConnect: {
    muenchen: [
      {
        question: "Who can apply to AIM Connect?",
        answer:   "AIM Connect is open to all students enrolled at a Munich university, regardless of their field of study. We actively welcome students from medicine, engineering, business, natural sciences, and beyond.",
      },
      {
        question: "Do I need prior experience in coding or medical technology?",
        answer:   "No prior experience is required. AIM Connect is designed to be accessible to students from all backgrounds. What matters most is your curiosity and motivation to explore the intersection of technology and healthcare.",
      },
      {
        question: "How does the application process work?",
        answer:   "Applications are submitted via our online form during the open application phase. Shortlisted candidates may be invited to a brief interview. Final decisions are communicated before the program start date.",
      },
      {
        question: "What is the expected time commitment?",
        answer:   "AIM Connect runs for approximately 10 weeks and includes around 8 curated visits, an opening weekend, and a closing makeathon. Participants should expect to invest roughly one day per week.",
      },
      {
        question: "What language is used in the program?",
        answer:   "The program is conducted primarily in English to ensure inclusivity for international students. Some partner visits may include German-language components.",
      },
      {
        question: "What networking opportunities does AIM Connect provide?",
        answer:   "Participants gain direct access to clinicians, researchers, startup founders, and industry professionals. The closing summit brings together all stakeholders for collaborative networking.",
      },
      {
        question: "What is a Makeathon?",
        answer:   "A Makeathon is an intensive team-based event where participants collaborate to develop solutions to real-world healthcare challenges. It combines elements of a hackathon with a focus on building and prototyping.",
      },
      {
        question: "Will I receive a certificate upon completing the program?",
        answer:   "Yes, participants who complete AIM Connect receive a certificate of participation. We are also exploring options for academic credit recognition in cooperation with partner universities.",
      },
    ],

    aachen: [
      {
        question: "Who can apply to AIM Connect Aachen?",
        answer:   "AIM Connect Aachen is open to all students enrolled at RWTH Aachen University or the University of Aachen, regardless of their field of study.",
      },
      {
        question: "Do I need any prior experience?",
        answer:   "No prior experience is needed. We welcome students from all disciplines who are interested in the intersection of technology and healthcare.",
      },
      {
        question: "How does the application process work?",
        answer:   "Applications are submitted via our online form. Shortlisted candidates are invited for a brief interview before final selections are made.",
      },
      {
        question: "What is the time commitment?",
        answer:   "The program runs for approximately 10 weeks. Participants should plan for roughly one full day per week, including company visits and events.",
      },
      {
        question: "What language is used?",
        answer:   "The program is conducted primarily in English. Some partner visits in the Aachen region may include German-language components.",
      },
      {
        question: "Are international students eligible to apply?",
        answer:   "Yes, international students enrolled at an Aachen university are warmly encouraged to apply.",
      },
      {
        question: "What networking opportunities are available?",
        answer:   "Participants meet local MedTech companies, researchers from RWTH and the University Hospital Aachen, and join a growing alumni community.",
      },
      {
        question: "Will I receive a certificate?",
        answer:   "Yes, all participants who successfully complete the program receive a certificate of participation.",
      },
    ],
  },

  // ── AIM Code ───────────────────────────────────────────────────────────────
  aimCode: {
    muenchen: [
      {
        question: "Who is AIM Code for?",
        answer:   "AIM Code is designed for anyone interested in programming and data science applied to healthcare – from complete beginners to those with some coding experience. No medical background is required.",
      },
      {
        question: "What programming language is taught?",
        answer:   "The courses are taught in Python, the most widely used language in data science and medical AI applications.",
      },
      {
        question: "Do I need any prior coding experience?",
        answer:   "AIM DataLab is suitable for complete beginners. AIM CodeLab builds on basic Python knowledge, so some prior experience is helpful but not strictly required.",
      },
      {
        question: "How much time does the course require?",
        answer:   "Each bootcamp runs over several sessions and typically requires a commitment of around half a day per week, including in-person sessions and optional self-study.",
      },
      {
        question: "Are the courses free of charge?",
        answer:   "Yes, all AIM Code courses are completely free of charge. OneAIM is a student-led initiative committed to accessible education.",
      },
      {
        question: "What is the difference between AIM DataLab and AIM CodeLab?",
        answer:   "AIM DataLab covers the fundamentals of Python and data analysis with a focus on medical datasets. AIM CodeLab is the advanced course, introducing machine learning and AI models for healthcare applications.",
      },
      {
        question: "Will I receive a certificate?",
        answer:   "Participants who complete the course receive a certificate of participation from OneAIM.",
      },
    ],

    aachen: [
      {
        question: "Who is AIM Code Aachen for?",
        answer:   "AIM Code is open to all students interested in programming for healthcare, from complete beginners to those with some prior coding knowledge.",
      },
      {
        question: "What programming language is taught?",
        answer:   "All courses use Python, the standard language for data science and medical AI.",
      },
      {
        question: "Do I need prior experience?",
        answer:   "No prior experience is required for AIM DataLab. AIM CodeLab benefits from basic Python knowledge but is designed to be approachable.",
      },
      {
        question: "How much time should I plan for?",
        answer:   "Around half a day per week over the course of the bootcamp, including in-person sessions and self-study.",
      },
      {
        question: "Are the courses free?",
        answer:   "Yes, all AIM Code courses are completely free of charge.",
      },
      {
        question: "What is the difference between AIM DataLab and AIM CodeLab?",
        answer:   "AIM DataLab introduces Python and data analysis for beginners. AIM CodeLab advances to machine learning and AI applications in medicine.",
      },
      {
        question: "Will I receive a certificate?",
        answer:   "Yes, participants receive an official certificate of participation upon completion.",
      },
    ],
  },
};

/** Gibt die FAQ-Einträge für ein bestimmtes Programm und einen Standort zurück. */
export function getFAQ(
  program: keyof FAQData,
  city: CityKey
): FAQItem[] {
  return faq[program][city];
}
