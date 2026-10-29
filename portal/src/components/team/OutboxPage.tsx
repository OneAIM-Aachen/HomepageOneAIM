// Emails: the sender account's conversations.
// Incoming mail (mailbox_messages, synced via IMAP) and everything we sent
// (email_log), grouped into one conversation per person – or per address
// for senders who never applied. Each email links to its application.
import { useEffect, useMemo, useState } from "preact/hooks";
import type { Account, Application, InboxMessage, SentEmail, State, Submission } from "../../lib/types";
import {
  actorLabel, linkMessage, markRead, markUnread, renderTemplate, sendReply, syncMailboxNow, useStore,
} from "../../lib/store";
import { appTitle, TEMPLATE_LABEL } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { act, Avatar, StatusChip, useParam } from "../ui/Ui";
import { IconFile, IconSearch } from "../ui/Icons";

const dt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ago = (iso?: string) => {
  if (!iso) return "never";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : dt.format(new Date(iso));
};

type Item = { kind: "in"; at: string; msg: InboxMessage } | { kind: "out"; at: string; mail: SentEmail };

interface Conversation {
  key: string;
  personId?: string;
  email: string;
  name: string;
  items: Item[];          // oldest first
  last: string;
  unread: number;
  /** Cities of the person's applications and of the emails' applications */
  cities: Set<string>;
}

const keyOf = (personId: string | undefined, email: string | undefined) => (personId ? `p:${personId}` : `e:${(email ?? "unknown").toLowerCase()}`);

function buildConversations(s: State): Conversation[] {
  const map = new Map<string, Conversation>();
  const get = (key: string, personId: string | undefined, email: string, name: string) => {
    let c = map.get(key);
    if (!c) { c = { key, personId, email, name, items: [], last: "", unread: 0, cities: new Set() }; map.set(key, c); }
    return c;
  };
  const cityOfApp = (id?: string) => s.applications.find(a => a.id === id)?.tags.location;
  const cityOfSub = (id?: string) => cityOfApp(s.submissions.find(x => x.id === id)?.applicationId);

  for (const m of s.inbox) {
    const p = m.personId ? s.people.find(x => x.id === m.personId) : undefined;
    const c = get(keyOf(m.personId, m.fromEmail), m.personId, p?.email ?? m.fromEmail ?? "", p?.name ?? m.fromName ?? m.fromEmail ?? "Unknown sender");
    c.items.push({ kind: "in", at: m.receivedAt, msg: m });
    if (!m.readAt) c.unread++;
    const city = cityOfSub(m.submissionId);
    if (city) c.cities.add(city);
  }
  for (const m of s.outbox) {
    const p = m.personId ? s.people.find(x => x.id === m.personId) : undefined;
    const c = get(keyOf(m.personId, m.to), m.personId, p?.email ?? m.to, p?.name ?? m.toName);
    c.items.push({ kind: "out", at: m.at, mail: m });
    const city = cityOfApp(m.applicationId);
    if (city) c.cities.add(city);
  }
  for (const c of map.values()) {
    c.items.sort((a, b) => a.at.localeCompare(b.at));
    c.last = c.items[c.items.length - 1]!.at;
    if (c.personId) for (const x of s.submissions) if (x.personId === c.personId) { const city = cityOfApp(x.applicationId); if (city) c.cities.add(city); }
  }
  return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
}

/** Stored text once sent; before that a preview from the template. */
function outContent(s: State, m: SentEmail): { subject: string; body: string } {
  if (m.subject || m.type === "reply") return { subject: m.subject, body: m.body };
  const app = s.applications.find(a => a.id === m.applicationId);
  const sub = s.submissions.find(x => x.id === m.submissionId);
  if (!app) return { subject: "(application deleted)", body: "" };
  const t = app.templates[m.type];
  return { subject: renderTemplate(t.subject, app, { name: m.toName }, sub), body: renderTemplate(t.body, app, { name: m.toName }, sub) };
}

const kindLabel = (m: SentEmail) => (m.type === "reply" ? "Reply" : TEMPLATE_LABEL[m.type]);

function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) => (i % 2 ? <a href={part} target="_blank" rel="noopener">{part}</a> : part));
}

/** Splits off quoted history ("> …" or "On … wrote:") so threads stay readable. */
function splitQuote(body: string): [string, string] {
  const lines = body.split("\n");
  const i = lines.findIndex((l, k) => /^>/.test(l) || (/^(On|Am) .+(wrote|schrieb):?\s*$/.test(l) && !!lines[k + 1]?.startsWith(">")));
  return i > 0 ? [lines.slice(0, i).join("\n").trimEnd(), lines.slice(i).join("\n")] : [body, ""];
}

export default function OutboxPage() {
  const p = useParam("p");
  const c = useParam("c");
  return <TeamShell active="outbox">{acc => <Emails acc={acc} initial={p ? `p:${p}` : c} />}</TeamShell>;
}

type Filter = "all" | "unread" | "applicants" | "others" | "failed";

function Emails({ acc, initial }: { acc: Account; initial: string | null }) {
  const s = useStore(x => x);
  const convs = useMemo(() => buildConversations(s), [s]);
  const [filter, setFilter] = useState<Filter>("all");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(initial ?? null);

  const byCity = convs.filter(c => !city || c.cities.has(city));
  const matches = (c: Conversation, f: Filter) =>
    f === "unread" ? c.unread > 0
    : f === "applicants" ? !!c.personId
    : f === "others" ? !c.personId
    : f === "failed" ? c.items.some(i => i.kind === "out" && i.mail.status === "failed")
    : true;

  const shown = byCity.filter(c => {
    if (!matches(c, filter)) return false;
    if (!q) return true;
    const ql = q.toLowerCase();
    return `${c.name} ${c.email}`.toLowerCase().includes(ql) ||
      c.items.some(i => (i.kind === "in" ? `${i.msg.subject} ${i.msg.body}` : `${i.mail.subject} ${i.mail.body}`).toLowerCase().includes(ql));
  });
  const current = convs.find(c => c.key === open) ?? null;

  const labels: Record<Filter, string> = { all: "All", unread: "Unread", applicants: "Applicants", others: "Other senders", failed: "Failed" };
  const mb = s.mailbox;

  return (
    <div class="stack" style="gap:18px">
      <PageHead overline="Emails" title="Emails"
        sub="Everything sent and received on the email account, as conversations. Emails from applicants are linked to their applications."
        actions={<>
          <span class={`small ${mb?.lastError ? "" : "muted"}`} style={mb?.lastError ? "color:var(--p-red)" : ""} title={mb?.lastError}>
            {mb?.lastError ? `Mailbox error: ${mb.lastError.slice(0, 80)}` : `Mailbox synced ${ago(mb?.lastSyncAt)}`}
          </span>
          <button class="btn btn--secondary" onClick={() => act(syncMailboxNow, r =>
            r.skipped ? `Mailbox not connected: ${r.skipped}` : r.error ? `Sync failed: ${r.error}` : `${r.synced ?? 0} new email${r.synced === 1 ? "" : "s"}${r.more ? ", more coming" : ""}`)}>
            Sync now
          </button>
        </>} />

      <div class="row">
        {(Object.keys(labels) as Filter[]).map(f => (
          <button class={`chip-btn ${filter === f ? "is-active" : ""}`} onClick={() => setFilter(f)}>
            {labels[f]}<span style="opacity:.7;margin-left:6px">{byCity.filter(c => matches(c, f)).length}</span>
          </button>
        ))}
        <span class="spacer" />
        <select class="input input--sm" style="width:auto" value={city} onChange={e => setCity(e.currentTarget.value)} aria-label="City of application">
          <option value="">All cities</option>
          {s.tagLists.locations.map(l => <option>{l}</option>)}
        </select>
        <div style="position:relative;min-width:220px">
          <IconSearch width={17} style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-text-muted)" />
          <input class="input input--sm" style="padding-left:36px" placeholder="Search name, email, text…" value={q} onInput={e => setQ(e.currentTarget.value)} aria-label="Search emails" />
        </div>
      </div>
      {city && <p class="muted small" style="margin-top:-8px">Showing conversations with people who applied in {city}. Senders without an application have no city and are hidden.</p>}

      <div class="mailbox">
        <div class="card card--flush mailbox__list">
          {shown.length === 0 && <div class="empty" style="border:none">No conversations.</div>}
          {shown.map(c => {
            const lastItem = c.items[c.items.length - 1]!;
            const subj = lastItem.kind === "in" ? lastItem.msg.subject : outContent(s, lastItem.mail).subject;
            const apps = appsOf(s, c.personId);
            return (
              <button class={`conv ${c.key === open ? "is-active" : ""} ${c.unread ? "is-unread" : ""}`} onClick={() => setOpen(c.key)}>
                <Avatar name={c.name} />
                <div style="flex:1;min-width:0">
                  <div class="row row--between" style="flex-wrap:nowrap;gap:8px">
                    <strong class="conv__name">{c.name}</strong>
                    <span class="muted small" style="white-space:nowrap">{dt.format(new Date(c.last))}</span>
                  </div>
                  <div class="conv__subject">{lastItem.kind === "out" ? "You: " : ""}{subj || "(no subject)"}</div>
                  <div class="row" style="gap:4px;margin-top:4px">
                    {c.unread > 0 && <span class="chip chip--blue">{c.unread} new</span>}
                    {apps.slice(0, 2).map(a => <span class="chip chip--outline">{a.app.tags.program.replace("AIM ", "")} · {a.app.tags.location}</span>)}
                    {apps.length > 2 && <span class="chip chip--outline">+{apps.length - 2}</span>}
                    {!c.personId && <span class="chip chip--gray">Not an applicant</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div class="mailbox__thread">
          {current
            ? <Thread key={current.key} acc={acc} s={s} conv={current} />
            : <div class="empty">Pick a conversation.</div>}
        </div>
      </div>
    </div>
  );
}

function appsOf(s: State, personId?: string): { sub: Submission; app: Application }[] {
  if (!personId) return [];
  return s.submissions.filter(x => x.personId === personId)
    .map(sub => ({ sub, app: s.applications.find(a => a.id === sub.applicationId)! }))
    .filter(x => x.app)
    .sort((a, b) => b.sub.submittedAt.localeCompare(a.sub.submittedAt));
}

function Thread({ acc, s, conv }: { acc: Account; s: State; conv: Conversation }) {
  const apps = appsOf(s, conv.personId);
  const lastIn = [...conv.items].reverse().find(i => i.kind === "in") as Extract<Item, { kind: "in" }> | undefined;
  const lastOut = [...conv.items].reverse().find(i => i.kind === "out") as Extract<Item, { kind: "out" }> | undefined;

  // Opening a conversation marks its incoming emails as read
  useEffect(() => {
    const unread = conv.items.flatMap(i => (i.kind === "in" && !i.msg.readAt ? [i.msg.id] : []));
    if (unread.length) act(() => markRead(unread));
  }, [conv.key]);

  const baseSubject = lastIn?.msg.subject ?? (lastOut ? outContent(s, lastOut.mail).subject : "");
  const [subject, setSubject] = useState(baseSubject ? (/^(re|aw):/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`) : "");
  const [body, setBody] = useState("");
  const [context, setContext] = useState<string>(lastIn?.msg.submissionId ?? (apps.length === 1 ? apps[0]!.sub.id : ""));
  const [busy, setBusy] = useState(false);
  const replyTo = lastIn?.msg.fromEmail ?? conv.email;

  const send = async () => {
    setBusy(true);
    const ctx = apps.find(a => a.sub.id === context);
    const refMsg = lastIn ? lastIn.msg.messageId : lastOut?.mail.messageId;
    const refs = lastIn ? [...lastIn.msg.references, ...(lastIn.msg.messageId ? [lastIn.msg.messageId] : [])] : (refMsg ? [refMsg] : []);
    const r = await act(() => sendReply({
      toEmail: replyTo, toName: conv.name, subject, body,
      personId: conv.personId, submissionId: ctx?.sub.id, applicationId: ctx?.app.id,
      inReplyTo: refMsg, references: refs,
    }, actorLabel(acc)), x => (x.skipped ? `Saved, not sent yet: ${x.skipped}` : x.failed ? "Sending failed, see the message below" : "Reply sent"));
    if (r) setBody("");
    setBusy(false);
  };

  return (
    <div class="stack" style="gap:14px">
      <div class="card stack-s">
        <div class="row" style="flex-wrap:nowrap">
          <Avatar name={conv.name} large />
          <div style="flex:1;min-width:0">
            <h2 style="font-size:1.2rem">{conv.name}</h2>
            <span class="muted small">{conv.email}</span>
          </div>
          {conv.personId && <a class="btn btn--ghost btn--sm" href={`/team/crm?p=${conv.personId}`}>CRM profile →</a>}
        </div>
        {apps.length > 0 ? (
          <div class="stack-s">
            <span class="overline" style="font-size:10.5px">Applications{apps.length > 1 ? ` (${apps.length})` : ""}</span>
            <div class="row" style="gap:6px">
              {apps.map(({ sub, app }) => (
                <a class="app-link" href={`/team/application?id=${app.id}&s=${sub.id}`}>
                  <span>{appTitle(app)}</span><StatusChip status={sub.status} />
                </a>
              ))}
            </div>
          </div>
        ) : <p class="muted small">This sender has no application. Emails are linked automatically when the address matches an applicant.</p>}
      </div>

      {conv.items.map(item => item.kind === "in"
        ? <Incoming msg={item.msg} apps={apps} />
        : <Outgoing s={s} mail={item.mail} />)}

      <div class="card stack">
        <div class="row row--between">
          <h3>Reply</h3>
          <span class="muted small">to {replyTo}</span>
        </div>
        <input class="input" value={subject} onInput={e => setSubject(e.currentTarget.value)} aria-label="Subject" placeholder="Subject" />
        <textarea class="input" style="min-height:150px" value={body} onInput={e => setBody(e.currentTarget.value)} aria-label="Message"
          placeholder={`Hi ${conv.name.split(" ")[0]},\n\n…\n\nBest,\n${acc.name.split(" ")[0]}\nOneAIM ${acc.city}`} />
        {apps.length > 1 && (
          <label class="field">
            <span class="field__label">About which application?</span>
            <select class="input input--sm" value={context} onChange={e => setContext(e.currentTarget.value)}>
              <option value="">Not about a specific application</option>
              {apps.map(({ sub, app }) => <option value={sub.id}>{appTitle(app)}</option>)}
            </select>
          </label>
        )}
        <button class="btn btn--primary" style="align-self:flex-start" disabled={busy || !subject.trim() || !body.trim()} onClick={send}>
          {busy ? "Sending…" : "Send reply"}
        </button>
      </div>
    </div>
  );
}

function Incoming({ msg, apps }: { msg: InboxMessage; apps: { sub: Submission; app: Application }[] }) {
  const [main, quoted] = splitQuote(msg.body);
  const [showQuote, setShowQuote] = useState(false);
  const linked = apps.find(a => a.sub.id === msg.submissionId);
  return (
    <div class="mail">
      <div class="mail__head">
        <div class="row row--between" style="flex-wrap:nowrap">
          <span><strong>{msg.fromName ?? msg.fromEmail}</strong> <span class="muted">&lt;{msg.fromEmail}&gt;</span></span>
          <span class="muted small" style="white-space:nowrap">{dt.format(new Date(msg.receivedAt))}</span>
        </div>
        <span><span class="muted">Subject:</span> <strong>{msg.subject || "(no subject)"}</strong></span>
        {msg.cc && <span class="small"><span class="muted">Cc:</span> {msg.cc}</span>}
        <div class="row" style="gap:6px;margin-top:4px">
          <span class="chip chip--purple">Received</span>
          {linked && (
            <a class="chip chip--blue" href={`/team/application?id=${linked.app.id}&s=${linked.sub.id}`} title={msg.matchedBy === "thread" ? "Reply to one of our emails" : "Linked to this application"}>
              {msg.matchedBy === "thread" ? "Reply about" : "About"}: {appTitle(linked.app)} →
            </a>
          )}
          {apps.length > 0 && (
            <select class="input input--sm" style="width:auto;padding-top:3px;padding-bottom:3px;font-size:12.5px" aria-label="Link to application"
              value={msg.submissionId ?? ""} onChange={e => act(() => linkMessage(msg.id, e.currentTarget.value || null), "Email linked")}>
              <option value="">{apps.length > 1 ? "Link to application…" : "Not linked"}</option>
              {apps.map(({ sub, app }) => <option value={sub.id}>{appTitle(app)}</option>)}
            </select>
          )}
          {msg.readAt && <button class="btn btn--ghost btn--sm" style="padding:2px 8px" onClick={() => act(() => markUnread(msg.id))}>Mark unread</button>}
        </div>
      </div>
      <div class="mail__body">
        {linkify(main || "(empty message)")}
        {quoted && (
          <div style="margin-top:10px">
            <button class="btn btn--ghost btn--sm" style="padding:2px 8px" onClick={() => setShowQuote(!showQuote)}>{showQuote ? "Hide" : "Show"} quoted text</button>
            {showQuote && <div class="muted small" style="margin-top:6px;white-space:pre-wrap">{quoted}</div>}
          </div>
        )}
        {msg.attachments.length > 0 && (
          <div class="row" style="gap:6px;margin-top:12px">
            {msg.attachments.map(a => <span class="chip chip--outline" title="Open it in the mailbox"><IconFile width={14} />{a.fileName} · {Math.max(1, Math.round(a.size / 1024))} KB</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

function Outgoing({ s, mail }: { s: State; mail: SentEmail }) {
  const c = outContent(s, mail);
  const app = s.applications.find(a => a.id === mail.applicationId);
  return (
    <div class="mail mail--out">
      <div class="mail__head">
        <div class="row row--between" style="flex-wrap:nowrap">
          <span><strong>OneAIM</strong> <span class="muted">→ {mail.to}</span></span>
          <span class="muted small" style="white-space:nowrap">{dt.format(new Date(mail.at))}</span>
        </div>
        <span><span class="muted">Subject:</span> <strong>{c.subject}</strong></span>
        <div class="row" style="gap:6px;margin-top:4px">
          <span class={`chip ${mail.status === "sent" ? "chip--green" : mail.status === "failed" ? "chip--red" : "chip--amber"}`}>
            {mail.status === "sent" ? "Sent" : mail.status === "failed" ? "Failed" : "Queued"}
          </span>
          <span class="chip chip--outline">{kindLabel(mail)} · by {mail.queuedBy}</span>
          {app && <a class="chip chip--blue" href={`/team/application?id=${app.id}${mail.submissionId ? `&s=${mail.submissionId}` : ""}`}>{appTitle(app)} →</a>}
        </div>
        {mail.error && <span class={`small ${mail.status === "sent" ? "muted" : ""}`} style={mail.status === "sent" ? "" : "color:var(--p-red)"}>{mail.error}</span>}
      </div>
      <div class="mail__body">{linkify(c.body)}</div>
    </div>
  );
}
