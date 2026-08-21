// src/components/navigation/navData.ts
//
// Einzige Quelle der Navigationsstruktur (Single Source of Truth).
//
// Die Programm-Einträge kommen aus src/data/programs.ts, damit ein neues
// Programm nicht an zwei Stellen gepflegt werden muss.

import { programNavItems } from "../../data/programs";
import { cities }          from "../../data/cityData";

export interface NavItem {
  label: string;
  href:  string;
  /**
   * Untereinträge. Ist das Feld gesetzt, rendert der Header statt eines
   * Links einen Auf-/Zuklapp-Button mit Dropdown (siehe Header.astro).
   */
  children?: NavItem[];
}

/**
 * Standorte – Ziel des "Locations"-Dropdowns in der Kopfzeile.
 * Abgeleitet aus der Standort-Datenbank (cityData.ts): ein neuer Eintrag
 * dort erscheint hier automatisch.
 */
export const locationItems: NavItem[] = cities.map(city => ({
  label: city.displayName,
  href:  `/${city.slug}`,
}));

/**
 * Community – Menschen und Institutionen rund um OneAIM.
 * "/partners" existiert bereits; "/team" und "/participants" sind
 * vorerst Stub-Seiten (Inhalte folgen).
 */
export const communityItems: NavItem[] = [
  { label: "Partners & Sponsors", href: "/partners"     },
  { label: "Team",                href: "/team"         },
  { label: "Participants",        href: "/participants" },
];

/**
 * Globale Top-Level-Navigation.
 *
 * "Contact Us", "Datenschutz" und "Impressum" stehen bewusst nur noch im
 * Footer (siehe Footer.astro) – die Kopfzeile bleibt auf Inhalte beschränkt.
 *
 * "Locations" und "Programs" bündeln nur ihre Untereinträge und haben
 * bewusst kein eigenes Ziel (href leer): Es gibt keine Übersichtsseite,
 * die Einzelseiten sind direkt über das Dropdown erreichbar.
 */
export const globalNavItems: NavItem[] = [
  { label: "Locations",    href: "",              children: locationItems },
  { label: "Programs",     href: "",              children: programNavItems },
  { label: "Community",    href: "",              children: communityItems },
  { label: "News",         href: "/news"          },
  { label: "Publications", href: "/publications"  },
];


