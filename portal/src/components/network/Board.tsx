// Network board pieces shared by the members site and the team portal:
// a post card and the form to write / edit a post.
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { fmtDate } from "../../lib/fields";
import { Field, Modal } from "../ui/Ui";
import { IconExternal } from "../ui/Icons";

export type PostKind = "job" | "event" | "other";

export interface Post {
  id: string;
  kind: PostKind;
  title: string;
  organization?: string;
  location?: string;
  /** Event date / application deadline */
  date?: string;
  link?: string;
  body: string;
  status: "pending" | "published" | "rejected";
  authorName: string;
  authorIsTeam: boolean;
  reviewNote?: string;
  reviewedBy?: string;
  createdAt: string;
  /** Written by the signed-in member (members site) */
  mine?: boolean;
}

export type PostDraft = Pick<Post, "kind" | "title" | "organization" | "location" | "date" | "link" | "body">;

export const KIND_LABEL: Record<PostKind, string> = { job: "Job", event: "Event", other: "News" };
const KIND_CHIP: Record<PostKind, string> = { job: "chip--blue", event: "chip--purple", other: "chip--gray" };
export const dateLabel = (k: PostKind) => (k === "job" ? "Apply by" : k === "event" ? "Date" : "Date");

/** Event in the past / deadline passed */
export const isPast = (p: Pick<Post, "date">) => !!p.date && p.date < new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());

export function PostCard({ post: p, children, status }: { post: Post; children?: ComponentChildren; status?: boolean }) {
  const [more, setMore] = useState(false);
  const long = p.body.length > 320;
  return (
    <article class={`card post ${isPast(p) ? "post--past" : ""}`}>
      <div class="row" style="gap:8px">
        <span class={`chip ${KIND_CHIP[p.kind]}`}>{KIND_LABEL[p.kind]}</span>
        {status && p.status === "pending" && <span class="chip chip--amber">Waiting for approval</span>}
        {status && p.status === "rejected" && <span class="chip chip--red">Not published</span>}
        {isPast(p) && <span class="chip chip--outline">{p.kind === "job" ? "Deadline passed" : "Past"}</span>}
        <span class="spacer" />
        <span class="muted small">{fmtDate(p.createdAt)}</span>
      </div>
      <h3 class="post__title">{p.title}</h3>
      {(p.organization || p.location || p.date) && (
        <p class="small post__meta">
          {[p.organization, p.location, p.date ? `${dateLabel(p.kind)} ${fmtDate(p.date)}` : ""].filter(Boolean).join(" · ")}
        </p>
      )}
      <p class="post__body">{long && !more ? `${p.body.slice(0, 320).trimEnd()}…` : p.body}</p>
      {long && <button class="btn btn--ghost btn--sm" style="align-self:flex-start" onClick={() => setMore(!more)}>{more ? "Show less" : "Read more"}</button>}
      {status && p.status === "rejected" && p.reviewNote && <p class="small field__error">Note from the team: {p.reviewNote}</p>}
      <div class="row" style="gap:8px">
        {p.link && <a class="btn btn--secondary btn--sm" href={p.link} target="_blank" rel="noopener noreferrer">{p.kind === "job" ? "To the job" : "More info"} <IconExternal width={14} /></a>}
        <span class="spacer" />
        <span class="muted small">by {p.authorName}{p.authorIsTeam ? " (OneAIM team)" : ""}</span>
      </div>
      {children && <div class="row" style="gap:8px;border-top:1px solid var(--p-line);padding-top:12px">{children}</div>}
    </article>
  );
}

export function PostForm({ initial, title, submitLabel, note, onSubmit, onClose }: {
  initial?: PostDraft; title: string; submitLabel: string; note?: string;
  onSubmit: (d: PostDraft) => Promise<unknown>; onClose: () => void;
}) {
  const [d, setD] = useState<PostDraft>(initial ?? { kind: "job", title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const linkOk = !d.link?.trim() || /^https?:\/\/\S+$/.test(d.link.trim());
  const valid = d.title.trim().length >= 3 && d.body.trim() && linkOk;
  return (
    <Modal title={title} onClose={onClose} wide>
      <form class="stack" onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        await onSubmit(d);
        setBusy(false);
      }}>
        {note && <p class="muted small">{note}</p>}
        <div class="row" style="gap:6px" role="group" aria-label="Type">
          {(["job", "event", "other"] as PostKind[]).map(k => (
            <button type="button" class={`chip-btn ${d.kind === k ? "is-active" : ""}`} onClick={() => setD({ ...d, kind: k })}>{KIND_LABEL[k]}</button>
          ))}
        </div>
        <Field label="Title" required><input class="input" maxLength={140} value={d.title} onInput={e => setD({ ...d, title: e.currentTarget.value })}
          placeholder={d.kind === "job" ? "e.g. Working student Medical AI (m/f/d)" : d.kind === "event" ? "e.g. Health Hackathon Munich" : ""} /></Field>
        <div class="grid-2">
          <Field label={d.kind === "job" ? "Company" : "Organizer"}><input class="input" maxLength={120} value={d.organization ?? ""} onInput={e => setD({ ...d, organization: e.currentTarget.value })} /></Field>
          <Field label="Location"><input class="input" maxLength={120} placeholder="City, or Online" value={d.location ?? ""} onInput={e => setD({ ...d, location: e.currentTarget.value })} /></Field>
          <Field label={d.kind === "job" ? "Apply by" : "Date"}><input class="input" type="date" value={d.date ?? ""} onInput={e => setD({ ...d, date: e.currentTarget.value || undefined })} /></Field>
          <Field label="Link" error={linkOk ? undefined : "Please enter a full link (https://…)."}><input class="input" type="url" placeholder="https://…" value={d.link ?? ""} onInput={e => setD({ ...d, link: e.currentTarget.value })} /></Field>
        </div>
        <Field label="Description" required><textarea class="input" rows={7} maxLength={5000} value={d.body} onInput={e => setD({ ...d, body: e.currentTarget.value })} /></Field>
        <div class="row" style="justify-content:flex-end">
          <button type="button" class="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button class="btn btn--primary" disabled={!valid || busy}>{busy ? "Saving…" : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
