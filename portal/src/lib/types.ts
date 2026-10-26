// portal/src/lib/types.ts
//
// Data model of the team portal as the UI sees it. store.ts maps it onto
// the Supabase tables (supabase/migrations). Tags are handled as display
// labels here ("AIM Connect", "WS 26/27"); the store converts them to the
// database ids ("aim-connect", "ws26").

export type Pipeline = "instant" | "screening" | "interview";

export type SubmissionStatus =
  | "new"        // submitted, waiting for screening
  | "invited"    // invited to interview (pipeline "interview" only)
  | "accepted"
  | "rejected"
  | "confirmed"; // pipeline "instant": confirmed right away

export type FieldKind =
  // Profile fields: map onto the person in the network database
  | "name" | "email" | "phone" | "linkedin" | "university"
  | "studyProgram" | "semester" | "degree" | "cv"
  // Custom questions
  | "shortText" | "longText" | "single" | "multi" | "dropdown"
  | "file" | "url" | "number" | "date" | "yesno";

export interface Field {
  id: string;
  kind: FieldKind;
  label: string;
  help?: string;
  required: boolean;
  /** single / multi / dropdown */
  options?: string[];
  /** longText */
  maxWords?: number;
}

export interface Blueprint {
  id: string;
  name: string;
  description: string;
  fields: Field[];
  updatedAt: string;
}

export interface Slot {
  id: string;
  /** ISO local date-time, e.g. "2026-11-12T17:00" */
  start: string;
  durationMin: number;
  location: string;
  capacity: number;
  /** online → needs meetingLink; in_person → needs location */
  mode: "online" | "in_person";
  /** Zoom/Teams/Meet link – only sent by email after booking, never shown on the booking page */
  meetingLink?: string;
}

export type TemplateKey = "confirmation" | "invite" | "interview_booked" | "rejection" | "acceptance";
/** Email kinds in the log: templates plus free-text team replies */
export type MailKind = TemplateKey | "reply";

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface Tags {
  semester: string;
  program: string;
  location: string;
}

export interface Application {
  id: string;
  /** Public key, e.g. "aachen-aim-connect-ws26" */
  slug: string;
  /** Optional custom title; otherwise "<Program> <Location> – <Semester>" */
  title?: string;
  blueprintName: string;
  fields: Field[];
  tags: Tags;
  pipeline: Pipeline;
  published: boolean;
  dates: {
    opensAt: string;
    deadline: string;
    interviewsFrom?: string;
    interviewsTo?: string;
    decisionBy?: string;
    startsAt?: string;
    /** Optional time on the deadline day, "12:00" */
    deadlineTime?: string;
    /** Free text instead of from/to, e.g. "Oct" */
    interviewsLabel?: string;
  };
  spots?: number;
  fee?: string;
  intro: string;
  image?: string;
  templates: Record<TemplateKey, EmailTemplate>;
  slots: Slot[];
  createdAt: string;
  createdBy: string;
}

export interface FileRef {
  fileName: string;
  size: number;
  /** Storage path in bucket "application-files" */
  path?: string;
}
export type Answer = string | string[] | boolean | FileRef | undefined;

export interface Comment { author: string; text: string; at: string }

export interface Submission {
  id: string;
  applicationId: string;
  personId: string;
  answers: Record<string, Answer>;
  status: SubmissionStatus;
  score?: number;
  bookingToken: string;
  slotId?: string;
  comments: Comment[];
  history: { status: SubmissionStatus; at: string; by: string }[];
  submittedAt: string;
}

export interface Person {
  id: string;
  email: string;
  name: string;
  phone?: string;
  linkedin?: string;
  university?: string;
  studyProgram?: string;
  semester?: string;
  degree?: string;
  /** Latest CV upload (older CVs stay with their submission) */
  cv?: FileRef & { submissionId: string; uploadedAt: string };
  firstSeen: string;
}

/** The signed-in city account */
export interface Account {
  id: string;
  city: string;
  email: string;
}

export interface SentEmail {
  id: string;
  to: string;
  toName: string;
  /** Filled by the sending function; empty while queued */
  subject: string;
  body: string;
  type: MailKind;
  status: "queued" | "sent" | "failed";
  personId?: string;
  /** Provider Message-ID once sent (for threading) */
  messageId?: string;
  /** Last error, or "test mode: sent to …" */
  error?: string;
  queuedBy: string;
  applicationId?: string;
  submissionId?: string;
  at: string;
}

/** Incoming email from the sender account's mailbox */
export interface InboxMessage {
  id: string;
  messageId?: string;
  references: string[];
  fromEmail?: string;
  fromName?: string;
  to?: string;
  cc?: string;
  subject: string;
  body: string;
  attachments: { fileName: string; size: number; mimeType?: string }[];
  receivedAt: string;
  personId?: string;
  submissionId?: string;
  matchedBy?: "thread" | "sender" | "manual";
  readAt?: string;
}

export interface MailboxStatus {
  lastSyncAt?: string;
  lastError?: string;
  syncSince: string;
}

export interface TagLists {
  semesters: string[];
  programs: string[];
  locations: string[];
}

export interface State {
  /** Cities that have a team account */
  teamCities: string[];
  tagLists: TagLists;
  blueprints: Blueprint[];
  applications: Application[];
  submissions: Submission[];
  people: Person[];
  outbox: SentEmail[];
  inbox: InboxMessage[];
  mailbox: MailboxStatus | null;
}
