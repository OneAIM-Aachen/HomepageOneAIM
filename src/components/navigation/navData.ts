// src/components/navigation/navData.ts
//
// Single source of the navigation structure (Single Source of Truth).
//
// The program entries come from src/data/programs.ts, so that a new
// program does not have to be maintained in two places.

import { programNavItems } from "../../data/programs";
import { cities }          from "../../data/cityData";

export interface NavItem {
  label: string;
  href:  string;
  /**
   * Sub-entries. If the field is set, the header renders an expand/collapse
   * button with a dropdown instead of a link (see Header.astro).
   */
  children?: NavItem[];
}

/**
 * Locations – target of the "Locations" dropdown in the header.
 * Derived from the location database (cityData.ts): a new entry
 * there appears here automatically.
 */
export const locationItems: NavItem[] = cities.map(city => ({
  label: city.displayName,
  href:  `/${city.slug}`,
}));

/**
 * Community – people and institutions around OneAIM.
 * "/partners" already exists; "/team" and "/participants" are
 * stub pages for now (content to follow).
 */
export const communityItems: NavItem[] = [
  { label: "Partners & Sponsors", href: "/partners"     },
  { label: "Team",                href: "/team"         },
  { label: "Participants",        href: "/participants" },
];

/**
 * Global top-level navigation.
 *
 * "Contact Us", "Datenschutz" and "Impressum" deliberately live only in the
 * footer (see Footer.astro) – the header stays limited to content.
 *
 * "Locations" and "Programs" only bundle their sub-entries and deliberately
 * have no target of their own (href empty): there is no overview page,
 * the individual pages are reachable directly via the dropdown.
 */
export const globalNavItems: NavItem[] = [
  { label: "Locations",    href: "",              children: locationItems },
  { label: "Programs",     href: "",              children: programNavItems },
  { label: "Community",    href: "",              children: communityItems },
  { label: "News",         href: "/news"          },
  { label: "Publications", href: "/publications"  },
];


