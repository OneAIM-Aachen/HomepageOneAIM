// supabase/functions/sync-mailbox
//
// Reads new emails from the sender account's inbox (IMAP, e.g. Strato) and
// stores them in mailbox_messages, matched to people and applications.
// • Runs every 2 minutes (pg_cron) and on "Sync now" in the portal.
// • Safe to call by anyone: it only copies new mail into the database.
// • Secrets: IMAP_USER, IMAP_PASSWORD (set by you), IMAP_HOST (optional,
//   default imap.strato.de).

import { createClient } from "jsr:@supabase/supabase-js@2";
import PostalMime from "npm:postal-mime@2.4.4";

const BATCH = 30;                       // messages per run (cron catches up)
const MAX_BODY_BYTES = 8 * 1024 * 1024; // bigger mails: headers only

// ── Minimal IMAP client (only what we need) ──────────────────────────────

class Imap {
  private buf = new Uint8Array(0);
  private tag = 0;
  private enc = new TextEncoder();
  private dec = new TextDecoder();
  private constructor(private conn: Deno.TlsConn) {}

  static async open(hostname: string): Promise<Imap> {
    const imap = new Imap(await Deno.connectTls({ hostname, port: 993 }));
    await imap.readResponse(); // greeting
    return imap;
  }

  private async fill() {
    const chunk = new Uint8Array(64 * 1024);
    const n = await this.conn.read(chunk);
    if (n === null) throw new Error("IMAP connection closed");
    const next = new Uint8Array(this.buf.length + n);
    next.set(this.buf);
    next.set(chunk.subarray(0, n), this.buf.length);
    this.buf = next;
  }

  private async readLine(): Promise<string> {
    for (;;) {
      const i = this.buf.findIndex((b, k) => b === 13 && this.buf[k + 1] === 10);
      if (i >= 0) {
        const line = this.dec.decode(this.buf.subarray(0, i));
        this.buf = this.buf.subarray(i + 2);
        return line;
      }
      await this.fill();
    }
  }

  private async readBytes(n: number): Promise<Uint8Array> {
    while (this.buf.length < n) await this.fill();
    const out = this.buf.slice(0, n);
    this.buf = this.buf.subarray(n);
    return out;
  }

  /** One response incl. literals ({N}\r\n + N bytes). */
  private async readResponse(): Promise<{ line: string; literals: Uint8Array[] }> {
    let line = "";
    const literals: Uint8Array[] = [];
    for (;;) {
      const part = await this.readLine();
      line += part;
      const m = part.match(/\{(\d+)\}$/);
      if (!m) return { line, literals };
      literals.push(await this.readBytes(Number(m[1])));
    }
  }

  private async write(s: string) {
    await this.conn.write(this.enc.encode(s));
  }

  async command(cmd: string, onContinue?: () => string) {
    const tag = `A${++this.tag}`;
    await this.write(`${tag} ${cmd}\r\n`);
    const untagged: { line: string; literals: Uint8Array[] }[] = [];
    for (;;) {
      const r = await this.readResponse();
      if (r.line.startsWith("+") && onContinue) { await this.write(onContinue() + "\r\n"); continue; }
      if (r.line.startsWith(`${tag} `)) {
        if (!r.line.startsWith(`${tag} OK`)) throw new Error(r.line.replace(/^A\d+ /, "IMAP: "));
        return untagged;
      }
      untagged.push(r);
    }
  }

  async login(user: string, pass: string) {
    const bytes = this.enc.encode(`\0${user}\0${pass}`);
    const b64 = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""));
    await this.command("AUTHENTICATE PLAIN", () => b64);
  }

  async close() {
    try { await this.command("LOGOUT"); } catch { /* ignore */ }
    try { this.conn.close(); } catch { /* ignore */ }
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const imapDate = (d: Date) => `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

function htmlToText(html: string): string {
  return html.replace(/<(br|\/p|\/div|\/li|\/tr)[^>]*>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n").trim();
}

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, "0")).join("");
}

const ids = (s?: string | null) => (s ?? "").match(/<[^>]+>/g) ?? [];

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  const user = Deno.env.get("IMAP_USER");
  const pass = Deno.env.get("IMAP_PASSWORD");
  const host = Deno.env.get("IMAP_HOST") ?? "imap.strato.de";
  if (!user || !pass) return json({ synced: 0, skipped: "IMAP_USER / IMAP_PASSWORD are not set" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: state } = await db.from("mailbox_state").select("*").single();
  if (!state) return json({ error: "mailbox_state missing" }, 500);

  // Don't retry credentials the server already rejected (avoids a mailbox lock)
  const credHash = await sha256(`${host}\n${user}\n${pass}`);
  if (state.failed_credentials_hash === credHash) {
    return json({ synced: 0, error: "Mailbox login was rejected. Store the correct password (IMAP_PASSWORD) to try again." });
  }

  let imap: Imap | null = null;
  let synced = 0;
  try {
    imap = await Imap.open(host);
    try {
      await imap.login(user, pass);
    } catch (e) {
      await db.from("mailbox_state").update({ failed_credentials_hash: credHash }).eq("id", true);
      throw e;
    }
    const sel = await imap.command('SELECT "INBOX"');
    const validity = Number(sel.map(r => r.line.match(/UIDVALIDITY (\d+)/)?.[1]).find(Boolean) ?? 0);

    // Mailbox was rebuilt on the server: start over from sync_since (duplicates are skipped by Message-ID)
    let lastUid = state.uid_validity === validity ? Number(state.last_uid) : 0;
    const search = lastUid > 0
      ? await imap.command(`UID SEARCH UID ${lastUid + 1}:*`)
      : await imap.command(`UID SEARCH SINCE ${imapDate(new Date(state.sync_since))}`);
    const uids = search.flatMap(r => r.line.startsWith("* SEARCH") ? r.line.slice(8).trim().split(/\s+/).filter(Boolean).map(Number) : [])
      .filter(u => u > lastUid).sort((a, b) => a - b).slice(0, BATCH);

    for (const uid of uids) {
      const meta = await imap.command(`UID FETCH ${uid} (UID RFC822.SIZE INTERNALDATE)`);
      const size = Number(meta.map(r => r.line.match(/RFC822\.SIZE (\d+)/)?.[1]).find(Boolean) ?? 0);
      const internal = meta.map(r => r.line.match(/INTERNALDATE "([^"]+)"/)?.[1]).find(Boolean);
      const part = size > MAX_BODY_BYTES ? "BODY.PEEK[HEADER]" : "BODY.PEEK[]";
      const res = await imap.command(`UID FETCH ${uid} (${part})`);
      const raw = res.flatMap(r => r.literals)[0];

      if (raw) {
        // deno-lint-ignore no-explicit-any
        const mail: any = await PostalMime.parse(raw);
        const messageId = mail.messageId ?? null;
        const exists = messageId
          ? (await db.from("mailbox_messages").select("id").eq("message_id", messageId).limit(1)).data?.length
          : 0;

        if (!exists) {
          const refs = [...ids(mail.inReplyTo), ...ids(mail.references)];
          const fromEmail: string | null = mail.from?.address?.toLowerCase() ?? null;

          // 1) Reply to one of our emails → exact application
          let personId: string | null = null, submissionId: string | null = null, matchedBy: string | null = null;
          if (refs.length) {
            const { data: ours } = await db.from("email_log").select("submission_id, person_id")
              .in("provider_message_id", refs).limit(1);
            if (ours?.length) {
              personId = ours[0].person_id; submissionId = ours[0].submission_id; matchedBy = "thread";
            } else {
              // reply to an earlier incoming message (thread continues)
              const { data: prev } = await db.from("mailbox_messages").select("submission_id, person_id")
                .in("message_id", refs).not("person_id", "is", null).limit(1);
              if (prev?.length) { personId = prev[0].person_id; submissionId = prev[0].submission_id; matchedBy = "thread"; }
            }
          }
          // 2) Known sender → person (+ the application if they have only one)
          if (!personId && fromEmail) {
            const { data: p } = await db.from("people").select("id").eq("email", fromEmail).maybeSingle();
            if (p) {
              personId = p.id; matchedBy = "sender";
              const { data: subs } = await db.from("submissions").select("id").eq("person_id", p.id);
              if (subs?.length === 1) submissionId = subs[0].id;
            }
          }

          const fmtList = (l?: { address?: string; name?: string }[]) =>
            (l ?? []).map(a => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", ") || null;
          const body = (mail.text || (mail.html ? htmlToText(mail.html) : "") || (part.includes("HEADER") ? "(Email too large to show. Open it in the mailbox.)" : "")).slice(0, 50_000);

          await db.from("mailbox_messages").upsert({
            uid_validity: validity, uid,
            message_id: messageId, in_reply_to: mail.inReplyTo ?? null, references_ids: refs,
            from_email: fromEmail, from_name: mail.from?.name || null,
            to_text: fmtList(mail.to), cc_text: fmtList(mail.cc),
            subject: mail.subject ?? "", body_text: body,
            // deno-lint-ignore no-explicit-any
            attachments: (mail.attachments ?? []).map((a: any) => ({ fileName: a.filename ?? "attachment", size: a.content?.byteLength ?? 0, mimeType: a.mimeType })),
            received_at: new Date(mail.date ?? internal ?? Date.now()).toISOString(),
            person_id: personId, submission_id: submissionId, matched_by: matchedBy,
          }, { onConflict: "uid_validity,uid", ignoreDuplicates: true });
          synced++;
        }
      }
      lastUid = uid;
      await db.from("mailbox_state").update({ uid_validity: validity, last_uid: lastUid }).eq("id", true);
    }

    await db.from("mailbox_state").update({ uid_validity: validity, last_sync_at: new Date().toISOString(), last_error: null, failed_credentials_hash: null }).eq("id", true);
    return json({ synced, more: uids.length === BATCH });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).slice(0, 500);
    await db.from("mailbox_state").update({ last_sync_at: new Date().toISOString(), last_error: msg }).eq("id", true);
    return json({ synced, error: msg }, 500);
  } finally {
    await imap?.close();
  }
});
