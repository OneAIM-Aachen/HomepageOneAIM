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
    displayName: "München",
    heroHeadline: "AIM in München",
    heroSubtext:  "Wo OneAIM seinen Ursprung hat – mitten im Münchner HealthTech-Ökosystem.",
    introText: [
      "München ist der Gründungsstandort von OneAIM. Hier verbinden wir Studierende aus Medizin, Technik und Wirtschaft mit Kliniken, Forschungseinrichtungen und Start-ups der Region.",
      "Über AIM Connect und AIM Code erhalten Teilnehmende direkten Zugang zu Mentoring, praxisnahen Projekten und einem wachsenden Alumni-Netzwerk.",
    ],
    aimConnect: {
      intro: "AIM Connect München ist ein selektives 10-wöchiges Programm, das Studierende aus medizinischen, technischen und wirtschaftlichen Fachrichtungen mit dem HealthTech-Ökosystem in München vernetzt.",
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
      intro: "AIM Code München ist der Einstieg in praxisnahes Programmieren für die Gesundheitstechnologie von morgen.",
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
    heroSubtext:  "Der neue OneAIM-Standort – Technik, Medizin und Innovation im Rheinland.",
    introText: [
      "Aachen ist der jüngste Standort von OneAIM und bringt die Initiative in eine der führenden Technikregionen Deutschlands.",
      "Mit AIM Connect und AIM Code entsteht hier eine neue Community aus Studierenden, die MedTech-Innovation aktiv mitgestalten wollen.",
    ],
    aimConnect: {
      intro: "AIM Connect Aachen vernetzt Studierende aus Medizin, Technik und Wirtschaft mit dem regionalen HealthTech-Ökosystem rund um RWTH Aachen und die Uniklinik.",
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
      intro: "AIM Code Aachen bringt praxisnahes Programmieren für die Gesundheitstechnologie an den Campus.",
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
