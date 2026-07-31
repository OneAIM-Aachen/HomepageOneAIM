// src/components/navigation/navData.ts
//
// Einzige Quelle der Navigationsstruktur (Single Source of Truth).

export interface NavItem {
  label: string;
  href:  string;
}

/**
 * Globale Top-Level-Navigation.
 * "Contact Us" führt auf die dedizierte Kontaktseite /contact
 * (nicht mehr auf den Anker #contact im Footer).
 */
export const globalNavItems: NavItem[] = [
  { label: "München",      href: "/muenchen"      },
  { label: "Aachen",       href: "/aachen"        },
  { label: "News",         href: "/news"          },
  { label: "Publications", href: "/publications"  },
  { label: "Contact Us",   href: "/contact"       },
  { label: "Impressum",    href: "/impressum"     },
];

export const cityProgramSlugs = [
  { label: "AIM Connect", slug: "aim-connect" },
  { label: "AIM Code",    slug: "aim-code"    },
  { label: "Team",        slug: "team"        },
] as const;

export function getCityNavItems(citySlug: "muenchen" | "aachen"): NavItem[] {
  const programs = cityProgramSlugs.map(({ label, slug }) => ({
    label,
    href: `/${citySlug}/${slug}`,
  }));
  return [{ label: "Übersicht", href: `/${citySlug}` }, ...programs];
}
