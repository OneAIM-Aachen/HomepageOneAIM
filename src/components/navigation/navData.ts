// src/components/navigation/navData.ts
//
// Einzige Quelle der Navigationsstruktur (Single Source of Truth).
// Wird von Header.astro (global) und CityTabs.astro (lokal) verwendet.

export interface NavItem {
  label: string;
  href:  string;
}

/**
 * Globale Top-Level-Navigation.
 * Entspricht den Flowchart-Knoten direkt unter "Home".
 *
 * "Contact Us" verwendet einen Anker-Link (#contact) statt einer eigenen
 * Seite. Der Browser scrollt sanft zur id="contact" im Footer der jeweils
 * aktuellen Seite – keine Navigation zu einer neuen URL.
 */
export const globalNavItems: NavItem[] = [
  { label: "München",    href: "/muenchen"  },
  { label: "Aachen",     href: "/aachen"    },
  { label: "News",       href: "/news"      },
  { label: "Publications", href: "/publications" },
  // ↓ Anker-Link – öffnet KEINE neue Seite, scrollt zum Footer-Kontaktbereich
  { label: "Contact Us", href: "#contact"   },
  { label: "Impressum",  href: "/impressum" },
];

/**
 * Lokale Unterstruktur pro Standort (München/Aachen).
 * Identisch für beide Städte – slug unterscheidet die Links.
 */
export const cityProgramSlugs = [
  { label: "AIM Connect", slug: "aim-connect" },
  { label: "AIM Code",    slug: "aim-code"    },
  { label: "Team",        slug: "team"        },
] as const;

/**
 * Erzeugt die lokale Subnav für einen Standort.
 * Übersichts-Link wird vorangestellt.
 */
export function getCityNavItems(citySlug: "muenchen" | "aachen"): NavItem[] {
  const programs = cityProgramSlugs.map(({ label, slug }) => ({
    label,
    href: `/${citySlug}/${slug}`,
  }));
  return [{ label: "Übersicht", href: `/${citySlug}` }, ...programs];
}
