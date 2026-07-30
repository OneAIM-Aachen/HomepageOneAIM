// src/data/cityData.ts
// Zentrale Datenquelle für beide Standorte (München & Aachen).

export type CitySlug = "muenchen" | "aachen";

interface Bullet  { label: string; text: string }
interface ProgramCard { title: string; bullets: Bullet[] }

export interface CityData {
  slug:        CitySlug;
  displayName: string;
  heroHeadline: string;
  heroSubtext:  string;
  introText:    string[];
  aimConnect: {
    intro: string;
    cards: ProgramCard[];
  };
  aimCode: {
    intro: string;
    whyCards: ProgramCard[];
    programs: { title: string; description: string }[];
  };
  team: { name: string; role: string }[];
  /** Instagram-Kanal des Standorts */
  instagram: string;
  /** Bilder für die Teaser-Boxen auf der Übersichtsseite */
  teaserImages: {
    aimConnect: string;
    aimCode:    string;
    team:       string;
  };
}

export const cityData: Record<CitySlug, CityData> = {
  muenchen: {
    slug:        "muenchen",
    displayName: "Munich",
    heroHeadline: "AIM in Munich",
    heroSubtext:  "The origin of OneAIM!",
    introText: [
      "Munich is where OneAIM was founded. Here, we connect students from the fields of medicine, engineering, and business with hospitals, research institutions, and startups in the region.",
      "Through AIM Connect and AIM Code, participants gain direct access to mentoring, hands-on projects, and a growing alumni network."
    ],
    aimConnect: {
      intro: "AIM Connect Munich is a selective 10-week program that connects students from medical, technical, and business disciplines with the HealthTech ecosystem in Munich.",
      cards: [
        {
          title: "Scope",
          bullets: [
            { label: "Programmumfang", text: "20 Studierende durchlaufen 8 kuratierte Besuche in Kliniken, Forschung, Start-ups und Unternehmen." },
            { label: "Format", text: "Ein 3-tägiges Opening-Event und ein abschließender 3-tägiger Makeathon mit Summit bilden den Rahmen." },
          ],
        },
        {
          title: "Topic",
          bullets: [
            { label: "Schnittstellen", text: "AIM Connect verbindet Gesundheitswesen, Technologie und Wirtschaft durch direkten Austausch mit Klinikern, Forschenden und Gründer*innen." },
            { label: "Verständnis", text: "Teilnehmende entwickeln ein End-to-End-Verständnis dafür, wie Ideen zu wirkungsvollen Lösungen im HealthTech-Bereich werden." },
          ],
        },
      ],
    },
    aimCode: {
      intro: "AIM Code Munich is your gateway to hands-on programming for the healthcare technology of tomorrow.",
      whyCards: [
        { title: "Real-World Applications", bullets: [{ label: "Praxisbezug", text: "Lernen anhand medizinischer Datenanalyse, KI-Diagnostik und prädiktiver Modelle." }] },
        { title: "Hands-On Learning", bullets: [{ label: "Praxiserfahrung", text: "Python, KI-Entwicklung und Machine Learning anhand realer Healthcare-Use-Cases." }] },
      ],
      programs: [
        { title: "AIM DataLab", description: "Grundlagen von Python sowie NumPy, Pandas und Matplotlib mit Fokus auf medizinische Daten." },
        { title: "AIM CodeLab", description: "Vertiefung in KI: Aufbau von Modellen für medizinische Diagnostik und prädiktive Analyse." },
      ],
    },
    team: [],
    instagram: "https://www.instagram.com/oneaim.munich",
    teaserImages: {
      aimConnect: "/images/teasers/aim-connect.svg",
      aimCode:    "/images/teasers/programming_course.jpg",
      team:       "/images/teasers/team.svg",
    },
  },

  aachen: {
    slug:        "aachen",
    displayName: "Aachen",
    heroHeadline: "AIM in Aachen",
    heroSubtext:  "In 2025, OneAIM has finally arrived in Aachen!",
    introText: [
      "Aachen is OneAIM's newest location and brings the initiative to one of Germany's leading technology regions.",
      "With AIM Connect and AIM Code, a new community of students is emerging here who want to actively help shape medtech innovation.",
    ],
    aimConnect: {
      intro: "AIM Connect Aachen connects students in medicine, engineering, and business with the regional HealthTech ecosystem centered around RWTH Aachen University and the University Hospital.",
      cards: [
        {
          title: "Scope",
          bullets: [
            { label: "Programmumfang", text: "Ein kompaktes Programm mit kuratierten Besuchen bei Klinik-, Forschungs- und Industriepartnern in der Region Aachen." },
            { label: "Format", text: "Ein Opening-Event zum Start und ein gemeinsamer Makeathon zum Abschluss des Programms." },
          ],
        },
        {
          title: "Topic",
          bullets: [
            { label: "Schnittstellen", text: "Direkter Austausch mit Kliniker*innen, Forschenden und jungen Unternehmen an der Schnittstelle von Technik und Medizin." },
            { label: "Verständnis", text: "Teilnehmende lernen, wie aus technischen Ideen konkrete Lösungen im Gesundheitswesen entstehen." },
          ],
        },
      ],
    },
    aimCode: {
      intro: "AIM Code Aachen brings hands-on programming for health technology to the campus.",
      whyCards: [
        { title: "Real-World Applications", bullets: [{ label: "Praxisbezug", text: "Aufgaben orientieren sich an echten Fragestellungen aus Medizintechnik und Diagnostik." }] },
        { title: "Hands-On Learning", bullets: [{ label: "Praxiserfahrung", text: "Programmieren lernen anhand realer Datensätze aus dem Gesundheitswesen." }] },
      ],
      programs: [
        { title: "AIM DataLab", description: "Grundlagenkurs für den Einstieg in Python und Datenanalyse mit medizinischem Bezug." },
        { title: "AIM CodeLab", description: "Aufbaukurs zu KI-Modellen für medizinische Anwendungen." },
      ],
    },
    team: [],
    instagram: "https://www.instagram.com/oneaim.aachen",
    teaserImages: {
      aimConnect: "/images/teasers/aachenKickoff2026.jpg",
      aimCode:    "/images/teasers/programming_course.jpg",
      team:       "/images/teasers/team-aachen.jpg",
    },
  },
};

export function getCityData(slug: CitySlug): CityData {
  return cityData[slug];
}

export function getCityStaticPaths() {
  return (Object.keys(cityData) as CitySlug[]).map(slug => ({
    params: { city: slug },
    props:  { city: getCityData(slug) },
  }));
}
