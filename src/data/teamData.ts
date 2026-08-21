// src/data/teamData.ts
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ZENTRALE TEAM-DATENBANK – alle Standorte in einem Array.                ║
// ║                                                                          ║
// ║  NEUES MITGLIED ERGÄNZEN – zwei Schritte:                                ║
// ║  1. Foto nach public/images/team/ legen (optional)                       ║
// ║  2. Einen Eintrag in das Array unten schreiben. Position egal.           ║
// ║                                                                          ║
// ║  Danach erscheint die Person automatisch auf ihrer Standortseite:        ║
// ║    • president: true  → blaue Karte, ganz vorn in der Lead-Reihe         ║
// ║    • teamLead:  true  → helle Karte in der Lead-Reihe                    ║
// ║    • beides false     → Kachel in der Reihe "The full team"              ║
// ║  linkedIn gesetzt → LinkedIn-Overlay beim Überfahren der Karte.          ║
// ║                                                                          ║
// ║  AUSTRITT: niemanden löschen – formerMember: true setzen. Die Person     ║
// ║  verschwindet von der Seite, bleibt aber als Historie erhalten.          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import type { CitySlug } from "./cityData";

export interface TeamMember {
  name: string;
  /** Team, in dem die Person arbeitet, z. B. "AIM Connect", "Marketing" */
  team: string;
  /** true = erscheint in der Reihe "President & team leads" */
  teamLead: boolean;
  president: boolean;
  /** "munich" | "aachen" | "frankfurt" – bestimmt die Standortseite */
  city: CitySlug;
  /**
   * Überschreibt die automatisch abgeleitete Positionszeile komplett –
   * für Sonderrollen, die das Schema nicht abbildet, z. B.
   * "Vice-President | Board" oder "Co-Team Lead | Community & Recruitment".
   * Fehlt das Feld, gilt: President → "President | Team",
   * Team Lead → "Team Lead | Team", sonst nur der Team-Name.
   */
  position?: string;
  /** Pfad relativ zu /public, z. B. "/images/team/lucas-gildehaus.png" */
  photo?: string;
  /** LinkedIn-Profil-URL – aktiviert das Hover-Overlay */
  linkedIn?: string;
  /**
   * true = ehemaliges Mitglied. Bleibt in der Datenbank stehen (Historie,
   * späterer Alumni-Bereich), erscheint aber auf keiner Standortseite.
   */
  formerMember?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mitglieder
//
// Noch leer – solange hier nichts steht, zeigen die Standortseiten die
// Platzhalter-Karten der Blaupause. Beispiel-Eintrag:
//
//   {
//     name:      "Lucas Gildehaus",
//     team:      "AIM Connect",
//     teamLead:  true,
//     president: false,
//     city:      "aachen",
//     photo:     "/images/team/lucas-gildehaus.png",
//     linkedIn:  "https://www.linkedin.com/in/…",
//   },
// ─────────────────────────────────────────────────────────────────────────────

export const teamMembers: TeamMember[] = [

  // ── Munich – Board (Vorstand) ──────────────────────────────────────────
  { name: "Nick Breit",   team: "Board", teamLead: false, president: true, city: "munich",
    linkedIn: "https://www.linkedin.com/in/nick-breit/",
    photo: "/images/team/nick-breit.jpg" },
  { name: "Ahmed Ghaleb", team: "Board", teamLead: false, president: true, city: "munich",
    position: "Vice-President | Board",
    linkedIn: "https://www.linkedin.com/in/ahmedghaleb/",
    photo: "/images/team/ahmed-ghaleb.jpg" },

  // ── Munich – Team Leads ────────────────────────────────────────────────
  { name: "Gertrūda Bazytė",  team: "AIM Connect",              teamLead: true, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/gertruda-bazyte/",
    photo: "/images/team/gertruda-bazyte.jpg" },
  { name: "Raphael Franzen",  team: "AIM Innovate",             teamLead: true, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/raphael-franzen-7b88b3256/",
    photo: "/images/team/raphael-franzen.jpg" },
  { name: "Jimin Nam",        team: "AIM Code",                 teamLead: true, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/jimin-nam/",
    photo: "/images/team/jimin-nam.jpg" },
  { name: "Ali Allameh",      team: "Finance & Legal",          teamLead: true, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/ali-allameh/",
    photo: "/images/team/ali-allameh.jpg" },
  { name: "Anna Hohlweger",   team: "Marketing",                teamLead: true, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/anna-hohlweger/",
    photo: "/images/team/anna-hohlweger.jpg" },
  { name: "Nadja",            team: "Partnerships",             teamLead: true, president: false, city: "munich" },
  { name: "Maren Raab",       team: "Community & Recruitment",  teamLead: true, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/maren-raab/",
    photo: "/images/team/maren-raab.jpg" },
  { name: "Eva Wanninger",    team: "Community & Recruitment",  teamLead: true, president: false, city: "munich",
    position: "Co-Team Lead | Community & Recruitment",
    linkedIn: "https://www.linkedin.com/in/eva-wanninger/",
    photo: "/images/team/eva-wanninger.jpg" },

  // ── Munich – AIM Connect ───────────────────────────────────────────────
  { name: "Alessia de Carlo",        team: "AIM Connect", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/alessiadecarlo/",
    photo: "/images/team/alessia-de-carlo.jpg" },
  { name: "Alvaro Acevedo",          team: "AIM Connect", teamLead: false, president: false, city: "munich" },
  { name: "Andreas Nibler",          team: "AIM Connect", teamLead: false, president: false, city: "munich" },
  { name: "Daniel Centelles Steiger", team: "AIM Connect", teamLead: false, president: false, city: "munich" },
  { name: "Denisa Pitzl",            team: "AIM Connect", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/denisa-pitzl-24aa02222",
    photo: "/images/team/denisa-pitzl.jpg" },
  { name: "Jona von Reischach",      team: "AIM Connect", teamLead: false, president: false, city: "munich" },
  { name: "Jonas Laoudi",            team: "AIM Connect", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/jonas-laoudi",
    photo: "/images/team/jonas-laoudi.jpg" },
  { name: "Julius Müller",           team: "AIM Connect", teamLead: false, president: false, city: "munich" },
  { name: "Just Polls",              team: "AIM Connect", teamLead: false, president: false, city: "munich" },
  { name: "Laurenz Stastka",         team: "AIM Connect", teamLead: false, president: false, city: "munich" },
  { name: "Marius Moldovan",         team: "AIM Connect", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/marius-moldovan-405151231",
    photo: "/images/team/marius-moldovan.jpg" },
  { name: "Niklas Kronewiter",       team: "AIM Connect", teamLead: false, president: false, city: "munich" },
  { name: "Pia",                     team: "AIM Connect", teamLead: false, president: false, city: "munich" },
  { name: "Samira",                  team: "AIM Connect", teamLead: false, president: false, city: "munich" },
  { name: "Till Sobottka",           team: "AIM Connect", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/till-sobottka-549140272" },
  { name: "Viktoria Bals",           team: "AIM Connect", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/viktoria-josephine-bals-043689382" },
  { name: "Yanqin Ma",               team: "AIM Connect", teamLead: false, president: false, city: "munich" },
  { name: "Lili Song",               team: "AIM Connect", teamLead: false, president: false, city: "munich" },

  // ── Munich – AIM Innovate ──────────────────────────────────────────────
  { name: "Eliane Bähre",        team: "AIM Innovate", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/eliane-baehre",
    photo: "/images/team/eliane-baehre.jpg" },
  { name: "Jannis Kornilakis",   team: "AIM Innovate", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/jannis-kornilakis-b13782341" },
  { name: "Kaidi",               team: "AIM Innovate", teamLead: false, president: false, city: "munich" },
  { name: "Lea Schleemann",      team: "AIM Innovate", teamLead: false, president: false, city: "munich" },
  { name: "Magali Fischbach",    team: "AIM Innovate", teamLead: false, president: false, city: "munich" },
  { name: "Manuel Reiter",       team: "AIM Innovate", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/manuel-reiter-351912381",
    photo: "/images/team/manuel-reiter.jpg" },
  { name: "Varvara Danylchenko", team: "AIM Innovate", teamLead: false, president: false, city: "munich" },
  { name: "Dominik Schopper",    team: "AIM Innovate", teamLead: false, president: false, city: "munich" },
  { name: "Charlotte Heuberger", team: "AIM Innovate", teamLead: false, president: false, city: "munich" },
  { name: "Annik Arnold",        team: "AIM Innovate", teamLead: false, president: false, city: "munich" },
  { name: "Maria Metodieva",     team: "AIM Innovate", teamLead: false, president: false, city: "munich" },
  { name: "Laetitia Wandtke",    team: "AIM Innovate", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/laetitia-wandtke/",
    photo: "/images/team/laetitia-wandtke.jpg" },
  { name: "Philipp Liedtke",     team: "AIM Innovate", teamLead: false, president: false, city: "munich" },

  // ── Munich – AIM Code ──────────────────────────────────────────────────
  { name: "Jonathan Welte",   team: "AIM Code", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/jonathan-welte-a8745b1a4/" },
  { name: "Benedict Böhler",  team: "AIM Code", teamLead: false, president: false, city: "munich" },
  { name: "Michael Röhrl",    team: "AIM Code", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/michael-r%C3%B6hrl/",
    photo: "/images/team/michael-roehrl.jpg" },
  { name: "Leo Eckert",       team: "AIM Code", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/leo-eckert-6953a2222/",
    photo: "/images/team/leo-eckert.jpg" },
  { name: "Florian Grabert",  team: "AIM Code", teamLead: false, president: false, city: "munich" },
  { name: "Verona Miftari",   team: "AIM Code", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/verona-miftari-83172528a/",
    photo: "/images/team/verona-miftari.jpg" },
  { name: "Esra Kocaarslan",  team: "AIM Code", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/esra-kocaarslan-76892020a/",
    photo: "/images/team/esra-kocaarslan.jpg" },
  { name: "Nithin Balan",     team: "AIM Code", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/nithin-balan-02b026103",
    photo: "/images/team/nithin-balan.jpg" },

  // ── Munich – Finance & Legal ───────────────────────────────────────────
  { name: "Kathryna Jornet",   team: "Finance & Legal", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/kathryna-jornet-107b283a2" },
  { name: "Oscar Wiederhold",  team: "Finance & Legal", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/oscar-wiederhold-lahoz-5964b02a6/",
    photo: "/images/team/oscar-wiederhold.jpg" },
  { name: "Kevin Gyojun Ku",   team: "Finance & Legal", teamLead: false, president: false, city: "munich" },
  { name: "Kimia Hassanpour",  team: "Finance & Legal", teamLead: false, president: false, city: "munich" },

  // ── Munich – Community & Recruitment ───────────────────────────────────
  { name: "Sophie Ihrler",   team: "Community & Recruitment", teamLead: false, president: false, city: "munich" },
  { name: "Sidney Radsak",   team: "Community & Recruitment", teamLead: false, president: false, city: "munich" },
  { name: "Laura Bauer",     team: "Community & Recruitment", teamLead: false, president: false, city: "munich" },
  { name: "Felix Möllmann",  team: "Community & Recruitment", teamLead: false, president: false, city: "munich" },

  // ── Munich – Partnerships ──────────────────────────────────────────────
  { name: "Viktoria Klein",     team: "Partnerships", teamLead: false, president: false, city: "munich" },
  { name: "Maren Schreiber",    team: "Partnerships", teamLead: false, president: false, city: "munich" },
  { name: "Paul Herr",          team: "Partnerships", teamLead: false, president: false, city: "munich" },
  { name: "Laura Niedermeier",  team: "Partnerships", teamLead: false, president: false, city: "munich",
    linkedIn: "https://www.linkedin.com/in/laura-niedermeier-239086220",
    photo: "/images/team/laura-niedermeier.jpg" },
  { name: "Lena Müller",        team: "Partnerships", teamLead: false, president: false, city: "munich" },

  // ── Munich – Marketing ─────────────────────────────────────────────────
  { name: "Jeanette Luu", team: "Marketing", teamLead: false, president: false, city: "munich" },

  // ── Aachen – Board ─────────────────────────────────────────────────────
  { name: "Lucas Gildehaus", team: "Board", teamLead: false, president: true, city: "aachen", linkedIn: "https://www.linkedin.com/in/lucas-gildehaus-0b3bba291/",
    photo: "/images/team/lucas-gildehaus.jpg" },

  // ── Aachen – Team Leads ────────────────────────────────────────────────
  { name: "Aliya Zwiens",       team: "Interview & Application Management", teamLead: true, president: false, city: "aachen",
    photo: "/images/team/aliya-zwiens.jpg" },
  { name: "Eric Hölpes",        team: "Social Media",       teamLead: true, president: false, city: "aachen",
    photo: "/images/team/eric-hoelpes.jpg" },
  { name: "Jonathan Rempel",    team: "Finance & Legal",    teamLead: true, president: false, city: "aachen",
    photo: "/images/team/jonathan-rempel.jpg" },
  { name: "Sebastian Ha",       team: "AIM Code",           teamLead: true, president: false, city: "aachen",
    photo: "/images/team/sebastian-ha.jpg" },
  { name: "David Forster",      team: "Makeathon & Summit", teamLead: true, president: false, city: "aachen", linkedIn: "https://www.linkedin.com/in/codingdavid/",
    photo: "/images/team/david-forster.jpg" },
  { name: "Alexander Mladenov", team: "Partnerships",       teamLead: true, president: false, city: "aachen",
    photo: "/images/team/alexander-mladenov.jpg" },
  { name: "Yujin Song",         team: "Kickoff",            teamLead: true, president: false, city: "aachen",
    photo: "/images/team/yujin-song.jpg" },

  // ── Aachen – Advisors ──────────────────────────────────────────────────
  { name: "Karl Kindermann",   team: "Advisors", teamLead: false, president: false, city: "aachen", position: "Advisor", linkedIn: "https://www.linkedin.com/in/karlkindermann/" },
  { name: "Sven Mattus",       team: "Advisors", teamLead: false, president: false, city: "aachen", position: "Advisor", linkedIn: "https://www.linkedin.com/in/sven-mattus-522494177/",
    photo: "/images/team/sven-mattus.jpg" },
  { name: "Dr. Anton Dimroth", team: "Advisors", teamLead: false, president: false, city: "aachen", position: "Advisor", linkedIn: "https://www.linkedin.com/in/anton-dimroth-35ba0aa8/",
    photo: "/images/team/anton-dimroth.jpg" },

  // ── Aachen – Members ───────────────────────────────────────────────────
  // Für diese Mitglieder nennt der Notion-Export kein Team – Anzeige "Member".
  { name: "Constantin",     team: "General", teamLead: false, president: false, city: "aachen", position: "Member",
    photo: "/images/team/constantin-lemler.jpg" },
  { name: "Timo Klein",     team: "General", teamLead: false, president: false, city: "aachen", position: "Member" },
  { name: "Adam Khizar",    team: "General", teamLead: false, president: false, city: "aachen", position: "Member" },
  { name: "Seiar Yousofi",  team: "General", teamLead: false, president: false, city: "aachen", position: "Member" },
  { name: "Julian Sandten", team: "General", teamLead: false, president: false, city: "aachen", position: "Member", linkedIn: "https://www.linkedin.com/in/julian-sandten-5121932b4" },

  // ── Aachen – Ehemalige (erscheinen nicht auf der Website) ──────────────
  { name: "Zeynep Öztürk", team: "General", teamLead: false, president: false, city: "aachen", position: "Member", formerMember: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Abgeleitete Listen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alle AKTIVEN Mitglieder org-weit – für die Team-Seite (/team).
 * Reihenfolge: Presidents zuerst, dann Team Leads, dann alle übrigen;
 * innerhalb der Gruppen bleibt die Reihenfolge des Arrays erhalten.
 */
export function getActiveMembers(): TeamMember[] {
  const active = teamMembers.filter(m => !m.formerMember);
  return [
    ...active.filter(m => m.president),
    ...active.filter(m => m.teamLead && !m.president),
    ...active.filter(m => !m.president && !m.teamLead),
  ];
}

/** Alle AKTIVEN Mitglieder eines Standorts – Ehemalige sind ausgefiltert. */
export function getTeamByCity(city: CitySlug): TeamMember[] {
  return teamMembers.filter(m => m.city === city && !m.formerMember);
}

/** Ehemalige eines Standorts – für einen späteren Alumni-Bereich. */
export function getFormerMembersByCity(city: CitySlug): TeamMember[] {
  return teamMembers.filter(m => m.city === city && m.formerMember);
}

/**
 * Lead-Reihe eines Standorts: President zuerst, danach die Team Leads
 * in der Reihenfolge des Arrays.
 */
export function getLeadsByCity(city: CitySlug): TeamMember[] {
  const local = getTeamByCity(city);
  return [
    ...local.filter(m => m.president),
    ...local.filter(m => m.teamLead && !m.president),
  ];
}

/** Reihe "The full team": alle ohne Lead- oder President-Rolle. */
export function getMembersByCity(city: CitySlug): TeamMember[] {
  return getTeamByCity(city).filter(m => !m.president && !m.teamLead);
}
