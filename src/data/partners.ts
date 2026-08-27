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

/** Sponsoren stehen auf /partners in der oberen Liste, Partner darunter. */
export type PartnerType = "partner" | "sponsor";

export interface Partner {
  /** Eindeutiger Bezeichner (URL-sicher, keine Leerzeichen) */
  id: string;
  /** Einordnung: "sponsor" oder "partner" – steuert die Gruppe auf /partners */
  type: PartnerType;
  /**
   * true = erscheint im Logo-Laufband auf der Startseite.
   * Fehlt das Feld, ist der Eintrag NUR auf /partners zu sehen. Das ist
   * Absicht: so wächst das Laufband nicht ungewollt mit jedem neuen Eintrag.
   */
  onLanding?: boolean;
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
    type: "sponsor",
    name: "TUM",
    onLanding: true,
    logo: "/images/partners/tum.png",
    logoAlt: "Technische Universität München (TUM) – Platzhalter-Logo",
    website: "https://www.tum.de",
  },
  {
    id: "brainlab",
    type: "partner",
    name: "Brainlab",
    onLanding: true,
    logo: "/images/partners/brainlab.png",
    logoAlt: "Brainlab AG – Platzhalter-Logo",
    website: "https://www.brainlab.com",
  },
  {
    id: "lmu-klinikum",
    type: "sponsor",
    name: "LMU Klinikum",
    logo: "/images/partners/lmu-klinikum.png",
    logoAlt: "LMU Klinikum München – Platzhalter-Logo",
    website: "https://www.lmu-klinikum.de",
  },
  {
    id: "helmholtz",
    type: "partner",
    name: "Helmholtz Munich",
    logo: "/images/partners/helmholtz.png",
    logoAlt: "Helmholtz Munich – Platzhalter-Logo",
    website: "https://www.helmholtz-munich.de",
  },
  {
    id: "klinikum-rechts-der-isar",
    type: "partner",
    name: "Klinikum rechts der Isar",
    logo: "/images/partners/Klinikum_rechts_der_Isar_logo.svg",
    logoAlt: "Klinikum rechts der Isar der TU München – Logo",
    website: "https://www.mri.tum.de",
  },
  {
    id: "floy",
    type: "partner",
    name: "Floy",
    logo: "/images/partners/floy.png",
    logoAlt: "Floy – Platzhalter-Logo",
    website: "https://www.floy.com",
  },
  {
    id: "smart-reporting",
    type: "partner",
    name: "Smart Reporting",
    logo: "/images/partners/smart-reporting.png",
    logoAlt: "Smart Reporting – Platzhalter-Logo",
    website: "https://smart-reporting.com",
  },
  {
    id: "ryver-ai",
    type: "partner",
    name: "Ryver AI",
    logo: "/images/partners/ryver-ai.png",
    logoAlt: "Ryver AI – Platzhalter-Logo",
    website: "https://ryver.ai",
  },
  {
    id: "simon-kucher",
    type: "partner",
    name: "Simon-Kucher",
    logo: "/images/partners/simon-kucher.svg",
    logoAlt: "Simon-Kucher & Partners – Platzhalter-Logo",
    website: "https://www.simon-kucher.com",
  },
  {
    id: "unternehmertum",
    type: "partner",
    name: "UnternehmerTUM",
    logo: "/images/partners/unternehmertum.webp",
    logoAlt: "UnternehmerTUM – Platzhalter-Logo",
    website: "https://www.unternehmertum.de",
  },
  {
    id: "tuev-sued",
    type: "partner",
    name: "TÜV SÜD",
    logo: "/images/partners/tuev-sued.svg",
    logoAlt: "TÜV SÜD AG – Platzhalter-Logo",
    website: "https://www.tuvsud.com",
  },
  {
    id: "csi-aachen",
    type: "partner",
    name: "CSI Aachen",
    logo: "/images/partners/csi_logo.svg",
    logoAlt: "CSI Aachen – Platzhalter-Logo",
    website: "https://care4innovation.de/",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Aus der alten Website (one-aim.org) übernommen, Stand 17.08.2026.
  // Logos sind die Originaldateien von dort – keine Platzhalter.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "yzr-capital",
    type: "partner",
    name: "YZR Capital",
    logo: "/images/partners/yzr-capital.jpeg",
    logoAlt: "YZR Capital – Logo",
    website: "https://yzr.vc",
  },
  {
    id: "ocumeda",
    type: "partner",
    name: "Ocumeda",
    logo: "/images/partners/ocumeda.png",
    logoAlt: "Ocumeda – Logo",
    website: "https://www.ocumeda.com",
  },
  {
    id: "strategyand",
    type: "partner",
    name: "Strategy&",
    logo: "/images/partners/strategyand.png",
    logoAlt: "Strategy& (PwC) – Logo",
    website: "https://www.strategyand.pwc.com",
  },
  {
    id: "teleclinic",
    type: "partner",
    name: "TeleClinic",
    logo: "/images/partners/teleclinic.png",
    logoAlt: "TeleClinic – Logo",
    website: "https://www.teleclinic.com",
  },
  {
    id: "tum-venture-labs",
    type: "partner",
    name: "TUM Venture Labs",
    logo: "/images/partners/tum-venture-labs.jpg",
    logoAlt: "TUM Venture Labs – Logo",
    website: "https://www.tum-venture-labs.de",
  },
  {
    id: "avelios",
    type: "partner",
    name: "Avelios Medical",
    onLanding: true,
    logo: "/images/partners/avelios.png",
    logoAlt: "Avelios Medical – Logo",
    website: "https://www.avelios.com",
  },
  {
    id: "zeiss",
    type: "partner",
    name: "ZEISS",
    onLanding: true,
    logo: "/images/partners/zeiss.png",
    logoAlt: "Carl Zeiss AG – Logo",
    website: "https://www.zeiss.de",
  },
  {
    id: "elsevier",
    type: "partner",
    name: "Elsevier",
    logo: "/images/partners/elsevier.svg",
    logoAlt: "Elsevier – Logo",
    website: "https://www.elsevier.com",
  },
  {
    id: "amino-collective",
    type: "partner",
    name: "Amino Collective",
    // TODO: Ersatz durch ein echtes Logo. Diese Datei ist das Open-Graph-
    // Banner der alten Website (dunkler Verlauf mit Schrift) – als einziges
    // Logo im Band mit Hintergrundfläche fällt es optisch aus der Reihe.
    logo: "/images/partners/amino-collective.jpg",
    logoAlt: "Amino Collective – Logo",
    website: "https://www.aminocollective.com",
  },
  {
    id: "heal-capital",
    type: "partner",
    name: "Heal Capital",
    logo: "/images/partners/heal-capital.jpg",
    logoAlt: "Heal Capital – Logo",
    website: "https://www.healcapital.com",
  },
  {
    id: "flatiron",
    type: "partner",
    name: "Flatiron Health",
    logo: "/images/partners/flatiron.webp",
    logoAlt: "Flatiron Health – Logo",
    website: "https://flatiron.com",
  },
  {
    id: "avi-medical",
    type: "partner",
    name: "Avi Medical",
    logo: "/images/partners/avi-medical.webp",
    logoAlt: "Avi Medical – Logo",
    website: "https://www.avimedical.com",
  },
  {
    id: "umontreal",
    type: "partner",
    name: "Université de Montréal",
    logo: "/images/partners/umontreal.png",
    logoAlt: "Université de Montréal – Logo",
    website: "https://www.umontreal.ca",
  },
  {
    id: "fgcu",
    type: "partner",
    name: "Florida Gulf Coast University",
    logo: "/images/partners/fgcu.png",
    logoAlt: "Florida Gulf Coast University – Logo",
    website: "https://www.fgcu.edu",
  },
  {
    id: "dpma",
    type: "partner",
    name: "DPMA",
    logo: "/images/partners/dpma.gif",
    logoAlt: "Deutsches Patent- und Markenamt – Logo",
    website: "https://www.dpma.de",
  },
  {
    id: "stmwk-bayern",
    type: "partner",
    name: "StMWK Bayern",
    logo: "/images/partners/stmwk-bayern.jpg",
    logoAlt: "Bayerisches Staatsministerium für Wissenschaft und Kunst – Logo",
    website: "https://www.stmwk.bayern.de",
  },
  {
    id: "bmg",
    type: "partner",
    name: "Bundesministerium für Gesundheit",
    logo: "/images/partners/bmg.png",
    logoAlt: "Bundesministerium für Gesundheit – Logo",
    website: "https://www.bundesgesundheitsministerium.de",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Ergänzt am 20.08.2026 – Partnerliste aus dem Team (Munich + Aachen).
  // Logos von den offiziellen Seiten/Wikimedia geladen; Nutzung freigegeben.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "lmu",
    type: "partner",
    name: "LMU München",
    onLanding: true,
    logo: "/images/partners/lmu.svg",
    logoAlt: "Ludwig-Maximilians-Universität München (LMU) – Logo",
    website: "https://www.lmu.de",
  },
  {
    id: "nus",
    type: "partner",
    name: "NUS",
    logo: "/images/partners/nus.svg",
    logoAlt: "National University of Singapore (NUS) – Logo",
    website: "https://nus.edu.sg",
  },
  {
    id: "amboss",
    type: "partner",
    name: "AMBOSS",
    onLanding: true,
    logo: "/images/partners/amboss.svg",
    logoAlt: "AMBOSS – Logo",
    website: "https://www.amboss.com",
  },
  {
    id: "aws",
    type: "partner",
    name: "Amazon Web Services",
    logo: "/images/partners/aws.svg",
    logoAlt: "Amazon Web Services (AWS) – Logo",
    website: "https://aws.amazon.com",
  },
  {
    id: "bardehle-pagenberg",
    type: "partner",
    name: "Bardehle Pagenberg",
    logo: "/images/partners/bardehle-pagenberg.jpg",
    logoAlt: "Bardehle Pagenberg – Logo",
    website: "https://www.bardehle.com",
  },
  {
    id: "bonescreen",
    type: "partner",
    name: "bonescreen",
    logo: "/images/partners/bonescreen.svg",
    logoAlt: "bonescreen – Logo",
    website: "https://www.bonescreen.de",
  },
  {
    id: "certhub",
    type: "partner",
    name: "CertHub",
    logo: "/images/partners/certhub.svg",
    logoAlt: "CertHub – Logo",
    website: "https://www.certhub.de",
  },
  {
    id: "cogthera",
    type: "partner",
    name: "cogthera",
    logo: "/images/partners/cogthera.png",
    logoAlt: "cogthera – Logo",
    website: "https://cogthera.de",
  },
  {
    id: "curevision",
    type: "partner",
    name: "CureVision",
    logo: "/images/partners/curevision.svg",
    logoAlt: "CureVision – Logo",
    website: "https://curevision.de",
  },
  {
    id: "custom-surgical",
    type: "partner",
    name: "Custom Surgical",
    logo: "/images/partners/custom-surgical.png",
    logoAlt: "Custom Surgical – Logo",
    website: "https://customsurgical.co",
  },
  {
    id: "deepc",
    type: "partner",
    name: "deepc",
    logo: "/images/partners/deepc.svg",
    logoAlt: "deepc – Logo",
    website: "https://deepc.ai",
  },
  {
    id: "ebenbuild",
    type: "partner",
    name: "Ebenbuild",
    logo: "/images/partners/ebenbuild.png",
    logoAlt: "Ebenbuild – Logo",
    website: "https://ebenbuild.com",
  },
  {
    id: "google",
    type: "partner",
    name: "Google",
    onLanding: true,
    logo: "/images/partners/google.svg",
    logoAlt: "Google – Logo",
    website: "https://www.google.com",
  },
  {
    id: "heartflow",
    type: "partner",
    name: "HeartFlow",
    logo: "/images/partners/heartflow.svg",
    logoAlt: "HeartFlow – Logo",
    website: "https://www.heartflow.com",
  },
  {
    id: "heidi-health",
    type: "partner",
    name: "Heidi Health",
    onLanding: true,
    logo: "/images/partners/heidi-health.svg",
    logoAlt: "Heidi Health – Logo",
    website: "https://www.heidihealth.com",
  },
  {
    id: "iatros",
    type: "partner",
    name: "iATROS",
    logo: "/images/partners/iatros.svg",
    logoAlt: "iATROS – Logo",
    website: "https://i-atros.com",
  },
  {
    id: "labor-becker",
    type: "partner",
    name: "Labor Becker",
    logo: "/images/partners/labor-becker.svg",
    logoAlt: "Labor Becker – Logo",
    website: "https://www.labor-becker.de",
  },
  {
    id: "plug-and-play",
    type: "partner",
    name: "Plug and Play",
    logo: "/images/partners/plug-and-play.png",
    logoAlt: "Plug and Play Tech Center – Logo",
    website: "https://www.plugandplaytechcenter.com",
  },
  {
    id: "redstone",
    type: "partner",
    name: "Redstone",
    logo: "/images/partners/redstone.webp",
    logoAlt: "Redstone VC – Logo",
    website: "https://www.redstone.vc",
  },
  {
    id: "smith-nephew",
    type: "partner",
    name: "Smith+Nephew",
    onLanding: true,
    logo: "/images/partners/smith-nephew.svg",
    logoAlt: "Smith+Nephew – Logo",
    website: "https://www.smith-nephew.com",
  },
  {
    id: "sorealert",
    type: "partner",
    name: "SoreAlert",
    logo: "/images/partners/sorealert.png",
    logoAlt: "SoreAlert (Sorala GmbH) – Logo",
    website: "https://www.sorealert.com",
  },
  {
    id: "speedinvest",
    type: "partner",
    name: "Speedinvest",
    logo: "/images/partners/speedinvest.svg",
    logoAlt: "Speedinvest – Logo",
    website: "https://www.speedinvest.com",
  },
  {
    id: "start-munich",
    type: "partner",
    name: "START Munich",
    logo: "/images/partners/start-munich.png",
    logoAlt: "START Munich – Logo",
    website: "https://www.startmunich.de",
  },
  {
    id: "wacker",
    type: "partner",
    name: "Wacker Chemie",
    logo: "/images/partners/wacker.svg",
    logoAlt: "Wacker Chemie AG – Logo",
    website: "https://www.wacker.com",
  },
  {
    id: "uk-aachen",
    type: "partner",
    name: "Uniklinik RWTH Aachen",
    logo: "/images/partners/uk-aachen.svg",
    logoAlt: "Uniklinik RWTH Aachen – Logo",
    website: "https://www.ukaachen.de",
  },
  {
    id: "rwth-aachen",
    type: "partner",
    name: "RWTH Aachen",
    onLanding: true,
    logo: "/images/partners/rwth-aachen.svg",
    logoAlt: "RWTH Aachen University – Logo",
    website: "https://www.rwth-aachen.de",
  },
  {
    id: "elucid",
    type: "partner",
    name: "Elucid",
    logo: "/images/partners/elucid.svg",
    logoAlt: "elucid GmbH – Logo",
    website: "https://www.elucid.social",
  },
  {
    id: "synagen-ai",
    type: "partner",
    name: "SynagenAI",
    logo: "/images/partners/synagen-ai.svg",
    logoAlt: "SynagenAI – Logo",
    website: "https://synagen.ai",
  },
  {
    id: "meditec",
    type: "partner",
    name: "mediTEC RWTH Aachen",
    logo: "/images/partners/meditec.png",
    logoAlt: "mediTEC – Lehrstuhl für Medizintechnik, RWTH Aachen – Logo",
    website: "https://www.meditec.hia.rwth-aachen.de/en/",
  },
  {
    id: "vivalyx",
    type: "partner",
    name: "Vivalyx",
    logo: "/images/partners/vivalyx.png",
    logoAlt: "Vivalyx – Logo",
    website: "https://vivalyx.com",
  },
  {
    id: "harvard",
    type: "partner",
    name: "Harvard University",
    onLanding: true,
    // Volles Wortmarken-Logo für die Partner-Übersicht; das Wappen allein
    // (harvard-shield.svg) bleibt für ikonhafte Verwendungen (Timelines).
    logo: "/images/partners/harvard.png",
    logoAlt: "Harvard University – Coat of arms",
    website: "https://hsph.harvard.edu/ala/faculty/leo-anthony-celi/",
  },
  {
    id: "imperial",
    type: "partner",
    name: "Imperial College London",
    logo: "/images/partners/imperial-crest.png",
    logoAlt: "Imperial College London – Crest",
    website: "https://profiles.imperial.ac.uk/f.rodriguez",
  },
  {
    id: "digitalhub-aachen",
    type: "partner",
    name: "digitalHUB Aachen",
    logo: "/images/partners/digitalhub-aachen.svg",
    logoAlt: "digitalHUB Aachen – Logo",
    website: "https://digitalhub.de",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Abgeleitete Listen – Reihenfolge folgt immer dem Array oben.
// ─────────────────────────────────────────────────────────────────────────────

/** Nur Sponsoren – obere Liste auf /partners. */
export const sponsors: Partner[] = partners.filter(p => p.type === "sponsor");

/** Nur Partner – untere Liste auf /partners. */
export const partnersOnly: Partner[] = partners.filter(p => p.type === "partner");

/** Auswahl für das Laufband auf der Startseite (onLanding: true). */
export const landingPartners: Partner[] = partners.filter(p => p.onLanding);
