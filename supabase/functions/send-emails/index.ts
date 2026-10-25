// supabase/functions/send-emails
//
// Sends the queued emails (table email_log) through Brevo.
// • Called by the portal right after a submission or team decision, and
//   every few minutes by pg_cron (retries, emails held back by the limit).
// • Safe to call by anyone: it only sends what the database already queued.
// • Settings (sender, test mode, daily limit) come from email_settings,
//   the Brevo key from the function secret BREVO_API_KEY.

import { createClient } from "jsr:@supabase/supabase-js@2";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const MAX_ATTEMPTS = 5;
const BATCH = 50;

type TemplateKey = "confirmation" | "invite" | "interview_booked" | "rejection" | "acceptance" | "reply";
type Tpl = { subject: string; body: string };

// Same defaults as the team portal (portal/src/lib/fields.ts) – used when an
// application has no own text for a template (e.g. imported rounds).
function defaults(pipeline: string): Record<TemplateKey, Tpl> {
  return {
    confirmation: pipeline === "instant"
      ? {
          subject: "You're in: {application}",
          body: "Hi {first_name},\n\nthanks for registering for {application}. Your spot is confirmed.\nWe'll send you all details closer to the date.\n\nSee you there!\nYour OneAIM {location} team",
        }
      : {
          subject: "We received your application – {application}",
          body: "Hi {first_name},\n\nthank you for applying to {application}! We received your application and will get back to you after the deadline ({deadline}).\n\nBest,\nYour OneAIM {location} team",
        },
    invite: {
      subject: "Interview invitation – {application}",
      body: "Hi {first_name},\n\nwe enjoyed reading your application and would love to get to know you in a short interview (about 15 minutes).\n\nPlease pick a time slot here:\n{booking_link}\n\nBest,\nYour OneAIM {location} team",
    },
    interview_booked: {
      subject: "Interview confirmed – {application}",
      body: "Hi {first_name},\n\nyour interview is confirmed:\n\nWhen: {interview_time}\nWhere: {interview_place}\nMeeting link: {meeting_link}\n\nNeed a different time? You can change your slot here:\n{booking_link}\n\nSee you soon!\nYour OneAIM {location} team",
    },
    rejection: {
      subject: "Your application to {application}",
      body: "Hi {first_name},\n\nthank you for your interest in {application}. We received many strong applications and unfortunately can't offer you a spot this time.\n\nWe'd be happy to see you apply again and at our open events.\n\nBest,\nYour OneAIM {location} team",
    },
    acceptance: {
      subject: "Welcome to {application}!",
      body: "Hi {first_name},\n\ncongratulations, you're in! We're excited to welcome you to {application}, starting {start_date}.\n\nWe'll be in touch with all details shortly.\n\nBest,\nYour OneAIM {location} team",
    },
  };
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" });
const slotFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const fmt = (iso?: string | null) => (iso ? dateFmt.format(new Date(`${iso}T12:00:00Z`)).replace("Sept", "Sep") : "–");

function render(text: string, vars: Record<string, string>) {
  return text.replace(/\{[a-z_]+\}/g, m => vars[m] ?? m);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function toHtml(body: string) {
  const linked = escapeHtml(body).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0052E9">$1</a>');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111">${linked.replace(/\n/g, "<br>")}</div>`;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) return json({ sent: 0, skipped: "BREVO_API_KEY is not set" });

  const { data: settings, error: sErr } = await db.from("email_settings").select("*").single();
  if (sErr || !settings) return json({ error: "email_settings missing" }, 500);
  if (settings.test_mode && !settings.test_recipient) {
    return json({ sent: 0, skipped: "Test mode is on but no test recipient is set" });
  }

  // Daily limit (German calendar day)
  const berlinDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const dayStart = new Date(`${berlinDay}T00:00:00`);
  dayStart.setMinutes(dayStart.getMinutes() - offsetMinutes(dayStart));
  const { count: sentToday } = await db.from("email_log").select("id", { count: "exact", head: true })
    .eq("status", "sent").gte("sent_at", dayStart.toISOString());
  const budget = Math.min(BATCH, settings.daily_limit - (sentToday ?? 0));
  if (budget <= 0) return json({ sent: 0, skipped: "Daily limit reached, remaining emails go out tomorrow" });

  const retryBefore = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: queued } = await db.from("email_log").select("*")
    .eq("status", "queued").lt("attempts", MAX_ATTEMPTS)
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${retryBefore}`)
    .order("created_at").limit(budget);

  let sent = 0, failed = 0;
  for (const mail of queued ?? []) {
    // Claim the row so parallel runs don't send it twice
    const { data: claimed } = await db.from("email_log")
      .update({ attempts: mail.attempts + 1, last_attempt_at: new Date().toISOString() })
      .eq("id", mail.id).eq("status", "queued").eq("attempts", mail.attempts)
      .select("id");
    if (!claimed?.length) continue;

    try {
      const { data: app } = mail.application_id
        ? await db.from("applications")
            .select("title, pipeline, templates, deadline, starts_at, programs(name), locations(name), semesters(label)")
            .eq("id", mail.application_id).single()
        : { data: null };
      // Team replies may have no application; all other emails need one
      if (!app && mail.template !== "reply") throw new Error("application not found");
      const { data: sub } = mail.submission_id
        ? await db.from("submissions")
            .select("booking_token, interview_slots(starts_at, duration_min, location, meeting_link)")
            .eq("id", mail.submission_id).single()
        : { data: null };
      // deno-lint-ignore no-explicit-any
      const slot = (sub as any)?.interview_slots as
        { starts_at: string; duration_min: number; location: string; meeting_link: string | null } | null;
      if (mail.template === "interview_booked" && !slot) throw new Error("no interview slot booked");

      // deno-lint-ignore no-explicit-any
      const a = app as any;
      const program = a?.programs?.name ?? "", location = a?.locations?.name ?? "", semester = a?.semesters?.label ?? "";
      const title = a ? (a.title || `${program} ${location} – ${semester}`) : "";
      // Team replies: the text written in the portal, sent as is
      const tpl: Tpl = mail.template === "reply"
        ? { subject: mail.subject ?? "", body: mail.body ?? "" }
        : { ...defaults(a.pipeline)[mail.template as Exclude<TemplateKey, "reply">], ...(a.templates?.[mail.template] ?? {}) };
      const vars: Record<string, string> = {
        "{first_name}": mail.to_name.trim().split(/\s+/)[0] ?? mail.to_name,
        "{full_name}": mail.to_name,
        "{application}": title,
        "{program}": program,
        "{location}": location,
        "{semester}": semester,
        "{deadline}": fmt(a?.deadline),
        "{start_date}": fmt(a?.starts_at),
        "{booking_link}": sub ? `${settings.apply_base_url.replace(/\/$/, "")}/apply/book?t=${sub.booking_token}` : "",
        "{interview_time}": slot ? `${slotFmt.format(new Date(slot.starts_at))} (${slot.duration_min} min, German time)` : "",
        "{interview_place}": slot?.location || "Online",
        "{meeting_link}": slot?.meeting_link || "follows in a separate email",
      };
      const subject = mail.template === "reply" ? tpl.subject : render(tpl.subject, vars);
      const body = mail.template === "reply" ? tpl.body : render(tpl.body, vars);
      // Keep replies in the same conversation in the recipient's mail program
      const threadHeaders: Record<string, string> = {};
      if (mail.in_reply_to) threadHeaders["In-Reply-To"] = mail.in_reply_to;
      if (mail.references_ids?.length) threadHeaders["References"] = mail.references_ids.join(" ");

      const to = settings.test_mode ? settings.test_recipient : mail.to_email;
      const res = await fetch(BREVO_URL, {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: render(settings.sender_name, vars).replace(/\s+$/, "") || "OneAIM", email: settings.sender_email },
          ...(Object.keys(threadHeaders).length ? { headers: threadHeaders } : {}),
          to: [{ email: to, name: mail.to_name }],
          replyTo: { email: settings.reply_to || settings.sender_email },
          subject: settings.test_mode ? `[TEST → ${mail.to_email}] ${subject}` : subject,
          textContent: body,
          htmlContent: toHtml(body),
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${out.message ?? JSON.stringify(out)}`);

      await db.from("email_log").update({
        status: "sent", subject, body, provider_message_id: out.messageId ?? null,
        sent_at: new Date().toISOString(), error: settings.test_mode ? `test mode: sent to ${to}` : null,
      }).eq("id", mail.id);
      sent++;
    } catch (e) {
      const finalFail = mail.attempts + 1 >= MAX_ATTEMPTS;
      await db.from("email_log").update({
        status: finalFail ? "failed" : "queued", error: String(e instanceof Error ? e.message : e).slice(0, 500),
      }).eq("id", mail.id);
      failed++;
    }
  }

  return json({ sent, failed, testMode: settings.test_mode });
});

/** Minutes Europe/Berlin is ahead of UTC at the given moment (60 or 120). */
function offsetMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", hour12: false, hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {} as Record<string, string>);
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour! % 24, +parts.minute!);
  return Math.round((asUtc - d.getTime()) / 60_000);
}
