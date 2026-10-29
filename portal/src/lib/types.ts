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
  | "studyProgram" | "company" | "semester" | "degree" | "cv"
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
  /** Team members who lead the interview */
  interviewerIds: string[];
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
  /** Rating forms per stage (copies of scorecard templates) */
  scorecards: Partial<Record<ReviewStage, Scorecard>>;
  createdAt: string;
  createdBy: string;
}

export interface FileRef {
  fileName: string;
  size: number;
  /** Storage path in bucket "application-files" */
  path?: string;
}
export type Answer = string | string[] | boolean | FileRef | CompanyEntry[] | undefined;

export interface Comment {
  author: string; text: string; at: string;
  /** Applicant's status when the note was written */
  stage?: SubmissionStatus;
  memberId?: string;
}

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
  /** Team members assigned to review (team_members.id) */
  reviewerIds: string[];
  /** Filled-in scorecards (one per member and stage) */
  scoreSheets: ScoreSheet[];
}

export type ReviewStage = "screening" | "interview";

export interface ScoreSheet {
  id: string;
  memberId: string;
  stage: ReviewStage;
  /** criterion id → 1..5 */
  scores: Record<string, number>;
  note?: string;
  updatedAt: string;
}

export interface Criterion { id: string; label: string; help?: string; weight: number }

/** Rating form: template (Blueprints → Scorecards) or an application's copy */
export interface Scorecard { id?: string; name: string; description?: string; criteria: Criterion[] }

export interface Person {
  id: string;
  email: string;
  name: string;
  phone?: string;
  linkedin?: string;
  /** University affiliations (degree, exchange, research stays, theses …) */
  universities: string[];
  studyPrograms: string[];
  /** Internships, working student jobs, work experience */
  companies: CompanyEntry[];
  semester?: string;
  degree?: string;
  /** Latest CV upload (older CVs stay with their submission) */
  cv?: FileRef & { submissionId: string; uploadedAt: string };
  firstSeen: string;
}

/** The signed-in team member (or, until personal accounts are set up, an old city login) */
export interface Account {
  id: string;
  /** team_members.id; missing for an old city login */
  memberId?: string;
  name: string;
  city: string;
  email: string;
  /** Old shared city login, only used to invite the first members */
  legacy?: boolean;
}

export type TeamRole = "president" | "co_president" | "lead" | "member";

export interface Department {
  id: string;
  city: string;
  name: string;
  order: number;
}

export interface TeamMember {
  id: string;
  /** Network profile (universities, study programs, phone, LinkedIn, applications); set once there's an email */
  personId?: string;
  /** Missing for profiles without a login yet (e.g. imported from the website) */
  email?: string;
  /** Only used while there's no network profile (then LinkedIn lives there) */
  linkedin?: string;
  name: string;
  city: string;
  role: TeamRole;
  departmentId?: string;
  position?: string;
  photo?: string;
  memberSince?: string;
  about?: string;
  invitedAt?: string;
  /** Has set a password (invitation accepted) */
  active: boolean;
  lastSignInAt?: string;
  /** Alumni have left the team: not in the organigram, no portal access */
  status: "active" | "alumni";
  alumniSince?: string;
  /** Yearly "still active?" check */
  nextCheckAt?: string;
  checkSentAt?: string;
  checkRemindedAt?: string;
  lastConfirmedAt?: string;
  /** Positions over time, oldest first */
  history: RoleEntry[];
}

/** One position a member held, from – to (to empty = current) */
export interface RoleEntry {
  id: string;
  city: string;
  role: TeamRole;
  departmentId?: string;
  department?: string;
  position?: string;
  from: string;
  to?: string;
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

export interface ListUniversity { id: string; name: string; city?: string; country?: string; aliases: string[] }
export interface ListStudyProgram { id: string; name: string; category: string }
export interface ListCompany { id: string; name: string; category: string; aliases: string[] }

/** One company affiliation: company (from the list), position, start / end month ("YYYY-MM"; no end = until today) */
export interface CompanyEntry { company: string; position: string; from: string; to?: string }

/** Options for the profile fields of every form */
export interface FormOptions {
  universities: { name: string; country?: string; aliases?: string[] }[];
  studyPrograms: { name: string; category: string }[];
  companies: { name: string; category: string; aliases?: string[] }[];
}

export interface TagLists {
  semesters: string[];
  programs: string[];
  locations: string[];
}

export interface State {
  team: TeamMember[];
  scorecards: Scorecard[];
  /** Network board (all statuses) */
  posts: import("../components/network/Board").Post[];
  /** Logins for the members site, by person id */
  networkAccounts: Record<string, { invitedAt?: string }>;
  departments: Department[];
  tagLists: TagLists;
  blueprints: Blueprint[];
  applications: Application[];
  submissions: Submission[];
  people: Person[];
  outbox: SentEmail[];
  inbox: InboxMessage[];
  universities: ListUniversity[];
  studyPrograms: ListStudyProgram[];
  companies: ListCompany[];
  mailbox: MailboxStatus | null;
}
