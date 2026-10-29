// Line icons (24px grid, stroke = currentColor).
import type { SVGAttributes } from "preact";

type P = SVGAttributes<SVGSVGElement>;
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.8,
  "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": true } as const;

export const IconHome = (p: P) => <svg {...base} {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>;
export const IconApps = (p: P) => <svg {...base} {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
export const IconBlueprint = (p: P) => <svg {...base} {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 17.5h7M17.5 14v7" /></svg>;
export const IconNetwork = (p: P) => <svg {...base} {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.8-3.3 3.2-5 6-5s5.2 1.7 6 5" /><circle cx="17.5" cy="9" r="2.4" /><path d="M16 14.6c2.6-.3 4.4 1.3 5 4.4" /></svg>;
export const IconSettings = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
export const IconMail = (p: P) => <svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6 8.5-6" /></svg>;
export const IconLogout = (p: P) => <svg {...base} {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" /></svg>;
export const IconPlus = (p: P) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const IconUp = (p: P) => <svg {...base} {...p}><path d="m6 15 6-6 6 6" /></svg>;
export const IconDown = (p: P) => <svg {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>;
export const IconTrash = (p: P) => <svg {...base} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
export const IconCopy = (p: P) => <svg {...base} {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>;
export const IconX = (p: P) => <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const IconMenu = (p: P) => <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const IconExternal = (p: P) => <svg {...base} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;
export const IconFile = (p: P) => <svg {...base} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>;
export const IconSearch = (p: P) => <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>;
export const IconCalendar = (p: P) => <svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
export const IconCheck = (p: P) => <svg {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const IconDownload = (p: P) => <svg {...base} {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
export const IconChart = (p: P) => <svg {...base} {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
export const IconTeam = (p: P) => <svg {...base} {...p}><rect x="9" y="3" width="6" height="5" rx="1.2" /><rect x="3" y="16" width="6" height="5" rx="1.2" /><rect x="15" y="16" width="6" height="5" rx="1.2" /><path d="M12 8v4M6 16v-4h12v4" /></svg>;
export const IconCrm = (p: P) => <svg {...base} {...p}><rect x="4" y="3" width="15" height="18" rx="2" /><circle cx="11.5" cy="10" r="2.6" /><path d="M7.5 17c.6-2 2.1-3 4-3s3.4 1 4 3M2.5 8h3M2.5 13h3M21 7v4" /></svg>;
export const IconBoard = (p: P) => <svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h6M7 13h10M7 17h4" /><circle cx="17" cy="9" r="1.2" /></svg>;
