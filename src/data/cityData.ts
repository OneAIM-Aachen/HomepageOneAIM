// src/data/cityData.ts
//
// Einzige Inhaltsquelle für die Bereiche "München" und "Aachen".
// Beide Standorte haben laut Flowchart identische Struktur
// (AIM Connect / AIM Code / Team) – hier wird nur der Inhalt pro
// Standort hinterlegt, die Darstellung übernehmen die Seiten/Komponenten.

export type CitySlug = "muenchen" | "aachen";

interface Bullet {
  label: string;
  text: string;
}

interface ProgramCard {
  title: string;
  bullets: Bullet[];
}

interface TeamMember {
  name: string;
  role: string;
}

export interface CityData {
  slug: CitySlug;
  displayName: string;
  heroHeadline: string;
  heroSubtext: string;
  introText: string[];
  aimConnect: {
    intro: string;
    cards: ProgramCard[]; // "Scope" und "Topic"
  };
  aimCode: {
    intro: string;
    whyCards: ProgramCard[]; // "Why AIM Code?"
    programs: { title: string; description: string }[]; // AIM DataLab / AIM CodeLab
  };
  team: TeamMember[];
}

export const cityData: Record<CitySlug, CityData> = {
  muenchen: {
    slug: "muenchen",
    displayName: "München",
    heroHeadline: "AIM in München",
    heroSubtext: "Wo OneAIM seinen Ursprung hat – mitten im Münchner HealthTech-Ökosystem.",
    introText: [
      "München ist der Gründungsstandort von OneAIM. Hier verbinden wir Studierende aus Medizin, Technik und Wirtschaft mit Kliniken, Forschungseinrichtungen und Start-ups der Region.",
      "Über AIM Connect und AIM Code erhalten Teilnehmende direkten Zugang zu Mentoring, praxisnahen Projekten und einem wachsenden Alumni-Netzwerk.",
    ],
    aimConnect: {
      intro:
        "AIM Connect München ist ein selektives 10-wöchiges Programm, das Studierende aus medizinischen, technischen und wirtschaftlichen Fachrichtungen mit dem HealthTech-Ökosystem in München vernetzt.",
      cards: [
        {
          title: "Scope",
          bullets: [
            {
              label: "Programmumfang",
              text: "20 Studierende durchlaufen 8 kuratierte Besuche in Kliniken, Forschung, Start-ups und Unternehmen.",
            },
            {
              label: "Format",
              text: "Ein 3-tägiges Opening-Event und ein abschließender 3-tägiger Makeathon mit Summit bilden den Rahmen.",
            },
          ],
        },
        {
          title: "Topic",
          bullets: [
            {
              label: "Schnittstellen",
              text: "AIM Connect verbindet Gesundheitswesen, Technologie und Wirtschaft durch direkten Austausch mit Klinikern, Forschenden und Gründer*innen.",
            },
            {
              label: "Verständnis",
              text: "Teilnehmende entwickeln ein End-to-End-Verständnis dafür, wie Ideen zu wirkungsvollen Lösungen im HealthTech-Bereich werden.",
            },
          ],
        },
      ],
    },
    aimCode: {
      intro:
        "AIM Code München ist der Einstieg in praxisnahes Programmieren für die Gesundheitstechnologie von morgen – offen für Studierende, medizinisches Fachpersonal und alle mit Interesse an der Schnittstelle von Technik und Medizin.",
      whyCards: [
        {
          title: "Real-World Applications",
          bullets: [
            {
              label: "Praxisbezug",
              text: "Lernen anhand medizinischer Datenanalyse, KI-Diagnostik und prädiktiver Modelle.",
            },
          ],
        },
        {
          title: "Accessible and Free",
          bullets: [
            {
              label: "Zugänglichkeit",
              text: "Alle Bootcamps sind kostenfrei – unabhängig vom fachlichen Hintergrund.",
            },
          ],
        },
        {
          title: "Hands-On Learning",
          bullets: [
            {
              label: "Praxiserfahrung",
              text: "Python, KI-Entwicklung und Machine Learning anhand realer Healthcare-Use-Cases.",
            },
          ],
        },
        {
          title: "Expert Guidance",
          bullets: [
            {
              label: "Mentoring",
              text: "Tutor*innen aus Medizin, Informatik und Technologie begleiten individuell.",
            },
          ],
        },
      ],
      programs: [
        {
          title: "AIM DataLab",
          description:
            "Einstieg ohne Vorkenntnisse: Grundlagen von Python sowie NumPy, Pandas und Matplotlib mit Fokus auf medizinische Daten.",
        },
        {
          title: "AIM CodeLab",
          description:
            "Vertiefung in künstliche Intelligenz: Aufbau von KI-Modellen für medizinische Diagnostik und prädiktive Analyse.",
        },
      ],
    },
    team: [
      { name: "Lena Hartmann", role: "Programmleitung AIM Connect" },
      { name: "Jonas Weber", role: "Programmleitung AIM Code" },
      { name: "Sophie Bauer", role: "Partnerships & Sponsoring" },
      { name: "Felix Schmidt", role: "Community & Events" },
    ],
  },

  aachen: {
    slug: "aachen",
    displayName: "Aachen",
    heroHeadline: "AIM in Aachen",
    heroSubtext: "Der neue OneAIM-Standort – Technik, Medizin und Innovation im Rheinland.",
    introText: [
      "Aachen ist der jüngste Standort von OneAIM und bringt die Initiative in eine der führenden Technikregionen Deutschlands.",
      "Mit AIM Connect und AIM Code entsteht hier eine neue Community aus Studierenden, die MedTech-Innovation aktiv mitgestalten wollen.",
    ],
    aimConnect: {
      intro:
        "AIM Connect Aachen vernetzt Studierende aus Medizin, Technik und Wirtschaft mit dem regionalen HealthTech-Ökosystem rund um RWTH Aachen und die Uniklinik.",
      cards: [
        {
          title: "Scope",
          bullets: [
            {
              label: "Programmumfang",
              text: "Ein kompaktes Programm mit kuratierten Besuchen bei Klinik-, Forschungs- und Industriepartnern in der Region Aachen.",
            },
            {
              label: "Format",
              text: "Ein Opening-Event zum Start und ein gemeinsamer Makeathon zum Abschluss des Programms.",
            },
          ],
        },
        {
          title: "Topic",
          bullets: [
            {
              label: "Schnittstellen",
              text: "Direkter Austausch mit Kliniker*innen, Forschenden und jungen Unternehmen an der Schnittstelle von Technik und Medizin.",
            },
            {
              label: "Verständnis",
              text: "Teilnehmende lernen, wie aus technischen Ideen konkrete Lösungen im Gesundheitswesen entstehen.",
            },
          ],
        },
      ],
    },
    aimCode: {
      intro:
        "AIM Code Aachen bringt praxisnahes Programmieren für die Gesundheitstechnologie an den Campus – für Studierende aller Fachrichtungen, ganz ohne Vorkenntnisse.",
      whyCards: [
        {
          title: "Real-World Applications",
          bullets: [
            {
              label: "Praxisbezug",
              text: "Aufgaben orientieren sich an echten Fragestellungen aus Medizintechnik und Diagnostik.",
            },
          ],
        },
        {
          title: "Accessible and Free",
          bullets: [
            {
              label: "Zugänglichkeit",
              text: "Alle Kurse sind kostenfrei und offen für Studierende aller Fachrichtungen.",
            },
          ],
        },
        {
          title: "Hands-On Learning",
          bullets: [
            {
              label: "Praxiserfahrung",
              text: "Programmieren lernen anhand realer Datensätze aus dem Gesundheitswesen.",
            },
          ],
        },
        {
          title: "Expert Guidance",
          bullets: [
            {
              label: "Mentoring",
              text: "Unterstützung durch Mentor*innen aus Technik, Medizin und Forschung.",
            },
          ],
        },
      ],
      programs: [
        {
          title: "AIM DataLab",
          description:
            "Grundlagenkurs für den Einstieg in Python und Datenanalyse mit medizinischem Bezug.",
        },
        {
          title: "AIM CodeLab",
          description: "Aufbaukurs zu KI-Modellen für medizinische Anwendungen.",
        },
      ],
    },
    team: [
      { name: "Mara Lindner", role: "Standortleitung Aachen" },
      { name: "Tobias Klein", role: "Programmleitung AIM Connect" },
      { name: "Anna Vogel", role: "Programmleitung AIM Code" },
    ],
  },
};

export function getCityData(slug: CitySlug): CityData {
  return cityData[slug];
}

export function getAllCitySlugs(): CitySlug[] {
  return Object.keys(cityData) as CitySlug[];
}

/**
 * Gemeinsame getStaticPaths()-Logik für alle dynamischen [city]-Routen,
 * damit diese nicht in jeder Seite einzeln dupliziert werden muss.
 */
export function getCityStaticPaths() {
  return getAllCitySlugs().map((slug) => ({
    params: { city: slug },
    props: { city: getCityData(slug) },
  }));
}
