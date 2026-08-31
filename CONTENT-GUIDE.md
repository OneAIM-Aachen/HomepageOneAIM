# OneAIM Website: Content Guide

All content on this website is driven by a handful of TypeScript "databases" in
`src/data/`. Adding or changing content means editing one of these files. You
never have to touch a page: every page reads from the databases and rebuilds
automatically.

**General workflow**

1. If the entry needs an image, copy it into the right folder under `public/images/`.
2. Add or edit the entry in the database file (each file starts with a boxed
   comment explaining its fields).
3. Run `npm run dev` to check the result, then commit and push.

**Formats used everywhere**

- Dates are ISO strings: `"2026-09-01"` (year-month-day).
- City slugs are exactly `"munich"`, `"aachen"` or `"frankfurt"`.
- Program slugs come from `programs.ts`: `"aim-connect"`, `"aim-code"`,
  `"aim-innovate"`, `"aim-educate"`, `"aim-science"`.
- Image paths are relative to `public/`, e.g. `"/images/news/photo.jpg"`.
- `id` values become URLs, so keep them lowercase-with-dashes and stable.
- Fields marked `(optional)` below can simply be left out.

**Important:** the site is static. Anything derived from dates (applications
flipping to "open", events moving to "past") only changes with the next
build/deploy after that date.

---

## Applications: `src/data/applications.ts`

One entry = one application round. The status (upcoming / open / closed) is
**computed from the dates**, never set by hand. Drives the application cards on
the city heroes and program pages, the semester timelines, all apply buttons
and the announcement banner on the landing page.

```ts
{
  id:       "aachen-aim-connect-ws26",   // "<city>-<program>-<ws|ss><year>"
  city:     "aachen",                    // city slug
  program:  "aim-connect",               // program slug
  semester: "WS",                        // "WS" | "SS"
  year:     2026,                        // WS 2026 renders as "WS 26/27"
  opensAt:  "2026-08-30",                // applications open on this date
  deadline: "2026-09-21",                // (optional) missing = "to be announced"
  interviewsFrom: "2026-09-25",          // (optional) interview window start
  interviewsTo:   "2026-09-27",          // (optional) interview window end
  interviewsLabel: "Oct",                // (optional) free text if only the month is known
  decisionBy: "2026-09-27",              // (optional) offers sent by this date
  startsAt:  "2026-10-23",               // (optional) program start
  spots:     20,                         // (optional) number of spots
  applyUrl:  "https://tally.so/r/XXXXX", // (optional) Tally form, needed once open
  note:      "Extra line on the card",   // (optional)
}
```

---

## Locations: `src/data/cityData.ts`

One entry per chapter. Filling a city page = editing only this file. Almost
every field is optional: whatever is missing shows a bracketed placeholder or
is hidden.

```ts
{
  slug: "aachen",
  displayName: "Aachen",
  coords: { lon: 6.08, lat: 50.77 },     // pin on the landing page map
  uniShort: "RWTH",                      // short label next to the pin

  // Hero
  heroImage: "/images/cities/aachen-hero.jpg",   // (optional)
  heroImageAlt: "...",                           // (optional)
  universityLogos: [                             // (optional) white chips in the hero
    { src: "/images/universities/....svg", alt: "RWTH Aachen" },
  ],
  instagram: "@oneaimaachen",                    // (optional)
  instagramHref: "https://instagram.com/...",    // (optional)
  contactEmail: "aachen@one-aim.org",            // (optional) also used on /contact

  // About-us section
  introHeading: "The first chapter outside of Munich",  // (optional) heading override
  introText: "Full custom paragraph...",                // (optional) replaces the default text
  foundedYear: 2025, universities: "RWTH Aachen",       // (optional) used if introText is absent
  story: "1-2 extra sentences",                         // (optional)
  introImage: "...", introImageAlt: "...",              // (optional) photo next to the text

  // AIM Connect panel
  connectImage: "...", connectImageAlt: "...",   // (optional) photo next to the Connect intro
  connectUpcomingEvents: [ /* TimelineRow[] */ ],// (optional) fixed dates of the next round
  connectPastTimeline:   [ /* TimelineRow[] */ ],// (optional) "How the last batch went"
  connectPastTerm: "SS 26",                      // (optional) semester caption of the recap
  connectPastToggleLabel: "Example program",     // (optional) recap toggle label override
  connectPastNote: "Shown above the recap",      // (optional) note box
  connectExampleFrom: ["munich", "aachen"],      // (optional) show other cities as example
  connectSecuredPartners: [ /* SecuredPartner[] */ ], // (optional) "Already on board"
  connectShowSecuredPartners: false,             // (optional) hide that section entirely
  connectShowFee: true,                          // (optional) show the participation-fee card

  // Program availability flags
  showInnovate: true,                            // (optional) show the Impact Hub tab
  showCode: false,                               // (optional) false hides the AIM Code tab
  codeComingSoon: true,                          // (optional) Code tab shows "Coming soon"
}
```

The two helper shapes used above:

```ts
// One row in a timeline (upcoming events or past recap)
{
  date: "23–25 Oct",                     // display string; "Week 1–8" and "[Date]" also fine
  title: "Kickoff Weekend in Berlin",
  text: "One or two sentences.",
  dot: "filled",                         // (optional) "hollow" = application step,
                                         // "filled" = event, "accent" = highlight
  partners: [                            // (optional) mini logo tiles under the row
    { name: "AMBOSS", detail: "Madjid Salimi (Founder & CEO)",  // detail optional
      logo: "/images/partners/amboss-icon.svg",                 // logo optional
      wide: true },                      // (optional) wide tile for wordmark logos
  ],
}

// One secured partner in "Already on board for the next batch"
{
  name: "Cinven",
  text: "Who this partner is and what participants will experience.",
  logo: "/images/partners/cinven.svg",   // (optional)
  wide: true,                            // (optional) wide tile for wordmark logos
  chips: ["Company visit", "Name · Position"],  // (optional, currently not rendered)
}
```

---

## Team: `src/data/teamData.ts`

All members of all chapters in one array. Photo goes into `public/images/team/`.

```ts
{
  name: "Lucas Gildehaus",
  team: "Board",                         // e.g. "AIM Connect", "Marketing", "Board"
  teamLead: false,                       // true = light card in the leads row
  president: true,                       // true = blue card, first in the row
  city: "aachen",                        // city slug, determines the page
  position: "Vice-President | Board",    // (optional) overrides the derived role line
  photo: "/images/team/lucas-gildehaus.jpg",  // (optional)
  linkedIn: "https://www.linkedin.com/in/...",// (optional) enables the hover overlay
  formerMember: true,                    // (optional) hides the person, keeps the entry
}
```

Both flags false = regular tile in "The full team" row. When someone leaves,
set `formerMember: true` instead of deleting.

---

## Partners & sponsors: `src/data/partners.ts`

Logo goes into `public/images/partners/`.

```ts
{
  id: "abiomed",                         // unique, URL-safe
  type: "partner",                       // "sponsor" | "partner" (group on /partners)
  name: "Abiomed (J&J MedTech)",
  logo: "/images/partners/abiomed.svg",
  logoAlt: "Abiomed – Logo",             // (optional)
  website: "https://www.abiomed.com/",   // (optional) makes the logo a link
  onLanding: true,                       // (optional) shows it in the landing marquee
}
```

---

## News: `src/data/newsData.ts`

Photo goes into `public/images/news/`. The newest post automatically becomes
the featured story; `cities`/`programs` place the post on the matching city
and program pages and feed the filters.

```ts
{
  id: "aachen-semester-wrapup-2026",     // becomes /news/<id>
  title: "Semester Wrap-Up Aachen",
  date: "2026-08-19",                    // drives sorting and the year filter
  excerpt: "One-liner shown on the cards.",
  body: [                                // (optional) one string per paragraph;
    "First paragraph.",                  // missing = article page shows only the teaser
    "Second paragraph.",
  ],
  image: "/images/news/wrapup.jpg",      // (optional)
  imageAlt: "...",                       // (optional)
  cities: ["aachen"],                    // (optional) city slugs
  programs: ["aim-connect"],             // (optional) program slugs
  tags: ["Wrap-Up"],                     // (optional) shown on the card, not filterable
}
```

---

## AIM Educate events: `src/data/eventsData.ts`

Whether an event shows under "Upcoming" or "Past events" is derived from the
date. Upcoming events also appear on the AIM Educate tab of their city page.

```ts
{
  id: "winter-summit-2025",
  title: "OneAIM Winter Summit 2025",
  date: "2025-02-28",                    // start date
  endDate: "2025-03-01",                 // (optional) multi-day events
  dateLabel: "Oct 2023 to Feb 2024",     // (optional) free display, overrides the dates
  city: "munich",                        // (optional) missing = shown for every city
  location: "TranslaTUM",                // (optional) venue
  text: "1-2 sentences about the event.",// (optional)
  image: "/images/events/....jpg",       // (optional) photo on the past-event card
  imageAlt: "...",                       // (optional)
  registerUrl: "https://...",            // (optional) Register button while upcoming
  recapUrl: "https://...",               // (optional) makes the past card a link
}
```

---

## Programs: `src/data/programs.ts`

Rarely edited. Controls the landing page cards and the Programs dropdown.
The dedicated program pages under `src/pages/programs/` hold their own content.

```ts
{
  slug: "aim-innovate",                  // URL segment under /programs/
  name: "AIM Innovate",                  // name used everywhere (dropdown, titles)
  text: "Card text on the landing grid.",
  variant: "gradient",                   // "feature" | "photo" | "gradient" | "light" | "outline"
  badges: ["New"],                       // (optional) small pills on the card
  cardName: "AIM Innovate Impact Hub",   // (optional) card-only title override
  image: "...", imageAlt: "...",         // (optional) for feature/photo variants
  intro: "Intro on the program page.",
  highlights: [{ title: "...", text: "..." }],
  citySlugs: ["munich"],                 // (optional) per-city links
}
```

---

## Publications: `src/data/publicationsData.ts`

Cover image goes into `public/images/publications/`.

```ts
{
  id: "ki-in-der-medizin-buch",          // becomes /publications/<id>
  title: "Künstliche Intelligenz in der Medizin",
  authors: ["F. Lastname", "S. Other"],  // always "F. Lastname" format
  year: 2026,
  description: "Short description for spotlight and list.",
  image: "/images/publications/cover.jpg",
  imageAlt: "...",                       // (optional)
  kind: "Book",                          // (optional) e.g. "Paper", "Course material"
  badge: "New release",                  // (optional) spotlight label
  link: { label: "Publisher", href: "https://..." },  // (optional)
  body: ["Paragraph 1.", "Paragraph 2."],// (optional) detail page text
}
```

---

## Navigation: `src/components/navigation/navData.ts`

The header/footer structure and the canonical city labels other files
reference. Only needs editing when a whole new page or city is added.
