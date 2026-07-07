// src/data/partners.ts
//
// Einzige Quelle aller Partner- und Sponsorendaten.
//
// ╔══════════════════════════════════════════════════════════╗
// ║  NEUEN PARTNER ERGÄNZEN – zwei Schritte:                 ║
// ║  1. Logo als SVG/PNG nach public/images/partners/ legen  ║
// ║  2. Einen Eintrag in das Array unten hinzufügen          ║
// ║  → Keine Komponente muss angefasst werden.               ║
// ╚══════════════════════════════════════════════════════════╝
//
// Das Interface ist absichtlich mit dem CarouselItem-Interface
// aus Carousel.astro kompatibel, sodass der Mapping-Schritt
// in PartnersSection.astro minimal bleibt.

export interface Partner {
  /** Eindeutiger Bezeichner (URL-sicher, keine Leerzeichen) */
  id: string;
  /** Anzeigename des Partners */
  name: string;
  /** Pfad relativ zu /public – wird direkt als <img src> verwendet */
  logo: string;
  /** Alt-Text für Screenreader; Standard: "[name] Logo" */
  logoAlt?: string;
  /** Externe Partnerseite (optional – Logo wird dann verlinkt) */
  website?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Partnerliste
// HINWEIS: Alle Logos sind aktuell Platzhalter.
// Echte Logos austauschen: gleichen Dateinamen beibehalten und Datei ersetzen.
// ─────────────────────────────────────────────────────────────────────────────

export const partners: Partner[] = [
  {
    id: "tum",
    name: "TUM",
    logo: "/images/partners/tum.svg",
    logoAlt: "Technische Universität München (TUM) – Platzhalter-Logo",
    website: "https://www.tum.de",
  },
  {
    id: "brainlab",
    name: "Brainlab",
    logo: "/images/partners/brainlab.svg",
    logoAlt: "Brainlab AG – Platzhalter-Logo",
    website: "https://www.brainlab.com",
  },
  {
    id: "lmu-klinikum",
    name: "LMU Klinikum",
    logo: "/images/partners/lmu-klinikum.svg",
    logoAlt: "LMU Klinikum München – Platzhalter-Logo",
    website: "https://www.lmu-klinikum.de",
  },
  {
    id: "helmholtz",
    name: "Helmholtz Munich",
    logo: "/images/partners/helmholtz.svg",
    logoAlt: "Helmholtz Munich – Platzhalter-Logo",
    website: "https://www.helmholtz-munich.de",
  },
  {
    id: "floy",
    name: "Floy",
    logo: "/images/partners/floy.svg",
    logoAlt: "Floy – Platzhalter-Logo",
    website: "https://www.floy.com",
  },
  {
    id: "smart-reporting",
    name: "Smart Reporting",
    logo: "/images/partners/smart-reporting.svg",
    logoAlt: "Smart Reporting – Platzhalter-Logo",
    website: "https://smart-reporting.com",
  },
  {
    id: "ryver-ai",
    name: "Ryver AI",
    logo: "/images/partners/ryver-ai.svg",
    logoAlt: "Ryver AI – Platzhalter-Logo",
  },
  {
    id: "simon-kucher",
    name: "Simon-Kucher",
    logo: "/images/partners/simon-kucher.svg",
    logoAlt: "Simon-Kucher & Partners – Platzhalter-Logo",
    website: "https://www.simon-kucher.com",
  },
  {
    id: "unternehmertum",
    name: "UnternehmerTUM",
    logo: "/images/partners/unternehmertum.svg",
    logoAlt: "UnternehmerTUM – Platzhalter-Logo",
    website: "https://www.unternehmertum.de",
  },
  {
    id: "tuev-sued",
    name: "TÜV SÜD",
    logo: "/images/partners/tuev-sued.svg",
    logoAlt: "TÜV SÜD AG – Platzhalter-Logo",
    website: "https://www.tuvsud.com",
  },
];
