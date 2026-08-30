// src/data/partners.ts
//
// Single source of all partner and sponsor data.
//
// ╔══════════════════════════════════════════════════════════╗
// ║  ADDING A NEW PARTNER – two steps:                       ║
// ║  1. Put the logo as SVG/PNG into public/images/partners/ ║
// ║  2. Add an entry to the array below                      ║
// ║  → No component needs to be touched.                     ║
// ╚══════════════════════════════════════════════════════════╝
//
// The interface is intentionally compatible with the CarouselItem
// interface from Carousel.astro, so that the mapping step
// in PartnersSection.astro stays minimal.

/** Sponsors appear in the upper list on /partners, partners below. */
export type PartnerType = "partner" | "sponsor";

export interface Partner {
  /** Unique identifier (URL-safe, no spaces) */
  id: string;
  /** Classification: "sponsor" or "partner" – controls the group on /partners */
  type: PartnerType;
  /**
   * true = appears in the logo marquee on the home page.
   * If the field is missing, the entry is ONLY visible on /partners. This is
   * intentional: the marquee does not grow unintentionally with each new entry.
   */
  onLanding?: boolean;
  /** Display name of the partner */
  name: string;
  /** Path relative to /public – used directly as <img src> */
  logo: string;
  /** Alt text for screen readers; default: "[name] Logo" */
  logoAlt?: string;
  /** External partner website (optional – the logo is then linked) */
  website?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Partner list
// NOTE: All logos are currently placeholders.
// To swap in real logos: keep the same file name and replace the file.
// ─────────────────────────────────────────────────────────────────────────────

export const partners: Partner[] = [
  {
    id: "tum",
    type: "sponsor",
    name: "TUM",
    onLanding: true,
    logo: "/images/partners/tum.png",
    logoAlt: "Technische Universität München (TUM) – Logo",
    website: "https://www.tum.de",
  },
  {
    id: "brainlab",
    type: "partner",
    name: "Brainlab",
    onLanding: true,
    logo: "/images/partners/brainlab.png",
    logoAlt: "Brainlab AG – Logo",
    website: "https://www.brainlab.com",
  },
  {
    id: "lmu-klinikum",
    type: "sponsor",
    name: "LMU Klinikum",
    logo: "/images/partners/lmu-klinikum.png",
    logoAlt: "LMU Klinikum München – Logo",
    website: "https://www.lmu-klinikum.de",
  },
  {
    id: "helmholtz",
    type: "partner",
    name: "Helmholtz Munich",
    logo: "/images/partners/helmholtz.png",
    logoAlt: "Helmholtz Munich – Logo",
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
    logoAlt: "Floy – Logo",
    website: "https://www.floy.com",
  },
  {
    id: "smart-reporting",
    type: "partner",
    name: "Smart Reporting",
    logo: "/images/partners/smart-reporting.png",
    logoAlt: "Smart Reporting – Logo",
    website: "https://smart-reporting.com",
  },
  {
    id: "ryver-ai",
    type: "partner",
    name: "Ryver AI",
    logo: "/images/partners/ryver-ai.png",
    logoAlt: "Ryver AI – Logo",
    website: "https://ryver.ai",
  },
  {
    id: "simon-kucher",
    type: "partner",
    name: "Simon-Kucher",
    logo: "/images/partners/simon-kucher.svg",
    logoAlt: "Simon-Kucher & Partners – Logo",
    website: "https://www.simon-kucher.com",
  },
  {
    id: "unternehmertum",
    type: "partner",
    name: "UnternehmerTUM",
    logo: "/images/partners/unternehmertum.webp",
    logoAlt: "UnternehmerTUM – Logo",
    website: "https://www.unternehmertum.de",
  },
  {
    id: "tuev-sued",
    type: "partner",
    name: "TÜV SÜD",
    logo: "/images/partners/tuev-sued.svg",
    logoAlt: "TÜV SÜD AG – Logo",
    website: "https://www.tuvsud.com",
  },
  {
    id: "csi-aachen",
    type: "sponsor",
    name: "CSI",
    logo: "/images/partners/csi_logo.svg",
    logoAlt: "CSI Aachen – Logo",
    website: "https://care4innovation.de/",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Carried over from the old website (one-aim.org), as of 17.08.2026.
  // Logos are the original files from there – not placeholders.
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
    type: "sponsor",
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
    // TODO: replace with a real logo. This file is the Open Graph
    // banner of the old website (dark gradient with text) – as the only
    // logo in the marquee with a background area it visually stands out.
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
  // Added on 20.08.2026 – partner list from the team (Munich + Aachen).
  // Logos downloaded from the official sites/Wikimedia; usage approved.
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
    // Full wordmark logo for the partner overview; the shield alone
    // (harvard-shield.svg) remains for icon-like uses (timelines).
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

  {
    id: "abiomed",
    type: "partner",
    name: "Abiomed (J&J MedTech)",
    logo: "/images/partners/abiomed.svg",
    logoAlt: "Abiomed – Logo",
    website: "https://www.abiomed.com/",
  },

  // ── Frankfurt ──────────────────────────────────────────────────────────
  {
    id: "cinven",
    type: "partner",
    name: "Cinven",
    logo: "/images/partners/cinven.svg",
    logoAlt: "Cinven – Logo",
    website: "https://www.cinven.com/",
  },
  {
    id: "nordic-capital",
    type: "partner",
    name: "Nordic Capital",
    logo: "/images/partners/nordic-capital.svg",
    logoAlt: "Nordic Capital – Logo",
    website: "https://www.nordiccapital.com/",
  },
  {
    id: "uniklinikum-frankfurt",
    type: "partner",
    name: "Uniklinikum Frankfurt",
    logo: "/images/partners/uniklinikum-frankfurt.svg",
    logoAlt: "Universitätsmedizin Frankfurt – Logo",
    website: "https://www.kgu.de/",
  },
  {
    id: "futury",
    type: "partner",
    name: "Futury",
    logo: "/images/partners/futury.png",
    logoAlt: "Futury – Logo",
    website: "https://www.futury.eu/",
  },
  {
    id: "goethe-university",
    type: "partner",
    name: "Goethe University Frankfurt",
    logo: "/images/universities/goethe-uni.svg",
    logoAlt: "Goethe-Universität Frankfurt – Logo",
    website: "https://www.uni-frankfurt.de/",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Derived lists – order always follows the array above.
// ─────────────────────────────────────────────────────────────────────────────

/** Sponsors only – upper list on /partners. */
export const sponsors: Partner[] = partners.filter(p => p.type === "sponsor");

/** Partners only – lower list on /partners. */
export const partnersOnly: Partner[] = partners.filter(p => p.type === "partner");

/** Selection for the marquee on the home page (onLanding: true). */
export const landingPartners: Partner[] = partners.filter(p => p.onLanding);
