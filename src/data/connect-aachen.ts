// src/data/connect-aachen.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Datendatei für AIM Connect Aachen – Timeline-Events.
//
// Neue Events: Bild nach public/images/events/ legen und Eintrag ergänzen.
// HINWEIS: Alle Inhalte sind Dummy-Daten.
// ─────────────────────────────────────────────────────────────────────────────

import type { TimelineEvent } from "../types/events";

export const connectAachenEvents: TimelineEvent[] = [
  {
    id:          "aachen-launch-2026",
    title:       "AIM Connect Aachen – Launch Event",                       // DUMMY
    date:        "2026-02-08",
    description: "Das offizielle Launch-Event des neuen OneAIM-Standorts in Aachen. Studierende aus Medizin, Technik und Wirtschaft kommen zum ersten Mal zusammen und lernen das HealthTech-Ökosystem der Region kennen.",
    image:       "/images/events/event-launch.svg",
    imageAlt:    "Launch Event AIM Connect Aachen (Platzhalter)",
    location:    "Aachen",
    category:    "Kick-Off",
    tags:        ["Community", "Aachen", "RWTH", "Networking"],
    featured:    true,
  },
  {
    id:          "aachen-company-visit-2026",
    title:       "Besuch: Lokaler MedTech-Partner",                        // DUMMY
    date:        "2026-03-04",
    description: "Exklusiver Besuch bei einem führenden Medizintechnik-Unternehmen in der Region. Ingenieure und Kliniker zeigen, wie Produkte von der Idee bis zur Marktreife entwickelt werden, und welche Regulierungshürden auf dem Weg liegen.",
    image:       "/images/events/event-company-visit.svg",
    imageAlt:    "Company Visit bei MedTech-Partner Aachen (Platzhalter)",
    location:    "Aachen",
    category:    "Company Visit",
    tags:        ["MedTech", "Engineering", "Regulatory", "Aachen"],
  },
  {
    id:          "aachen-networking-2026",
    title:       "HealthTech Networking Evening",                           // DUMMY
    date:        "2026-04-02",
    description: "Ein entspannter Abend zum interdisziplinären Austausch zwischen Programmteilnehmenden, Alumni und Expert*innen aus der Aachener HealthTech-Szene. Impulse aus der Praxis, Diskussionen in kleinen Gruppen und neue Kontakte.",
    image:       "/images/events/event-startup.svg",
    imageAlt:    "Networking Evening Aachen (Platzhalter)",
    location:    "Aachen",
    category:    "Networking",
    tags:        ["Networking", "Community", "Healthcare", "Social"],
  },
];
