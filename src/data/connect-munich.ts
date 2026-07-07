// src/data/connect-munich.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Datendatei für AIM Connect München – Timeline-Events.
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  NEUES EVENT ERGÄNZEN:                                              ║
// ║  1. Bild nach public/images/events/ legen                           ║
// ║  2. Eintrag in das Array unten hinzufügen                           ║
// ║  → Timeline.astro sortiert automatisch nach Datum (älteste zuerst). ║
// ║  → Keine Komponente muss angefasst werden.                          ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// HINWEIS: Alle Inhalte sind Dummy-Daten und müssen vor Go-Live
// durch echte Eventbeschreibungen ersetzt werden.
// ─────────────────────────────────────────────────────────────────────────────

import type { TimelineEvent } from "../types/events";

export const connectMunichEvents: TimelineEvent[] = [
  {
    id:          "munich-kick-off-2025",
    title:       "Kick-Off Weekend",                                        // DUMMY
    date:        "2025-10-18",
    description: "Ein immersives 3-tägiges Opening-Event zum Start des Programms. Teilnehmende lernen sich kennen, begegnen ersten Expert*innen aus dem HealthTech-Ökosystem und legen gemeinsam die Grundlage für die kommenden Wochen.",
    image:       "/images/events/event-kickoff.svg",
    imageAlt:    "Gruppe beim Kick-Off Weekend (Platzhalter)",
    location:    "Munich",
    category:    "Kick-Off",
    tags:        ["Community", "Healthcare", "Networking"],
    featured:    true,
  },
  {
    id:          "munich-clinical-deep-dive-2025",
    title:       "Clinical Deep Dive",                                      // DUMMY
    date:        "2025-11-04",
    description: "Besuch eines der führenden Münchner Klinika. Kliniker*innen teilen Einblicke in den Alltag, zeigen reale Herausforderungen im Gesundheitswesen und diskutieren, wo KI-Lösungen tatsächlich Mehrwert schaffen.",
    image:       "/images/events/event-clinical.svg",
    imageAlt:    "Klinischer Workshop-Besuch (Platzhalter)",
    location:    "Munich",
    category:    "Company Visit",
    tags:        ["Clinical", "Healthcare", "Hospital"],
  },
  {
    id:          "munich-startup-session-2025",
    title:       "Startup Ecosystem Session",                               // DUMMY
    date:        "2025-11-18",
    description: "Besuch ausgewählter HealthTech-Start-ups im Münchner Ökosystem. Gründer*innen schildern ihre Journey von der Idee bis zum Produkt und geben Einblick in die Herausforderungen des Aufbaus im Medizinbereich.",
    image:       "/images/events/event-startup.svg",
    imageAlt:    "Startup Session im HealthTech Ökosystem (Platzhalter)",
    location:    "Munich",
    category:    "Company Visit",
    tags:        ["Startup", "Innovation", "MedTech"],
  },
  {
    id:          "munich-ai-workshop-2025",
    title:       "AI in Healthcare Workshop",                               // DUMMY
    date:        "2025-12-02",
    description: "Ein praxisnaher Workshop zu realen Anwendungsfällen von KI in der Medizin. Expert*innen zeigen, wie Machine Learning, Bildverarbeitung und Natural Language Processing konkrete klinische Probleme lösen.",
    image:       "/images/events/event-workshop.svg",
    imageAlt:    "Workshop: AI in Healthcare (Platzhalter)",
    location:    "Munich",
    category:    "Workshop",
    tags:        ["AI", "Machine Learning", "Healthcare", "Research"],
  },
  {
    id:          "munich-makeathon-2026",
    title:       "Makeathon & Summit",                                      // DUMMY
    date:        "2026-01-24",
    description: "Der krönende Abschluss des Programms: Ein 3-tägiger Makeathon, in dem interdisziplinäre Teams reale HealthTech-Herausforderungen lösen. Abschluss mit einem Summit vor Vertreter*innen aus Klinik, Industrie und Wissenschaft.",
    image:       "/images/events/event-makeathon.svg",
    imageAlt:    "Makeathon & Summit Abschluss (Platzhalter)",
    location:    "Munich",
    category:    "Makeathon",
    tags:        ["Innovation", "MedTech", "Teamwork", "Competition"],
    featured:    true,
  },
];
