// Decides whether TODAY is a date on which the website's build output
// changes (an application round opening or closing, an event moving
// from upcoming to past). Used by the nightly-build workflow: it only
// pushes its rebuild commit to main when this script says so.
//
// The dates are extracted from the databases, so there is no second
// list to maintain: editing applications.ts/eventsData.ts is enough.
//
// Exit code 0 = flip day (rebuild), 1 = nothing changes today.

import { readFileSync } from "node:fs";

// Comment lines are dropped so example dates in doc comments don't count.
const read = p =>
  readFileSync(new URL(`../../${p}`, import.meta.url), "utf8")
    .split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

const plusOne = iso => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const flipDates = new Set();

// Application rounds: the status flips ON opensAt (upcoming -> open)
// and the day AFTER the deadline (open -> closed).
const apps = read("src/data/applications.ts");
for (const [, key, iso] of apps.matchAll(/(opensAt|deadline):\s*"(\d{4}-\d{2}-\d{2})"/g)) {
  flipDates.add(key === "opensAt" ? iso : plusOne(iso));
}

// Educate events: an event moves to "past" after its (end) date.
// Both date and endDate are added; a superfluous rebuild is harmless.
const events = read("src/data/eventsData.ts");
for (const [, , iso] of events.matchAll(/(date|endDate):\s*"(\d{4}-\d{2}-\d{2})"/g)) {
  flipDates.add(iso);
  flipDates.add(plusOne(iso));
}

// "Today" in German time - the audience's calendar, and by 02:30 UTC
// (when the workflow runs) the UTC date Netlify builds with matches it.
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" })
  .format(new Date());

console.log(`Today: ${today}`);
console.log(`Flip dates: ${[...flipDates].sort().join(", ")}`);

if (flipDates.has(today)) {
  console.log("-> Flip day: the site changes today, rebuild needed.");
  process.exit(0);
}
console.log("-> No change today, skipping the rebuild.");
process.exit(1);
