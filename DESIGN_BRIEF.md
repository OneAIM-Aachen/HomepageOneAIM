# Design brief — "Germany's First Student-Led …" intro section

## What to redesign

The introduction section on the **landing page**, directly below the
"Our partners & sponsors include" logo band and above "Our Mission".

- Rendered by: `src/components/sections/ContentSection.astro`
- Used at: `src/pages/index.astro` (the first `<ContentSection>`)
- Design tokens: `src/styles/tokens.css`, base styles `src/styles/global.css`

`ContentSection` is a **shared, reusable component** — it is also used on the
city pages (`src/pages/[city]/aim-connect.astro`, `aim-code.astro`) and
elsewhere. Either keep the existing props/API intact, or say explicitly that the
landing page should get its own dedicated component instead. Please don't
silently change the shared component in a way that breaks the other pages.

## Current props and copy

```astro
<ContentSection
  heading="Germany's First Student-Led"
  headingAccent="Interdisciplinary Initiative in MedTech"
  background="page"
>
  <p>OneAIM (AI in Medicine) is Europe's biggest student-led initiative …</p>
  <p>Located in Munich and Aachen, we bridge the academic and professional gap …</p>
</ContentSection>
```

`headingAccent` renders in AIM Blue (`.text-accent`), the rest in ink.
`background` accepts `"page" | "subtle" | "surface"`.

## Design language to match

The landing page was redesigned in this same design language (see
`website/REDESIGN_NOTES.md`): white page background, ink headings at weight 800
with `-0.02em` letter-spacing, purple uppercase overlines, pill buttons,
hairline cards with soft blue shadows, brand ease-out motion
(`cubic-bezier(0.22, 1, 0.36, 1)`).

Neighbouring sections for reference:
- `src/components/sections/MapHero.astro` — hero above (DACH map, purple overline)
- `src/components/sections/PartnersSection.astro` — logo marquee directly above
- `src/components/sections/MissionSection.astro` — Light-Blue rounded panel below

The section currently sits between two white sections, so it reads as one
undifferentiated white stretch. Giving it its own visual identity is a large
part of the goal.

## Known problems to solve

1. **The heading duplicates the hero.** The hero lead reads "Germany's first
   student-led interdisciplinary initiative in MedTech." and this heading says
   the same words again, one scroll below — in different casing (sentence case
   in the hero, Title Case here).
2. **Contradictory claims.** The hero says "Germany's first", the body here says
   "Europe's biggest". Both appear within one scroll.
3. **Two long unbroken paragraphs.** Roughly 120 words with no visual entry
   point — no stats, pull quote, image or subheadings.
4. **"the medtech field"** appears lowercase in the partners subtitle above,
   while the rest of the site writes `MedTech`.

## Not in scope

Everything else on the landing page — hero, logo marquee, mission grid,
approach section, footer — stays as is.
