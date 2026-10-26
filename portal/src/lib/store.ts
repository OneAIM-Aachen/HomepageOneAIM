// portal/src/lib/store.ts
//
// Data layer of the team area, backed by Supabase.
// • loadAll() reads everything the team views need into one in-memory state;
//   components read it synchronously with useStore(select).
// • Every action writes to Supabase and then reloads, so all views stay in sync.
// • Tags are labels in the UI ("AIM Connect") and ids in the database
//   ("aim-connect"); the mapping happens only here.
//
// The apply site doesn't use this state: it only calls the public functions
// at the bottom (published applications, submit, booking).

import { useEffect, useState } from "preact/hooks";
import type {
  Account, Answer, Application, Blueprint, FileRef, InboxMessage, Person, SentEmail, Slot, State, Submission,
  SubmissionStatus, Tags, TemplateKey, Pipeline,
} from "./types";
import { appTitle, defaultTemplates, firstName, fmtDate, today } from "./fields";
import { FILES_BUCKET, IMAGES_BUCKET, friendlyError, supabase } from "./supabase";

// ── State ────────────────────────────────────────────────────────────────

const EMPTY: State = {
  teamCities: [], tagLists: { semesters: [], programs: [], locations: [] },
  blueprints: [], applications: [], submissions: [], people: [], outbox: [], inbox: [], mailbox: null,
};

let state: State = EMPTY;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export function getState(): State { return state; }

export function useStore<T>(select: (s: State) => T): T {
  const [value, setValue] = useState(() => select(state));
  useEffect(() => {
    const l = () => setValue(select(state));
    listeners.add(l);
    l();
    return () => { listeners.delete(l); };
  }, []);
  return value;
}

/** Throws a readable Error when a Supabase call failed. */
function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw new Error(friendlyError(res.error));
  return res.data;
}

// Tag id ↔ label maps, filled by loadAll()
let maps = {
  program: new Map<string, string>(), location: new Map<string, string>(), semester: new Map<string, string>(),
};
const label = (m: Map<string, string>, id: string) => m.get(id) ?? id;
const idOf = (m: Map<string, string>, lbl: string) => [...m].find(([, v]) => v === lbl)?.[0] ?? lbl;

// Slots: timestamptz in the database, "YYYY-MM-DDTHH:mm" (local time) in the UI
const pad = (n: number) => String(n).padStart(2, "0");
function toLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapApplication(r: any, slots: Slot[]): Application {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title ?? undefined,
    blueprintName: r.blueprint_name,
    fields: r.fields ?? [],
    tags: { semester: label(maps.semester, r.semester_id), program: label(maps.program, r.program_id), location: label(maps.location, r.location_id) },
    pipeline: r.pipeline,
    published: r.published,
    dates: {
      opensAt: r.opens_at, deadline: r.deadline,
      interviewsFrom: r.interviews_from ?? undefined, interviewsTo: r.interviews_to ?? undefined,
      decisionBy: r.decision_by ?? undefined, startsAt: r.starts_at ?? undefined,
      deadlineTime: r.deadline_time ? String(r.deadline_time).slice(0, 5) : undefined,
      interviewsLabel: r.interviews_label ?? undefined,
    },
    spots: r.spots ?? undefined,
    fee: r.fee ?? undefined,
    intro: r.intro ?? "",
    image: r.image_path ?? undefined,
    // Imported rounds have no templates yet → defaults
    templates: { ...defaultTemplates(r.pipeline), ...(r.templates ?? {}) },
    slots,
    createdAt: r.created_at,
    createdBy: r.created_by_city ?? "",
  };
}

function applicationRow(a: Application) {
  return {
    slug: a.slug,
    title: a.title?.trim() || null,
    blueprint_name: a.blueprintName,
    fields: a.fields,
    program_id: idOf(maps.program, a.tags.program),
    location_id: idOf(maps.location, a.tags.location),
    semester_id: idOf(maps.semester, a.tags.semester),
    pipeline: a.pipeline,
    published: a.published,
    opens_at: a.dates.opensAt,
    deadline: a.dates.deadline,
    deadline_time: a.dates.deadlineTime || null,
    interviews_from: a.dates.interviewsFrom || null,
    interviews_to: a.dates.interviewsTo || null,
    interviews_label: a.dates.interviewsLabel?.trim() || null,
    decision_by: a.dates.decisionBy || null,
    starts_at: a.dates.startsAt || null,
    spots: a.spots ?? null,
    fee: a.fee?.trim() || null,
    intro: a.intro,
    image_path: a.image || null,
    templates: a.templates,
  };
}

export async function loadAll(): Promise<void> {
  const [programs, locations, semesters, accounts, blueprints, apps, slots, people, subs, comments, history, mails, inbox, mailbox] =
    await Promise.all([
      supabase.from("programs").select("id, name").order("sort_order"),
      supabase.from("locations").select("id, name").order("sort_order"),
      supabase.from("semesters").select("id, label, term, start_year").order("start_year").order("term", { ascending: false }),
      supabase.from("team_accounts").select("city").order("city"),
      supabase.from("blueprints").select("*").order("updated_at", { ascending: false }),
      supabase.from("applications").select("*").order("created_at", { ascending: false }),
      supabase.from("interview_slots").select("*").order("starts_at"),
      supabase.from("people").select("*").order("name"),
      supabase.from("submissions").select("*").order("submitted_at", { ascending: false }),
      supabase.from("submission_comments").select("*").order("created_at"),
      supabase.from("status_history").select("*").order("changed_at"),
      supabase.from("email_log").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("mailbox_messages").select("*").order("received_at", { ascending: false }).limit(1000),
      supabase.from("mailbox_state").select("last_sync_at, last_error, sync_since").maybeSingle(),
    ]);

  const P = check(programs) as any[], L = check(locations) as any[], S = check(semesters) as any[];
  // Semesters sorted chronologically: SS 26, WS 26/27, SS 27, …
  S.sort((a, b) => a.start_year - b.start_year || (a.term === "SS" ? -1 : 1));
  maps = {
    program: new Map(P.map(p => [p.id, p.name])),
    location: new Map(L.map(l => [l.id, l.name])),
    semester: new Map(S.map(s => [s.id, s.label])),
  };

  const slotRows = check(slots) as any[];
  const slotsByApp = new Map<string, Slot[]>();
  for (const r of slotRows) {
    const list = slotsByApp.get(r.application_id) ?? [];
    list.push({
      id: r.id, start: toLocal(r.starts_at), durationMin: r.duration_min, location: r.location, capacity: r.capacity,
      mode: r.mode, meetingLink: r.meeting_link ?? undefined,
    });
    slotsByApp.set(r.application_id, list);
  }

  const commentRows = check(comments) as any[];
  const historyRows = check(history) as any[];

  state = {
    teamCities: (check(accounts) as any[]).map(a => a.city),
    tagLists: { programs: P.map(p => p.name), locations: L.map(l => l.name), semesters: S.map(s => s.label) },
    blueprints: (check(blueprints) as any[]).map(b => ({
      id: b.id, name: b.name, description: b.description, fields: b.fields ?? [], updatedAt: b.updated_at,
    })),
    applications: (check(apps) as any[]).map(r => mapApplication(r, slotsByApp.get(r.id) ?? [])),
    people: (check(people) as any[]).map(p => ({
      id: p.id, email: p.email, name: p.name, phone: p.phone ?? undefined, linkedin: p.linkedin ?? undefined,
      university: p.university ?? undefined, studyProgram: p.study_program ?? undefined, semester: p.semester ?? undefined,
      degree: p.degree ?? undefined, cv: p.cv ?? undefined, firstSeen: p.first_seen_at,
    }) as Person),
    submissions: (check(subs) as any[]).map(x => ({
      id: x.id, applicationId: x.application_id, personId: x.person_id, answers: x.answers ?? {},
      status: x.status, score: x.score ?? undefined, bookingToken: x.booking_token, slotId: x.slot_id ?? undefined,
      submittedAt: x.submitted_at,
      comments: commentRows.filter(c => c.submission_id === x.id).map(c => ({ author: c.author_city, text: c.body, at: c.created_at })),
      history: historyRows.filter(h => h.submission_id === x.id).map(h => ({ status: h.status, at: h.changed_at, by: h.changed_by })),
    }) as Submission),
    outbox: (check(mails) as any[]).map(m => ({
      id: m.id, to: m.to_email, toName: m.to_name, subject: m.subject ?? "", body: m.body ?? "", type: m.template,
      status: m.status, error: m.error ?? undefined, queuedBy: m.queued_by, applicationId: m.application_id ?? undefined,
      submissionId: m.submission_id ?? undefined, at: m.created_at, personId: m.person_id ?? undefined,
      messageId: m.provider_message_id ?? undefined,
    }) as SentEmail),
    inbox: (check(inbox) as any[]).map(m => ({
      id: m.id, messageId: m.message_id ?? undefined, references: m.references_ids ?? [],
      fromEmail: m.from_email ?? undefined, fromName: m.from_name ?? undefined, to: m.to_text ?? undefined, cc: m.cc_text ?? undefined,
      subject: m.subject, body: m.body_text, attachments: m.attachments ?? [], receivedAt: m.received_at,
      personId: m.person_id ?? undefined, submissionId: m.submission_id ?? undefined,
      matchedBy: m.matched_by ?? undefined, readAt: m.read_at ?? undefined,
    }) as InboxMessage),
    mailbox: (() => {
      const m = check(mailbox) as any;
      return m ? { lastSyncAt: m.last_sync_at ?? undefined, lastError: m.last_error ?? undefined, syncSince: m.sync_since } : null;
    })(),
  };
  notify();
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Session ──────────────────────────────────────────────────────────────

async function accountFor(userId: string, email: string): Promise<Account | null> {
  const { data } = await supabase.from("team_accounts").select("city").eq("user_id", userId).maybeSingle();
  return data ? { id: userId, city: data.city, email } : null;
}

/** Signs in; only accounts listed in team_accounts are let in. */
export async function login(email: string, password: string): Promise<Account> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) throw new Error("Email or password is wrong.");
  const acc = await accountFor(data.user.id, data.user.email ?? email);
  if (!acc) {
    await supabase.auth.signOut();
    throw new Error("This account is not a OneAIM team account.");
  }
  return acc;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function currentAccount(): Promise<Account | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return user ? accountFor(user.id, user.email ?? "") : null;
}

export async function changePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

// ── Tags ─────────────────────────────────────────────────────────────────

export type TagListKey = keyof State["tagLists"];

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function addTag(list: TagListKey, value: string) {
  const v = value.trim();
  if (!v) return;
  if (list === "semesters") {
    const m = v.match(/^(WS|SS)\s*(\d{2})/i);
    if (!m) throw new Error('Use the format "WS 27/28" or "SS 28".');
    const term = m[1]!.toUpperCase();
    check(await supabase.from("semesters").insert({ id: `${term.toLowerCase()}${m[2]}`, term, start_year: 2000 + Number(m[2]) }));
  } else {
    const table = list === "programs" ? "programs" : "locations";
    check(await supabase.from(table).insert({ id: slugify(v), name: v, sort_order: state.tagLists[list].length + 1 }));
  }
  await loadAll();
}

export async function removeTag(list: TagListKey, value: string) {
  const table = list === "semesters" ? "semesters" : list === "programs" ? "programs" : "locations";
  const map = list === "semesters" ? maps.semester : list === "programs" ? maps.program : maps.location;
  check(await supabase.from(table).delete().eq("id", idOf(map, value)));
  await loadAll();
}

// ── Blueprints ───────────────────────────────────────────────────────────

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8);

export async function createBlueprint(name: string, from?: Blueprint): Promise<string> {
  const fields = from
    ? structuredClone(from.fields).map(f => ({ ...f, id: f.kind === "name" || f.kind === "email" ? f.id : `f_${newId()}` }))
    : [
        { id: "name", kind: "name", label: "Full name", required: true },
        { id: "email", kind: "email", label: "Email address", required: true },
      ];
  const row = check(await supabase.from("blueprints")
    .insert({ name: name.trim() || "Untitled blueprint", description: from?.description ?? "", fields })
    .select("id").single()) as { id: string };
  await loadAll();
  return row.id;
}

export async function saveBlueprint(bp: Blueprint) {
  check(await supabase.from("blueprints").update({ name: bp.name, description: bp.description, fields: bp.fields }).eq("id", bp.id));
  await loadAll();
}

export async function deleteBlueprint(id: string) {
  check(await supabase.from("blueprints").delete().eq("id", id));
  await loadAll();
}

// ── Applications ─────────────────────────────────────────────────────────

export async function createApplication(input: {
  blueprintId: string; tags: Tags; pipeline: Pipeline; title?: string; createdBy: string;
}): Promise<string> {
  const bp = state.blueprints.find(b => b.id === input.blueprintId)!;
  const base = [idOf(maps.location, input.tags.location), idOf(maps.program, input.tags.program), idOf(maps.semester, input.tags.semester)].join("-");
  const taken = new Set(state.applications.map(a => a.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

  const t = today();
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const draft: Application = {
    id: "", slug, title: input.title?.trim() || undefined, blueprintName: bp.name,
    fields: structuredClone(bp.fields),       // copy on use
    tags: { ...input.tags }, pipeline: input.pipeline, published: false,
    dates: { opensAt: t, deadline: in30 }, intro: bp.description,
    templates: defaultTemplates(input.pipeline), slots: [], createdAt: t, createdBy: input.createdBy,
  };
  const { data: auth } = await supabase.auth.getUser();
  const row = check(await supabase.from("applications")
    .insert({ ...applicationRow(draft), blueprint_id: bp.id, created_by: auth.user?.id, created_by_city: input.createdBy })
    .select("id").single()) as { id: string };
  await loadAll();
  return row.id;
}

/** Saves everything except interview slots (those have their own actions). */
export async function saveApplication(app: Application) {
  check(await supabase.from("applications").update(applicationRow(app)).eq("id", app.id));
  await loadAll();
}

export async function deleteApplication(id: string) {
  check(await supabase.from("applications").delete().eq("id", id));
  await loadAll();
}

export async function addSlots(applicationId: string, slots: Omit<Slot, "id">[]) {
  check(await supabase.from("interview_slots").insert(slots.map(s => ({
    application_id: applicationId, starts_at: new Date(s.start).toISOString(),
    duration_min: s.durationMin, location: s.location, capacity: s.capacity,
    mode: s.mode, meeting_link: s.meetingLink?.trim() || null,
  }))));
  await loadAll();
}

export async function updateSlot(slotId: string, patch: Partial<Pick<Slot, "location" | "meetingLink" | "mode">>) {
  check(await supabase.from("interview_slots").update({
    ...(patch.location !== undefined ? { location: patch.location } : {}),
    ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
    ...("meetingLink" in patch ? { meeting_link: patch.meetingLink?.trim() || null } : {}),
  }).eq("id", slotId));
  await loadAll();
}

export const slotComplete = (s: Slot) => (s.mode === "online" ? !!s.meetingLink : s.location.trim().length > 0);

export const slotIsPast = (s: Slot) => s.start <= toLocal(new Date().toISOString());

/** Why this application can't invite yet (same rule as the database), or null. */
export function inviteBlocker(app: Application): string | null {
  const now = toLocal(new Date().toISOString());
  const future = app.slots.filter(s => s.start > now);
  if (app.slots.length && !future.length) return friendlyError({ message: "slots_in_past" });
  if (!future.some(s => slotTaken(app, s.id) < s.capacity)) return friendlyError({ message: "no_free_slots" });
  if (future.some(s => !slotComplete(s))) return friendlyError({ message: "slots_incomplete" });
  return null;
}

/** Re-sends the interview confirmation (time, place, meeting link). */
export async function sendInterviewDetails(subId: string): Promise<{ sent?: number; skipped?: string }> {
  check(await supabase.rpc("send_interview_details", { p_submission_id: subId }));
  const { data } = await supabase.functions.invoke("send-emails", { body: {} });
  await loadAll();
  return data ?? {};
}

export async function removeSlot(slotId: string) {
  check(await supabase.from("interview_slots").delete().eq("id", slotId));
  await loadAll();
}

/** Header image for the public form → public bucket, returns its URL. */
export async function uploadImage(file: File): Promise<string> {
  const path = `headers/${newId()}-${slugify(file.name.replace(/\.[^.]+$/, ""))}.${file.name.split(".").pop()}`;
  check(await supabase.storage.from(IMAGES_BUCKET).upload(path, file, { contentType: file.type }));
  return supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ── Emails (preview only – sending happens in the database queue) ────────

export function bookingLink(sub: Pick<Submission, "bookingToken">): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/apply/book?t=${sub.bookingToken}`;
}

const slotFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function interviewVars(app: Application, sub?: Submission): Record<string, string> {
  const slot = sub?.slotId ? app.slots.find(s => s.id === sub.slotId) : app.slots[0];
  if (!slot) return { "{interview_time}": "Monday, 9 November, 18:00 (15 min)", "{interview_place}": "Online", "{meeting_link}": "https://zoom.us/j/…" };
  return {
    "{interview_time}": `${slotFmt.format(new Date(slot.start))} (${slot.durationMin} min, German time)`,
    "{interview_place}": slot.location || "Online",
    "{meeting_link}": slot.meetingLink || "follows in a separate email",
  };
}

export function renderTemplate(text: string, app: Application, person: Pick<Person, "name">, sub?: Submission): string {
  const vars: Record<string, string> = {
    "{first_name}": firstName(person.name),
    "{full_name}": person.name,
    "{application}": appTitle(app),
    "{program}": app.tags.program,
    "{location}": app.tags.location,
    "{semester}": app.tags.semester,
    "{deadline}": fmtDate(app.dates.deadline),
    "{start_date}": fmtDate(app.dates.startsAt),
    "{booking_link}": sub ? bookingLink(sub) : "https://apply.one-aim.org/book/…",
    ...interviewVars(app, sub),
  };
  return text.replace(/\{[a-z_]+\}/g, m => vars[m] ?? m);
}

// ── Team decisions, scores, comments ─────────────────────────────────────

export type Decision = "invite" | "accept" | "reject" | "reset";

export interface DecideResult {
  changed: number;
  /** Emails sent right away; undefined if no email was due */
  sent?: number;
  failed?: number;
  /** Why emails were held back, e.g. test mode without test inbox */
  skipped?: string;
}

/** Validated in the database (decide()); the matching emails are sent right away. */
export async function decide(subIds: string[], decision: Decision, _by: string, sendMail = true): Promise<DecideResult> {
  const changed = check(await supabase.rpc("decide", { p_submission_ids: subIds, p_decision: decision, p_send_email: sendMail })) as number;
  let result: DecideResult = { changed };
  if (sendMail && changed > 0 && decision !== "reset") {
    // The database also starts the sender by itself; calling it here lets us
    // show the outcome immediately.
    const { data } = await supabase.functions.invoke("send-emails", { body: {} });
    result = { changed, sent: data?.sent, failed: data?.failed, skipped: data?.skipped };
  }
  await loadAll();
  return result;
}

export async function setScore(subId: string, score: number | undefined) {
  check(await supabase.from("submissions").update({ score: score ?? null }).eq("id", subId));
  await loadAll();
}

export async function addComment(subId: string, _author: string, text: string) {
  if (!text.trim()) return;
  // author_id / author_city are set by the database from the session
  check(await supabase.from("submission_comments").insert({ submission_id: subId, body: text.trim() }));
  await loadAll();
}

export function slotTaken(app: Application, slotId: string, exceptSub?: string): number {
  return state.submissions.filter(x => x.applicationId === app.id && x.slotId === slotId && x.id !== exceptSub).length;
}

/** Opens an applicant's file (CV, upload) via a short-lived signed link. */
export async function openFile(file: FileRef) {
  if (!file.path) throw new Error("This file has no stored copy.");
  const win = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(file.path, 300);
  if (error || !data) { win?.close(); throw new Error("Could not open the file."); }
  if (win) win.location.href = data.signedUrl; else window.location.href = data.signedUrl;
}

// ── Public (apply site) ──────────────────────────────────────────────────

export interface PublicApplication extends Application {
  phase: "upcoming" | "open" | "closed";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchPublishedApplications(): Promise<PublicApplication[]> {
  const rows = check(await supabase.rpc("published_applications")) as any[];
  return rows.map(r => ({
    id: r.id, slug: r.slug, title: r.display_title, blueprintName: "", fields: r.fields ?? [],
    tags: { semester: r.semester_label, program: r.program_name, location: r.location_name },
    pipeline: r.pipeline, published: true, phase: r.phase,
    dates: {
      opensAt: r.opens_at, deadline: r.deadline, interviewsFrom: r.interviews_from ?? undefined,
      interviewsTo: r.interviews_to ?? undefined, decisionBy: r.decision_by ?? undefined, startsAt: r.starts_at ?? undefined,
      deadlineTime: r.deadline_time ? String(r.deadline_time).slice(0, 5) : undefined, interviewsLabel: r.interviews_label ?? undefined,
    },
    spots: r.spots ?? undefined, fee: r.fee ?? undefined,
    intro: r.intro ?? "", image: r.image_path ?? undefined,
    templates: defaultTemplates(r.pipeline), slots: [], createdAt: "", createdBy: "",
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const safeName = (n: string) => n.replace(/[^\w.\-]+/g, "_").slice(-120);

/** Uploads files, then submits. Returns null on success, else an error text. */
export async function submitApplication(
  app: Application, answers: Record<string, Answer>, files: Record<string, File>, consent: boolean,
): Promise<string | null> {
  try {
    const final = { ...answers };
    for (const [fieldId, file] of Object.entries(files)) {
      const path = `uploads/${app.id}/${crypto.randomUUID()}/${safeName(file.name)}`;
      const up = await supabase.storage.from(FILES_BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (up.error) return `Uploading "${file.name}" failed. Please check it is a PDF/Word/image under 10 MB.`;
      final[fieldId] = { path, fileName: file.name, size: file.size };
    }
    const { error } = await supabase.rpc("submit_application", { p_application_id: app.id, p_answers: final, p_consent: consent });
    return error ? friendlyError(error) : null;
  } catch (e) {
    return friendlyError(e);
  }
}

export interface Booking {
  first_name: string;
  application: string;
  status: SubmissionStatus;
  slot_id: string | null;
  slots: { id: string; starts_at: string; duration_min: number; location: string; available: boolean }[];
}

/** All locations and programs (names), for the filters on the apply site. */
export async function fetchPublicTagLists(): Promise<{ locations: string[]; programs: string[] }> {
  const { data, error } = await supabase.rpc("public_tag_lists");
  if (error || !data) return { locations: [], programs: [] };
  return data as { locations: string[]; programs: string[] };
}

export async function getBooking(token: string): Promise<Booking | null> {
  const { data, error } = await supabase.rpc("get_booking", { p_token: token });
  if (error) return null;
  return data as Booking | null;
}

export async function bookSlot(token: string, slotId: string): Promise<string | null> {
  const { error } = await supabase.rpc("book_slot", { p_token: token, p_slot_id: slotId });
  if (error) return friendlyError(error);
  // Send the confirmation with the meeting link right away (the database
  // also starts the sender by itself; this just makes it immediate).
  await supabase.functions.invoke("send-emails", { body: {} }).catch(() => undefined);
  return null;
}

export type { TemplateKey };

// ── Email settings (Settings → Email) ────────────────────────────────────

export interface EmailSettings {
  sender_name: string;
  sender_email: string;
  reply_to: string | null;
  test_mode: boolean;
  test_recipient: string | null;
  apply_base_url: string;
  daily_limit: number;
}

export async function loadEmailSettings(): Promise<EmailSettings> {
  return check(await supabase.from("email_settings")
    .select("sender_name, sender_email, reply_to, test_mode, test_recipient, apply_base_url, daily_limit").single()) as EmailSettings;
}

export async function saveEmailSettings(s: EmailSettings) {
  check(await supabase.from("email_settings").update({
    ...s,
    reply_to: s.reply_to?.trim() || null,
    test_recipient: s.test_recipient?.trim() || null,
  }).eq("id", true));
}

/** Runs the sender now (it also runs automatically). */
export async function sendQueuedNow(): Promise<{ sent?: number; failed?: number; skipped?: string }> {
  const { data, error } = await supabase.functions.invoke("send-emails", { body: {} });
  if (error) throw new Error("Could not reach the email sender.");
  await loadAll();
  return data;
}

// ── Mailbox (Emails page) ────────────────────────────────────────────────

/** Reads new mail from the mailbox now (also runs every 2 minutes). */
export async function syncMailboxNow(): Promise<{ synced?: number; skipped?: string; error?: string; more?: boolean }> {
  const { data, error } = await supabase.functions.invoke("sync-mailbox", { body: {} });
  await loadAll();
  if (error && !data) throw new Error("Could not reach the mailbox sync.");
  return data ?? {};
}

export async function markRead(messageIds: string[]) {
  if (!messageIds.length) return;
  check(await supabase.from("mailbox_messages").update({ read_at: new Date().toISOString() }).in("id", messageIds));
  await loadAll();
}

export async function markUnread(messageId: string) {
  check(await supabase.from("mailbox_messages").update({ read_at: null }).eq("id", messageId));
  await loadAll();
}

/** Links an incoming email to an application of a person (or unlinks with null). */
export async function linkMessage(messageId: string, submissionId: string | null) {
  const sub = submissionId ? state.submissions.find(x => x.id === submissionId) : undefined;
  check(await supabase.from("mailbox_messages").update({
    submission_id: submissionId,
    ...(sub ? { person_id: sub.personId } : {}),
    matched_by: submissionId ? "manual" : "sender",
  }).eq("id", messageId));
  await loadAll();
}

export interface ReplyInput {
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  personId?: string;
  submissionId?: string;
  applicationId?: string;
  /** Message we answer (its Message-ID) and the thread's references */
  inReplyTo?: string;
  references?: string[];
}

/** Sends a free-text email from the portal (same sender address, same thread). */
export async function sendReply(r: ReplyInput, city: string): Promise<{ sent?: number; skipped?: string; failed?: number }> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.toEmail)) throw new Error("Please enter a valid recipient address.");
  if (!r.subject.trim() || !r.body.trim()) throw new Error("Subject and message can't be empty.");
  check(await supabase.from("email_log").insert({
    template: "reply", to_email: r.toEmail.trim(), to_name: r.toName.trim() || r.toEmail.trim(),
    subject: r.subject.trim(), body: r.body, person_id: r.personId ?? null,
    submission_id: r.submissionId ?? null, application_id: r.applicationId ?? null,
    in_reply_to: r.inReplyTo ?? null, references_ids: r.references ?? [], queued_by: city,
  }));
  const { data } = await supabase.functions.invoke("send-emails", { body: {} });
  await loadAll();
  return data ?? {};
}
