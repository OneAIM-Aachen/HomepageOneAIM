// src/components/navigation/navData.ts
//
// Einzige Quelle der Navigationsstruktur, abgeleitet 1:1 aus dem finalen
// Sitemap-Flowchart. Wird von Header.astro (global) und künftig von
// CityTabs.astro (lokal, München/Aachen) gemeinsam genutzt, damit die
// Struktur nicht an zwei Stellen gepflegt werden muss.

export interface NavItem {
  label: string;
  href: string;
}

/**
 * Globale Top-Level-Navigation.
 * Entspricht den Flowchart-Knoten direkt unter "Home":
 * München, Aachen, News, Publications, Contact Us, Impressum.
 * (LinkedIn ist im Flowchart ein "External Link"-Blatt und wird bewusst
 * als Icon-Link statt als Textlink in der Liste geführt – siehe Header.)
 */
export const globalNavItems: NavItem[] = [
  { label: "München", href: "/muenchen" },
  { label: "Aachen", href: "/aachen" },
  { label: "News", href: "/news" },
  { label: "Publications", href: "/publications" },
  { label: "Contact Us", href: "/contact" },
  { label: "Impressum", href: "/impressum" },
];

/**
 * Lokale Unterstruktur pro Standort, laut Flowchart für München UND Aachen
 * identisch: AIM Connect, AIM Code, Team.
 */
export const cityProgramSlugs = [
  { label: "AIM Connect", slug: "aim-connect" },
  { label: "AIM Code", slug: "aim-code" },
  { label: "Team", slug: "team" },
] as const;

/**
 * Erzeugt die lokale Navigation für einen Standort (München/Aachen):
 * "Übersicht" (Hub) + AIM Connect, AIM Code, Team.
 * Identisch für beide Standorte – nur citySlug unterscheidet die Links.
 */
export function getCityNavItems(citySlug: "muenchen" | "aachen"): NavItem[] {
  const programItems = cityProgramSlugs.map(({ label, slug }) => ({
    label,
    href: `/${citySlug}/${slug}`,
  }));

  return [{ label: "Übersicht", href: `/${citySlug}` }, ...programItems];
}
