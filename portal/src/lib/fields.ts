// portal/src/lib/fields.ts
//
// Field catalogue for the form builder, default email templates and small
// helpers shared by the team and the apply side.

import type {
  Application, EmailTemplate, Field, FieldKind, Pipeline, SubmissionStatus, TemplateKey,
} from "./types";

export interface KindInfo {
  label: string;
  /** Profile fields can be added once per form and fill the network profile */
  profile: boolean;
  defaultLabel: string;
  hasOptions?: boolean;
}

export const KINDS: Record<FieldKind, KindInfo> = {
  name:         { label: "Full name",        profile: true,  defaultLabel: "Full name" },
  email:        { label: "Email",            profile: true,  defaultLabel: "Email address" },
  cv:           { label: "CV upload",        profile: true,  defaultLabel: "CV (PDF)" },
  phone:        { label: "Phone",            profile: true,  defaultLabel: "Phone number" },
  linkedin:     { label: "LinkedIn",         profile: true,  defaultLabel: "LinkedIn profile" },
  university:   { label: "University affiliations", profile: true, defaultLabel: "University affiliations" },
  studyProgram: { label: "Study programs",   profile: true,  defaultLabel: "Study program(s)" },
  company:      { label: "Company affiliations", profile: true, defaultLabel: "Company affiliations" },
  semester:     { label: "Semester",         profile: true,  defaultLabel: "Current semester" },
  degree:       { label: "Degree level",     profile: true,  defaultLabel: "Degree level", hasOptions: true },
  shortText:    { label: "Short text",       profile: false, defaultLabel: "Short answer" },
  longText:     { label: "Long text",        profile: false, defaultLabel: "Long answer" },
  single:       { label: "Single choice",    profile: false, defaultLabel: "Pick one", hasOptions: true },
  multi:        { label: "Multiple choice",  profile: false, defaultLabel: "Pick all that apply", hasOptions: true },
  dropdown:     { label: "Dropdown",         profile: false, defaultLabel: "Select", hasOptions: true },
  file:         { label: "File upload",      profile: false, defaultLabel: "Upload a file" },
  url:          { label: "Link / URL",       profile: false, defaultLabel: "Link" },
  number:       { label: "Number",           profile: false, defaultLabel: "Number" },
  date:         { label: "Date",             profile: false, defaultLabel: "Date" },
  yesno:        { label: "Yes / no",         profile: false, defaultLabel: "Yes or no?" },
};

/** Optional profile fields (the core ones are in every form anyway) */
export const PROFILE_KINDS: FieldKind[] = ["cv", "phone", "linkedin"];
export const CUSTOM_KINDS: FieldKind[] =
  ["shortText", "longText", "single", "multi", "dropdown", "file", "url", "number", "date", "yesno"];

// Same lists as the database (degree_options() / semester_options())
export const DEGREE_OPTIONS = ["Bachelor", "Master", "State exam (Staatsexamen)", "Diploma", "PhD / Doctorate", "Graduated / working", "Not studying"];
export const SEMESTER_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "12+", "Not applicable"];
export const UNIVERSITY_HELP = "List every university you are or were affiliated with: your degree program(s), exchange semesters, research internships, theses abroad, etc.";
export const COMPANY_HELP = "Add every company you work or worked at, with your position and when: internships, working student jobs, work experience, etc.";
/** Answer of the company field when someone hasn't worked at a company yet */
export const NO_COMPANY = "none";
/** Prefix for free-text answers from "Other (please specify)" */
export const OTHER_LABEL = "Other (please specify)";

// ── Participation fee: stored as "<amount> <currency code>", e.g. "50 EUR" ──

export const CURRENCIES: [string, string][] = [
  ["EUR", "Euro (€)"], ["CHF", "Swiss franc (CHF)"], ["GBP", "British pound (£)"], ["USD", "US dollar ($)"],
  ["SEK", "Swedish krona (SEK)"], ["DKK", "Danish krone (DKK)"], ["NOK", "Norwegian krone (NOK)"],
  ["PLN", "Polish złoty (PLN)"], ["CZK", "Czech koruna (CZK)"],
];
const SYMBOLS: [RegExp, string][] = [[/€|\beur\b|euro/i, "EUR"], [/£|\bgbp\b/i, "GBP"], [/\$|\busd\b/i, "USD"], [/\bchf\b|\bfr\./i, "CHF"]];

/** Splits a stored fee into amount and currency (also understands older free text like "50 €") */
export function parseFee(fee?: string): { amount: string; currency: string } {
  if (!fee) return { amount: "", currency: "" };
  const amount = fee.match(/\d+(?:[.,]\d{1,2})?/)?.[0]?.replace(",", ".") ?? "";
  const code = fee.match(/\b[A-Z]{3}\b/)?.[0];
  const currency = code && CURRENCIES.some(([c]) => c === code) ? code : SYMBOLS.find(([re]) => re.test(fee))?.[1] ?? "";
  return { amount, currency };
}

export const feeValue = (amount: string, currency: string) => (amount.trim() ? `${amount.trim()} ${currency}`.trim() : undefined);

/** "€50", "CHF 80", "£12.50" – or the stored text if it can't be read */
export function formatFee(fee?: string): string | undefined {
  if (!fee) return undefined;
  const { amount, currency } = parseFee(fee);
  const n = Number(amount);
  if (!amount || !currency || Number.isNaN(n)) return fee;
  if (n === 0) return "Free";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
}

export function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 10);
}

export function newField(kind: FieldKind): Field {
  const info = KINDS[kind];
  return {
    id: uid("f_"),
    kind,
    label: info.defaultLabel,
    required: kind === "name" || kind === "email",
    ...(info.hasOptions && kind !== "degree" ? { options: ["Option 1", "Option 2"] } : {}),
    ...(kind === "longText" ? { maxWords: 200 } : {}),
  };
}

/** Core fields: part of every form, always mandatory (enforced by the database too). */
export const LOCKED_KINDS: FieldKind[] = ["name", "email", "university", "studyProgram", "company", "semester", "degree"];

export function baseFields(): Field[] {
  return [
    { id: "name", kind: "name", label: "Full name", required: true },
    { id: "email", kind: "email", label: "Email address", required: true },
    { id: "university", kind: "university", label: "University affiliations", help: UNIVERSITY_HELP, required: true },
    { id: "studyProgram", kind: "studyProgram", label: "Study program(s)", required: true },
    { id: "company", kind: "company", label: "Company affiliations", help: COMPANY_HELP, required: true },
    { id: "semester", kind: "semester", label: "Current semester", required: true },
    { id: "degree", kind: "degree", label: "Degree level", required: true },
  ];
}

// ── Pipelines ────────────────────────────────────────────────────────────

export const PIPELINES: Record<Pipeline, { label: string; short: string; steps: string[]; description: string }> = {
  instant: {
    label: "Instant confirmation",
    short: "Instant",
    steps: ["Submitted", "Confirmed"],
    description: "Everyone who applies is confirmed right away. For open events and lectures.",
  },
  screening: {
    label: "Screening",
    short: "Screening",
    steps: ["Submitted", "Screening", "Accepted / Rejected"],
    description: "The team screens the CV and answers, then accepts or rejects.",
  },
  interview: {
    label: "Screening + interview",
    short: "Interview",
    steps: ["Submitted", "Screening", "Interview", "Accepted / Rejected"],
    description: "Screening first, then invite to an interview or reject. Final decision after the interview.",
  },
};

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  new: "New",
  invited: "Interview",
  accepted: "Accepted",
  rejected: "Rejected",
  confirmed: "Confirmed",
};

// ── Email templates ──────────────────────────────────────────────────────

export const PLACEHOLDERS = [
  "{first_name}", "{full_name}", "{application}", "{program}", "{location}",
  "{semester}", "{deadline}", "{start_date}", "{booking_link}",
  "{interview_time}", "{interview_place}", "{meeting_link}",
];

/** Placeholders that only make sense in some templates */
export const PLACEHOLDER_ONLY: Record<string, TemplateKey[]> = {
  "{booking_link}": ["invite", "interview_booked"],
  "{interview_time}": ["interview_booked"],
  "{interview_place}": ["interview_booked"],
  "{meeting_link}": ["interview_booked"],
};

export function defaultTemplates(pipeline: Pipeline): Record<TemplateKey, EmailTemplate> {
  return {
    confirmation: pipeline === "instant"
      ? {
          subject: "You're in: {application}",
          body:
            "Hi {first_name},\n\nthanks for registering for {application}. Your spot is confirmed.\n" +
            "We'll send you all details closer to the date.\n\nSee you there!\nYour OneAIM {location} team",
        }
      : {
          subject: "We received your application – {application}",
          body:
            "Hi {first_name},\n\nthank you for applying to {application}! We received your application " +
            "and will get back to you after the deadline ({deadline}).\n\nBest,\nYour OneAIM {location} team",
        },
    invite: {
      subject: "Interview invitation – {application}",
      body:
        "Hi {first_name},\n\nwe enjoyed reading your application and would love to get to know you " +
        "in a short interview (about 15 minutes).\n\nPlease pick a time slot here:\n{booking_link}\n\n" +
        "Best,\nYour OneAIM {location} team",
    },
    interview_booked: {
      subject: "Interview confirmed – {application}",
      body:
        "Hi {first_name},\n\nyour interview is confirmed:\n\nWhen: {interview_time}\nWhere: {interview_place}\n" +
        "Meeting link: {meeting_link}\n\nNeed a different time? You can change your slot here:\n{booking_link}\n\n" +
        "See you soon!\nYour OneAIM {location} team",
    },
    rejection: {
      subject: "Your application to {application}",
      body:
        "Hi {first_name},\n\nthank you for your interest in {application}. We received many strong " +
        "applications and unfortunately can't offer you a spot this time.\n\nWe'd be happy to see you " +
        "apply again and at our open events.\n\nBest,\nYour OneAIM {location} team",
    },
    acceptance: {
      subject: "Welcome to {application}!",
      body:
        "Hi {first_name},\n\ncongratulations, you're in! We're excited to welcome you to {application}, " +
        "starting {start_date}.\n\nWe'll be in touch with all details shortly.\n\nBest,\nYour OneAIM {location} team",
    },
  };
}

export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  confirmation: "Confirmation (after submitting)",
  invite: "Interview invitation",
  interview_booked: "Interview confirmed (after booking)",
  rejection: "Rejection",
  acceptance: "Acceptance",
};

export function templatesFor(pipeline: Pipeline): TemplateKey[] {
  if (pipeline === "instant") return ["confirmation"];
  if (pipeline === "screening") return ["confirmation", "acceptance", "rejection"];
  return ["confirmation", "invite", "interview_booked", "acceptance", "rejection"];
}

// ── Formatting ───────────────────────────────────────────────────────────

const dFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const tFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const wdFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

export const fmtDate = (iso?: string) => (iso ? dFmt.format(new Date(iso)).replace("Sept", "Sep") : "–");
export const fmtShort = (iso?: string) => (iso ? dShort.format(new Date(iso)).replace("Sept", "Sep") : "–");
export const fmtTime = (iso: string) => tFmt.format(new Date(iso));
export const fmtSlot = (iso: string) => `${wdFmt.format(new Date(iso)).replace("Sept", "Sep")}, ${fmtTime(iso)}`;

export function appTitle(app: Pick<Application, "title" | "tags">): string {
  return app.title || `${app.tags.program} ${app.tags.location} – ${app.tags.semester}`;
}

export type AppPhase = "draft" | "upcoming" | "open" | "closed";

export function today(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

export function appPhase(app: Application, now = today()): AppPhase {
  if (!app.published) return "draft";
  if (now < app.dates.opensAt) return "upcoming";
  if (now <= app.dates.deadline) return "open";
  return "closed";
}

export const PHASE_LABEL: Record<AppPhase, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  open: "Open",
  closed: "Closed",
};

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("");
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
