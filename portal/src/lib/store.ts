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
  Account, Answer, Application, Blueprint, Department, FileRef, FormOptions, InboxMessage, Person, SentEmail, Slot, State, Submission,
  SubmissionStatus, Tags, TemplateKey, Pipeline, RoleEntry, TeamMember, ReviewStage, ScoreSheet, Scorecard, PlannedDecision,
} from "./types";
import { appTitle, baseFields, defaultTemplates, firstName, fmtDate, LOCKED_KINDS, today } from "./fields";
import { FILES_BUCKET, IMAGES_BUCKET, friendlyError, supabase } from "./supabase";
import { isDemo, withDemo } from "./demo";
import { mapPost } from "./members";
import type { PostDraft } from "../components/network/Board";

// ── State ────────────────────────────────────────────────────────────────

const EMPTY: State = {
  team: [], scorecards: [], posts: [], networkAccounts: {}, departments: [], tagLists: { semesters: [], programs: [], locations: [] },
  blueprints: [], applications: [], submissions: [], people: [], outbox: [], inbox: [], mailbox: null,
  universities: [], studyPrograms: [], companies: [],
};

let state: State = EMPTY;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export function getState(): State { return state; }

/** Reads from the state; re-renders on every change. The selector runs on each
 *  render, so selectors that depend on props (e.g. an id) always stay current. */
export function useStore<T>(select: (s: State) => T): T {
  const [, rerender] = useState(0);
  useEffect(() => {
    const l = () => rerender(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return select(state);
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
    scorecards: r.scorecards ?? {},
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
    scorecards: a.scorecards,
  };
}

const PAGE = 1000;

/** Loads every row of a query in pages (Supabase returns at most 1,000 rows per request). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function all(make: () => any): Promise<{ data: any[]; error: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make().range(from, from + PAGE - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: out, error: null };
  }
}

export async function loadAll(): Promise<void> {
  const [programs, locations, semesters, members, departments, memberStatus, roles, netAccounts, posts, blueprints, apps, slots, people, subs, comments, history, mails, inbox, mailbox, unis, studyProgs, companyList, reviewers, scoreRows, scorecardRows] =
    await Promise.all([
      supabase.from("programs").select("id, name").order("sort_order"),
      supabase.from("locations").select("id, name").order("sort_order"),
      supabase.from("semesters").select("id, label, term, start_year").order("start_year").order("term", { ascending: false }),
      supabase.from("team_members").select("*").order("name"),
      supabase.from("team_departments").select("*").order("sort_order").order("name"),
      supabase.rpc("team_member_status"),
      all(() => supabase.from("network_posts").select("*").order("created_at", { ascending: false }).order("id")),
      all(() => supabase.from("network_accounts").select("person_id, invited_at").order("person_id")),
      all(() => supabase.from("team_member_roles").select("*").order("started_on").order("created_at").order("id")),
      supabase.from("blueprints").select("*").order("updated_at", { ascending: false }),
      all(() => supabase.from("applications").select("*").order("created_at", { ascending: false }).order("id")),
      all(() => supabase.from("interview_slots").select("*").order("starts_at").order("id")),
      all(() => supabase.from("people").select("*").order("name").order("id")),
      all(() => supabase.from("submissions").select("*").order("submitted_at", { ascending: false }).order("id")),
      all(() => supabase.from("submission_comments").select("*").order("created_at").order("id")),
      all(() => supabase.from("status_history").select("*").order("changed_at").order("id")),
      all(() => supabase.from("email_log").select("*").order("created_at", { ascending: false }).order("id")),
      all(() => supabase.from("mailbox_messages").select("*").order("received_at", { ascending: false }).order("id")),
      supabase.from("mailbox_state").select("last_sync_at, last_error, sync_since").maybeSingle(),
      all(() => supabase.from("universities").select("id, name, city, country, aliases").order("name").order("id")),
      all(() => supabase.from("study_programs").select("id, name, category").order("category").order("name")),
      all(() => supabase.from("companies").select("id, name, category, aliases").order("name").order("id")),
      all(() => supabase.from("submission_reviewers").select("submission_id, member_id").order("assigned_at").order("member_id")),
      all(() => supabase.from("submission_scores").select("*").order("created_at").order("id")),
      supabase.from("scorecards").select("*").order("name"),
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
      mode: r.mode, meetingLink: r.meeting_link ?? undefined, interviewerIds: r.interviewer_ids ?? [],
    });
    slotsByApp.set(r.application_id, list);
  }

  const commentRows = check(comments) as any[];
  const historyRows = check(history) as any[];

  state = {
    team: (() => {
      const st = new Map((check(memberStatus) as any[]).map(r => [r.member_id, r]));
      const hist = new Map<string, RoleEntry[]>();
      for (const r of check(roles) as any[]) {
        const list = hist.get(r.member_id) ?? [];
        list.push({
          id: r.id, city: label(maps.location, r.location_id), role: r.role, departmentId: r.department_id ?? undefined,
          department: r.department ?? undefined, position: r.position ?? undefined, from: r.started_on, to: r.ended_on ?? undefined,
        });
        hist.set(r.member_id, list);
      }
      return (check(members) as any[]).map(m => ({
        id: m.id, personId: m.person_id ?? undefined, email: m.email ?? undefined, linkedin: m.linkedin ?? undefined, name: m.name, city: label(maps.location, m.location_id),
        role: m.role, departmentId: m.department_id ?? undefined, position: m.position ?? undefined, photo: m.photo_url ?? undefined,
        memberSince: m.member_since ?? undefined, about: m.about ?? undefined, invitedAt: m.invited_at ?? undefined,
        active: !!st.get(m.id)?.has_password, lastSignInAt: st.get(m.id)?.last_sign_in_at ?? undefined,
        status: m.status, alumniSince: m.alumni_since ?? undefined, nextCheckAt: m.next_check_at ?? undefined,
        checkSentAt: m.check_sent_at ?? undefined, checkRemindedAt: m.check_reminded_at ?? undefined,
        lastConfirmedAt: m.last_confirmed_at ?? undefined, history: hist.get(m.id) ?? [],
      }) as TeamMember);
    })(),
    posts: (check(posts) as any[]).map(mapPost),
    networkAccounts: Object.fromEntries((check(netAccounts) as any[]).map(a => [a.person_id, { invitedAt: a.invited_at ?? undefined }])),
    departments: (check(departments) as any[]).map(d => ({
      id: d.id, city: label(maps.location, d.location_id), name: d.name, order: d.sort_order,
    }) as Department),
    tagLists: { programs: P.map(p => p.name), locations: L.map(l => l.name), semesters: S.map(s => s.label) },
    blueprints: (check(blueprints) as any[]).map(b => ({
      id: b.id, name: b.name, description: b.description, fields: b.fields ?? [], updatedAt: b.updated_at,
    })),
    applications: (check(apps) as any[]).map(r => mapApplication(r, slotsByApp.get(r.id) ?? [])),
    people: (check(people) as any[]).map(p => ({
      id: p.id, email: p.email, name: p.name, phone: p.phone ?? undefined, linkedin: p.linkedin ?? undefined,
      universities: p.universities ?? [], studyPrograms: p.study_programs ?? [], companies: p.companies ?? [], semester: p.semester ?? undefined,
      degree: p.degree ?? undefined, cv: p.cv ?? undefined, firstSeen: p.first_seen_at,
    }) as Person),
    submissions: (check(subs) as any[]).map(x => ({
      id: x.id, applicationId: x.application_id, personId: x.person_id, answers: x.answers ?? {},
      status: x.status, score: x.score ?? undefined, bookingToken: x.booking_token, slotId: x.slot_id ?? undefined,
      submittedAt: x.submitted_at,
      comments: commentRows.filter(c => c.submission_id === x.id).map(c => ({
        author: c.author_city, text: c.body, at: c.created_at, stage: c.stage ?? undefined, memberId: c.author_member_id ?? undefined,
      })),
      plannedDecision: x.planned_decision ?? undefined, plannedBy: x.planned_by ?? undefined,
      reviewerIds: (check(reviewers) as any[]).filter(r => r.submission_id === x.id).map(r => r.member_id),
      scoreSheets: (check(scoreRows) as any[]).filter(r => r.submission_id === x.id).map(r => ({
        id: r.id, memberId: r.member_id, stage: r.stage, scores: r.scores ?? {}, note: r.note ?? undefined, updatedAt: r.updated_at,
      })),
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
    universities: (check(unis) as any[]).map(u => ({ id: u.id, name: u.name, city: u.city ?? undefined, country: u.country ?? undefined, aliases: u.aliases ?? [] })),
    studyPrograms: check(studyProgs) as any[],
    scorecards: (check(scorecardRows) as any[]).map(c => ({ id: c.id, name: c.name, description: c.description, criteria: c.criteria ?? [] })),
    companies: (check(companyList) as any[]).map(c => ({ id: c.id, name: c.name, category: c.category, aliases: c.aliases ?? [] })),
    mailbox: (() => {
      const m = check(mailbox) as any;
      return m ? { lastSyncAt: m.last_sync_at ?? undefined, lastError: m.last_error ?? undefined, syncSince: m.sync_since } : null;
    })(),
  };
  if (isDemo()) state = withDemo(state);   // local development only, nothing is saved
  notify();
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Session ──────────────────────────────────────────────────────────────

async function accountFor(userId: string, email: string): Promise<Account | null> {
  const { data: ok } = await supabase.rpc("is_team");
  if (ok !== true) return null;
  const { data: m } = await supabase.from("team_members").select("id, name, locations(name)").eq("user_id", userId).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (m) return { id: userId, memberId: m.id, name: m.name, city: (m as any).locations?.name ?? "", email };
  const { data } = await supabase.from("team_accounts").select("city").eq("user_id", userId).maybeSingle();
  return data ? { id: userId, name: `OneAIM ${data.city}`, city: data.city, email, legacy: true } : null;
}

/** Signs in; only team members (and, until those are set up, the city logins) are let in. */
export async function login(email: string, password: string): Promise<Account> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) throw new Error("Email or password is wrong.");
  const acc = await accountFor(data.user.id, data.user.email ?? email);
  if (!acc) {
    await supabase.auth.signOut();
    const { data: city } = await supabase.from("team_accounts").select("city").eq("user_id", data.user.id).maybeSingle();
    throw new Error(city !== null
      ? "City logins are switched off. Please sign in with your personal account."
      : "This account is not (or no longer) an active OneAIM team account.");
  }
  return acc;
}

/** Who acted, as stored with applications and replies: "Name (City)". */
export const actorLabel = (acc: Account) => (acc.legacy ? acc.city : `${acc.name} (${acc.city})`);

/** "Forgot password?": emails a link if the address belongs to a team member. */
export async function requestPasswordLink(email: string) {
  const { error } = await supabase.functions.invoke("team-accounts", { body: { action: "reset", email: email.trim() } });
  if (error) throw new Error("Could not send the link. Please try again later.");
}

/** Redeems an invitation / password link from an email (welcome page). */
export async function redeemLink(tokenHash: string, type: "invite" | "recovery"): Promise<Account | null> {
  await supabase.auth.signOut();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) throw new Error("This link has expired or was already used. Use “Forgot password?” on the login page to get a new one.");
  return accountFor(data.user.id, data.user.email ?? "");
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
  // Core fields keep their ids; the database adds any that are missing
  const fields = from
    ? structuredClone(from.fields).map(f => ({ ...f, id: LOCKED_KINDS.includes(f.kind) ? f.id : `f_${newId()}` }))
    : baseFields();
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
    scorecards: defaultScorecards(input.pipeline),
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

export async function addSlots(applicationId: string, slots: Omit<Slot, "id" | "interviewerIds">[]) {
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
export async function uploadImage(file: File, folder = "headers"): Promise<string> {
  const path = `${folder}/${newId()}-${slugify(file.name.replace(/\.[^.]+$/, ""))}.${file.name.split(".").pop()}`;
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
  // Accepted people join the network: send their welcome email right away
  if (decision === "accept") await supabase.functions.invoke("team-accounts", { body: { action: "network_queue" } }).catch(() => undefined);
  await loadAll();
  return result;
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

/** Standard scorecards for a new application: screening (and interview, if the pipeline has one) */
function defaultScorecards(pipeline: Pipeline): Application["scorecards"] {
  const pick = (name: string) => {
    const c = state.scorecards.find(x => x.name === name);
    return c ? { name: c.name, criteria: structuredClone(c.criteria) } : undefined;
  };
  if (pipeline === "instant") return {};
  const out: Application["scorecards"] = {};
  const s = pick("Screening – standard");
  if (s) out.screening = s;
  if (pipeline === "interview") { const i = pick("Interview – standard"); if (i) out.interview = i; }
  return out;
}

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
    templates: defaultTemplates(r.pipeline), slots: [], createdAt: "", createdBy: "", scorecards: {},
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

/**
 * Links in emails (interview booking) must point to a public address.
 * If they still point to localhost and the team area runs on a real site
 * (e.g. the Netlify test site), switch them to this site's address.
 */
export async function fixEmailLinkBase(): Promise<string | null> {
  const here = window.location.origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(here)) return null;   // local development
  const { data } = await supabase.from("email_settings").select("apply_base_url").maybeSingle();
  const current = (data as { apply_base_url?: string } | null)?.apply_base_url ?? "";
  if (!/localhost|127\.0\.0\.1/.test(current)) return null;
  const { error } = await supabase.from("email_settings").update({ apply_base_url: here }).eq("id", true);
  return error ? null : here;
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

/** Fills {first_name} / {full_name} for one recipient of a group email. */
export function personalize(text: string, p: Pick<Person, "name">): string {
  return text.replace(/\{first_name\}/g, firstName(p.name)).replace(/\{full_name\}/g, p.name);
}

/**
 * Group email from the CRM: one personal email per person, through the same
 * queue as all other emails (daily limit: the rest goes out the next days).
 */
export async function sendGroupEmail(people: Pick<Person, "id" | "email" | "name">[], subject: string, body: string, by: string): Promise<{ queued: number }> {
  if (!subject.trim() || !body.trim()) throw new Error("Subject and message can't be empty.");
  const rows = people.map(p => ({
    template: "reply", to_email: p.email, to_name: p.name, subject: personalize(subject.trim(), p), body: personalize(body, p),
    person_id: p.id, queued_by: by,
  }));
  for (let i = 0; i < rows.length; i += 500) check(await supabase.from("email_log").insert(rows.slice(i, i + 500)));
  await supabase.functions.invoke("send-emails", { body: {} }).catch(() => undefined);
  await loadAll();
  return { queued: rows.length };
}

// ── Lists: universities & study programs (Settings) ──────────────────────

export function formOptionsFromState(s: State): FormOptions {
  return {
    universities: s.universities.map(u => ({ name: u.name, country: u.country, aliases: u.aliases })),
    studyPrograms: s.studyPrograms.map(p => ({ name: p.name, category: p.category })),
    companies: s.companies.map(c => ({ name: c.name, category: c.category, aliases: c.aliases })),
  };
}

/** Options for the apply form (public, read-only). */
export async function fetchFormOptions(): Promise<FormOptions> {
  const { data, error } = await supabase.rpc("public_form_options");
  if (error || !data) return { universities: [], studyPrograms: [], companies: [] };
  return data as FormOptions;
}

export async function addUniversity(name: string, city?: string) {
  if (!name.trim()) return;
  check(await supabase.from("universities").insert({ name: name.trim(), city: city?.trim() || null }));
  await loadAll();
}

export async function addStudyProgram(name: string, category: string) {
  if (!name.trim()) return;
  check(await supabase.from("study_programs").insert({ name: name.trim(), category: category.trim() || "Other" }));
  await loadAll();
}

export async function addCompany(name: string, category: string) {
  if (!name.trim()) return;
  check(await supabase.from("companies").insert({ name: name.trim(), category: category.trim() || "Other" }));
  await loadAll();
}

export type ListKind = "university" | "studyProgram" | "company";
const LIST_TABLE: Record<ListKind, string> = { university: "universities", studyProgram: "study_programs", company: "companies" };

export async function removeListEntry(kind: ListKind, id: string) {
  check(await supabase.from(LIST_TABLE[kind]).delete().eq("id", id));
  await loadAll();
}

/** Replaces a free-text value ("Other") with a list entry for everyone who entered it. */
export async function mergeProfileValue(kind: ListKind, from: string, to: string): Promise<number> {
  const n = check(await supabase.rpc("merge_profile_value", { p_kind: kind, p_from: from, p_to: to })) as number;
  await loadAll();
  return n;
}

// ── Team ─────────────────────────────────────────────────────────────────

export const ROLE_LABEL: Record<TeamMember["role"], string> = {
  president: "President", co_president: "Co-President", lead: "Team Lead", member: "Member",
};

async function teamCall<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("team-accounts", { body });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msg = (data as any)?.error ?? (error ? await (error as any).context?.json?.().then((j: any) => j.error).catch(() => undefined) : undefined);
  if (msg || error) throw new Error(friendlyError(msg ?? error));
  return data as T;
}

export interface InviteInput {
  name: string; email: string; city: string; role: TeamMember["role"]; departmentId?: string; position?: string;
}

/** Creates the login + team profile and emails the invitation. */
export async function inviteMember(i: InviteInput): Promise<{ id: string; mailError?: string }> {
  const r = await teamCall<{ id: string; mailError?: string }>({
    action: "invite", name: i.name.trim(), email: i.email.trim().toLowerCase(), location_id: idOf(maps.location, i.city),
    role: i.role, department_id: i.departmentId || null, position: i.position?.trim() || null,
  });
  await loadAll();
  return r;
}

/** Gives a profile without login (e.g. imported from the website) its email and sends the invitation. */
export async function activateMember(memberId: string, email: string): Promise<{ mailError?: string }> {
  const r = await teamCall<{ mailError?: string }>({ action: "activate", member_id: memberId, email: email.trim().toLowerCase() });
  await loadAll();
  return r;
}

export async function resendInvite(memberId: string) {
  await teamCall({ action: "resend", member_id: memberId });
  await loadAll();
}

/** Removes the login; the person stays in the network. */
export async function removeMember(memberId: string) {
  await teamCall({ action: "remove", member_id: memberId });
  await loadAll();
}

export type MemberPatch = Partial<Pick<TeamMember, "name" | "city" | "role" | "departmentId" | "position" | "photo" | "memberSince" | "about" | "linkedin">>;

export async function updateMember(id: string, p: MemberPatch) {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined) row.name = p.name.trim();
  if (p.city !== undefined) row.location_id = idOf(maps.location, p.city);
  if (p.role !== undefined) row.role = p.role;
  if ("departmentId" in p) row.department_id = p.departmentId || null;
  if ("position" in p) row.position = p.position?.trim() || null;
  if ("photo" in p) row.photo_url = p.photo || null;
  if ("memberSince" in p) row.member_since = p.memberSince || null;
  if ("about" in p) row.about = p.about?.trim() || null;
  if ("linkedin" in p) row.linkedin = p.linkedin?.trim() || null;
  check(await supabase.from("team_members").update(row).eq("id", id));
  await loadAll();
}

/** Personal details live on the network profile (shared with applications). */
export async function updatePersonDetails(personId: string, p: Partial<Pick<Person, "phone" | "linkedin" | "universities" | "studyPrograms" | "companies" | "semester" | "degree">>) {
  const row: Record<string, unknown> = {};
  if ("phone" in p) row.phone = p.phone?.trim() || null;
  if ("linkedin" in p) row.linkedin = p.linkedin?.trim() || null;
  if (p.universities) row.universities = p.universities;
  if (p.studyPrograms) row.study_programs = p.studyPrograms;
  if (p.companies) row.companies = p.companies;
  if ("semester" in p) row.semester = p.semester || null;
  if ("degree" in p) row.degree = p.degree || null;
  check(await supabase.from("people").update(row).eq("id", personId));
  await loadAll();
}

/** Login for the members site + welcome email ("you're part of the OneAIM network"). */
export async function inviteToNetworkSite(personId: string) {
  await teamCall({ action: "network_invite", person_id: personId });
  await loadAll();
}

// ── Batch decisions: plan first, then apply + send all at once ───────────

/** Plans (or clears) a decision without changing the status or sending anything.
 *  Demo applicants are planned only in this browser. */
export async function planDecision(subIds: string[], decision: PlannedDecision | null) {
  const demo = subIds.filter(id => id.startsWith("demo-"));
  const real = subIds.filter(id => !id.startsWith("demo-"));
  if (real.length) check(await supabase.from("submissions").update({ planned_decision: decision }).in("id", real));
  if (demo.length) {
    state = { ...state, submissions: state.submissions.map(x => (demo.includes(x.id) ? { ...x, plannedDecision: decision ?? undefined, plannedBy: decision ? "Demo" : undefined } : x)) };
    notify();
  }
  if (real.length) await loadAll();
}

export interface BatchResult { applied: number; sent?: number; failed?: number; skipped?: string }

/** Applies every planned decision of these applicants (grouped by decision); emails go out together. */
export async function applyPlannedDecisions(subs: Submission[], sendMail: boolean): Promise<BatchResult> {
  let applied = 0;
  for (const d of ["invite", "accept", "reject"] as PlannedDecision[]) {
    const ids = subs.filter(x => x.plannedDecision === d && !x.id.startsWith("demo-")).map(x => x.id);
    if (ids.length) applied += check(await supabase.rpc("decide", { p_submission_ids: ids, p_decision: d, p_send_email: sendMail })) as number;
  }
  let out: BatchResult = { applied };
  if (sendMail && applied) {
    const { data } = await supabase.functions.invoke("send-emails", { body: {} });
    out = { applied, sent: data?.sent, failed: data?.failed, skipped: data?.skipped };
    if (subs.some(x => x.plannedDecision === "accept")) await supabase.functions.invoke("team-accounts", { body: { action: "network_queue" } }).catch(() => undefined);
  }
  await loadAll();
  return out;
}

// ── Review workflow: interviewers, reviewers, scorecards ─────────────────

export async function setInterviewers(slotId: string, memberIds: string[]) {
  check(await supabase.from("interview_slots").update({ interviewer_ids: memberIds }).eq("id", slotId));
  await loadAll();
}

/** Assigns team members to review the applicants (keeps existing assignments). */
export async function assignReviewers(subIds: string[], memberIds: string[]) {
  const rows = subIds.flatMap(submission_id => memberIds.map(member_id => ({ submission_id, member_id })));
  check(await supabase.from("submission_reviewers").upsert(rows, { onConflict: "submission_id,member_id", ignoreDuplicates: true }));
  await loadAll();
}

export async function unassignReviewer(subId: string, memberId: string) {
  check(await supabase.from("submission_reviewers").delete().eq("submission_id", subId).eq("member_id", memberId));
  await loadAll();
}

/** Your own scorecard for this applicant and stage (created or updated). */
export async function saveScoreSheet(subId: string, stage: ReviewStage, scores: Record<string, number>, note: string, acc: Account) {
  if (!acc.memberId) throw new Error(friendlyError("personal_account_needed"));
  check(await supabase.from("submission_scores").upsert({
    submission_id: subId, member_id: acc.memberId, stage, scores, note: note.trim() || null,
  }, { onConflict: "submission_id,member_id,stage" }));
  await loadAll();
}

export async function deleteScoreSheet(id: string) {
  check(await supabase.from("submission_scores").delete().eq("id", id));
  await loadAll();
}

/** Weighted average of one sheet (1–5), or undefined if nothing is rated */
export function sheetScore(card: Scorecard | undefined, sheet: Pick<ScoreSheet, "scores">): number | undefined {
  const crit = card?.criteria ?? Object.keys(sheet.scores).map(id => ({ id, weight: 1 }));
  let sum = 0, w = 0;
  for (const c of crit) {
    const v = sheet.scores[c.id];
    if (typeof v === "number") { sum += v * (c.weight || 1); w += c.weight || 1; }
  }
  return w ? sum / w : undefined;
}

/** Average over all team members' sheets: per stage, and overall (interview counts when there is one) */
export function applicantScore(app: Application, sub: Submission): { screening?: number; interview?: number; overall?: number; sheets: number } {
  const avg = (stage: ReviewStage) => {
    const v = sub.scoreSheets.filter(x => x.stage === stage).map(x => sheetScore(app.scorecards[stage], x)).filter((x): x is number => x !== undefined);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
  };
  const screening = avg("screening"), interview = avg("interview");
  return { screening, interview, overall: interview ?? screening, sheets: sub.scoreSheets.length };
}

export async function saveScorecardTemplate(c: Scorecard) {
  const row = { name: c.name.trim(), description: c.description?.trim() ?? "", criteria: c.criteria };
  check(c.id ? await supabase.from("scorecards").update(row).eq("id", c.id) : await supabase.from("scorecards").insert(row));
  await loadAll();
}

export async function deleteScorecardTemplate(id: string) {
  check(await supabase.from("scorecards").delete().eq("id", id));
  await loadAll();
}

// ── Network board ────────────────────────────────────────────────────────

const postRow = (d: PostDraft) => ({
  kind: d.kind, title: d.title.trim(), organization: d.organization?.trim() || null, location: d.location?.trim() || null,
  date_on: d.date || null, link: d.link?.trim() || null, body: d.body.trim(),
});

/** Team post: published right away. */
export async function createPost(d: PostDraft, acc: Account) {
  const by = acc.legacy ? `OneAIM ${acc.city}` : acc.name;
  check(await supabase.from("network_posts").insert({
    ...postRow(d), status: "published", author_name: by, author_is_team: true, reviewed_by: by, reviewed_at: new Date().toISOString(),
    author_person_id: getState().team.find(m => m.id === acc.memberId)?.personId ?? null,
  }));
  await loadAll();
}

export async function updatePost(id: string, d: PostDraft) {
  check(await supabase.from("network_posts").update(postRow(d)).eq("id", id));
  await loadAll();
}

/** Approve (publish) or decline a member's post; also used to take a post down. */
export async function reviewPost(id: string, status: "published" | "rejected" | "pending", acc: Account, note?: string) {
  check(await supabase.from("network_posts").update({
    status, review_note: note?.trim() || null, reviewed_by: actorLabel(acc), reviewed_at: new Date().toISOString(),
  }).eq("id", id));
  await loadAll();
}

export async function deletePost(id: string) {
  check(await supabase.from("network_posts").delete().eq("id", id));
  await loadAll();
}

/** Alumni leave the organigram and lose portal access; history and profile stay. */
export async function setMemberStatus(id: string, status: TeamMember["status"]) {
  check(await supabase.from("team_members").update({ status }).eq("id", id));
  await loadAll();
}

/** Sends the yearly "still active?" email right away. */
export async function checkinNow(memberId: string) {
  await teamCall({ action: "checkin_now", member_id: memberId });
  await loadAll();
}

export async function saveRoleEntry(memberId: string, e: Omit<RoleEntry, "id"> & { id?: string }) {
  const row = {
    member_id: memberId, location_id: idOf(maps.location, e.city), role: e.role, department_id: e.departmentId || null,
    department: e.department?.trim() || null, position: e.position?.trim() || null, started_on: e.from, ended_on: e.to || null,
  };
  check(e.id ? await supabase.from("team_member_roles").update(row).eq("id", e.id) : await supabase.from("team_member_roles").insert(row));
  await loadAll();
}

export async function removeRoleEntry(id: string) {
  check(await supabase.from("team_member_roles").delete().eq("id", id));
  await loadAll();
}

// Yearly check page (public, by the token in the email)
export async function getCheckin(token: string): Promise<{ name: string; city: string } | null> {
  const { data, error } = await supabase.rpc("team_checkin_info", { p_token: token });
  if (error) throw new Error(friendlyError(error));
  return data ?? null;
}

export async function answerCheckin(token: string, stillActive: boolean): Promise<"active" | "alumni"> {
  return check(await supabase.rpc("team_checkin", { p_token: token, p_still_active: stillActive })) as "active" | "alumni";
}

export async function addDepartment(city: string, name: string) {
  const order = Math.max(0, ...state.departments.filter(d => d.city === city).map(d => d.order)) + 1;
  check(await supabase.from("team_departments").insert({ location_id: idOf(maps.location, city), name: name.trim(), sort_order: order }));
  await loadAll();
}

export async function renameDepartment(id: string, name: string) {
  check(await supabase.from("team_departments").update({ name: name.trim() }).eq("id", id));
  await loadAll();
}

/** Members of the department stay in the team, without a department. */
export async function removeDepartment(id: string) {
  check(await supabase.from("team_departments").delete().eq("id", id));
  await loadAll();
}
