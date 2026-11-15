// The four parts of the website and their addresses.
//   site    main website (one-aim.org)
//   team    team area   (team.one-aim.org)  – root of the portal build
//   apply   applications (apply.one-aim.org) – /apply in the portal build
//   network network site (network.one-aim.org) – /network in the portal build
// Deployments set PUBLIC_SITE_URL, PUBLIC_TEAM_URL, PUBLIC_APPLY_URL and
// PUBLIC_NETWORK_URL (see docs/deployment.md). Without them (local
// development) everything runs on one address: team at /, /apply, /network.

export type Area = "site" | "team" | "apply" | "network";

const BASE: Record<Area, string | undefined> = {
  site: import.meta.env.PUBLIC_SITE_URL,
  team: import.meta.env.PUBLIC_TEAM_URL,
  apply: import.meta.env.PUBLIC_APPLY_URL,
  network: import.meta.env.PUBLIC_NETWORK_URL,
};
/** Where an area lives in the portal build when it has no address of its own */
const PREFIX: Record<Area, string> = { site: "", team: "", apply: "/apply", network: "/network" };

/**
 * Link to a page of an area, e.g. areaHref("apply", "/form?a=x").
 * On the area's own address the link stays relative; from elsewhere it's absolute.
 */
export function areaHref(area: Area, path = "/"): string {
  const base = BASE[area]?.replace(/\/$/, "");
  if (!base) return area === "site" ? `https://one-aim.org${path}` : `${PREFIX[area]}${path}`;
  if (typeof location !== "undefined" && new URL(base).origin === location.origin) return path;
  return `${base}${path}`;
}

/** Absolute link (for copying / emails shown in the portal) */
export function areaUrl(area: Area, path = "/"): string {
  const href = areaHref(area, path);
  return /^https?:\/\//.test(href) ? href : `${typeof location !== "undefined" ? location.origin : ""}${href}`;
}
