// supabase/functions/team-accounts
//
// Personal team accounts. Accounts exist only by invitation; all members
// have the same rights.
// • invite  {name, email, location_id, role, department_id?}  (team only)
//   creates the login + team profile and emails a "set your password" link
// • activate {member_id, email}                              (team only)
//   gives an existing profile without login (e.g. imported from the
//   website) its email + login and sends the invitation
// • resend  {member_id}                                       (team only)
// • remove  {member_id}                                       (team only, not yourself)
// • reset   {email}                                           (public: "Forgot password?")
// • checkins                                                  (public, daily by pg_cron)
//   yearly "still active?" emails, one reminder after 14 days
// • checkin_now {member_id}                                   (team only) asks right away
// Network site (/members):
// • network_queue                                             (public, pg_cron every 5 min)
//   welcome emails for people who just joined the network
// • network_invite {person_id}                                (team only)
// • reset {email, site: "members"}                            (public) password link for the
//   network site; also creates the login if someone in the network has none yet
//
// Links are one-time tokens that the portal's /team/welcome page redeems
// (supabase.auth.verifyOtp), so no redirect URL has to be allowed in Supabase.
// Emails go through Brevo with the sender from email_settings; test mode
// does not apply (these emails are for the team itself).

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const RESET_PAUSE_MS = 2 * 60 * 1000;
const ROLES = ["president", "co_president", "lead", "member"];
const REMIND_AFTER_MS = 14 * 24 * 3600 * 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

type Kind = "invite" | "recovery";

/** One-time link for the welcome page; creates the auth user for invites. */
async function makeLink(db: SupabaseClient, email: string, kind: Kind) {
  const { data, error } = await db.auth.admin.generateLink({ type: kind, email });
  if (error || !data.user) throw new Error(error?.message ?? "link_failed");
  return { userId: data.user.id, token: data.properties.hashed_token };
}

async function sendMail(db: SupabaseClient, to: { email: string; name: string }, kind: Kind, token: string) {
  const { data: s } = await db.from("email_settings").select("apply_base_url").single();
  if (!s) throw new Error("email_settings missing");
  const link = `${s.apply_base_url.replace(/\/$/, "")}/team/welcome?token_hash=${encodeURIComponent(token)}&type=${kind}`;
  const first = to.name.split(" ")[0];
  const subject = kind === "invite" ? "Your OneAIM team account" : "Set a new password for the OneAIM team portal";
  const body = kind === "invite"
    ? `Hi ${first},\n\nwelcome to the OneAIM team! You now have your own account for the team portal.\n\nSet your password here:\n${link}\n\nThe link works once and expires after a while. If it has expired, use "Forgot password?" on the login page.\n\nSee you in the portal!\nOneAIM`
    : `Hi ${first},\n\nset a new password for the OneAIM team portal here:\n${link}\n\nThe link works once and expires after a while. If you didn't ask for this, you can ignore this email.\n\nOneAIM`;
  await brevo(db, to, subject, body);
}

/** Welcome to the network (new login) or password link (existing login), for /members. */
async function sendNetworkMail(db: SupabaseClient, to: { email: string; name: string }, kind: Kind, token: string, welcome: boolean) {
  const { data: s } = await db.from("email_settings").select("apply_base_url, test_mode, test_recipient").single();
  if (!s) throw new Error("email_settings missing");
  const link = `${s.apply_base_url.replace(/\/$/, "")}/members/welcome?token_hash=${encodeURIComponent(token)}&type=${kind}`;
  const first = to.name.split(" ")[0];
  const subject = welcome ? "Welcome to the OneAIM network!" : "Your login for the OneAIM network";
  const body = welcome
    ? `Hi ${first},\n\ncongratulations, you are now a member of the OneAIM network!\n\nOneAIM brings together students and young professionals from medicine, engineering, computer science, business and beyond who want to shape the future of healthcare. As a member you are part of a community full of amazing people: participants of our programs, our city teams and alumni, together with our partners from industry, research and the startup world.\n\nOn the OneAIM network site you can find the other members, see who studies what and where, and get in touch with each other.\n\nSet your password and log in here:\n${link}\n\nAfter logging in, take a minute to complete your profile (photo, studies, LinkedIn), so others can find you.\n\nThe link works once and expires after a while. If it has expired, use "Forgot password?" on the login page.\n\nWelcome aboard!\nYour OneAIM team`
    : `Hi ${first},\n\nset your password for the OneAIM network here:\n${link}\n\nThe link works once and expires after a while. If you didn't ask for this, you can ignore this email.\n\nYour OneAIM team`;
  // Like all applicant emails: in test mode everything goes to the test address
  const target = s.test_mode ? { email: s.test_recipient ?? "", name: to.name } : to;
  if (!target.email) throw new Error("test mode without test recipient");
  await brevo(db, target, s.test_mode ? `[TEST → ${to.email}] ${subject}` : subject, body);
}

/** Login + welcome email for a person in the network; links the login to them. */
async function inviteToNetwork(db: SupabaseClient, personId: string, welcome: boolean) {
  const { data: p } = await db.from("people").select("id, email, name").eq("id", personId).single();
  if (!p) throw new Error("not_found");
  const link = await linkFor(db, p.email);
  await db.from("network_accounts").upsert({ person_id: p.id, user_id: link.userId, invited_at: new Date().toISOString() });
  await sendNetworkMail(db, p, link.kind, link.token, welcome);
}

async function brevo(db: SupabaseClient, to: { email: string; name: string }, subject: string, body: string) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY is not set");
  const { data: s } = await db.from("email_settings").select("sender_email, reply_to").single();
  if (!s) throw new Error("email_settings missing");
  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "OneAIM Team", email: s.sender_email },
      to: [{ email: to.email, name: to.name }],
      replyTo: { email: s.reply_to || s.sender_email },
      subject,
      textContent: body,
      htmlContent: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111">${
        escapeHtml(body).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0052E9">$1</a>').replace(/\n/g, "<br>")}</div>`,
    }),
  });
  if (!res.ok) {
    const out = await res.json().catch(() => ({}));
    throw new Error(`Brevo ${res.status}: ${out.message ?? ""}`);
  }
}

type CheckMember = {
  id: string; email: string; name: string; check_token: string | null; check_sent_at: string | null; locations: { name: string } | null;
};
const deadlineFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });

/** Yearly "still active?" email; the link opens /team/checkin with Yes / No. */
async function sendCheck(db: SupabaseClient, m: CheckMember, reminder: boolean) {
  const { data: s } = await db.from("email_settings").select("apply_base_url").single();
  const token = m.check_token ?? crypto.randomUUID();
  const link = `${String(s?.apply_base_url ?? "").replace(/\/$/, "")}/team/checkin?t=${token}`;
  const city = m.locations?.name ?? "";
  const first = m.name.split(" ")[0];
  // No answer within one month of the first email → alumni (database job expire_team_checkins)
  const deadline = new Date(reminder && m.check_sent_at ? m.check_sent_at : Date.now());
  deadline.setMonth(deadline.getMonth() + 1);
  const body = `Hi ${first},\n\n${reminder ? "a quick reminder: " : ""}once a year we check who is still active in OneAIM ${city}. Are you still an active part of the team?\n\nPlease answer here (one click):\n${link}\n\nPlease answer by ${deadlineFmt.format(deadline)}. Without an answer, or if you have left, you'll move to our alumni and stay part of the OneAIM network.\n\nThanks!\nOneAIM`;
  await brevo(db, m, reminder ? "Reminder: still part of the OneAIM team?" : "Still part of the OneAIM team?", body);
  const now = new Date().toISOString();
  await db.from("team_members").update(reminder ? { check_reminded_at: now } : { check_token: token, check_sent_at: now }).eq("id", m.id);
}

/** Invite link, or a password link when the login already exists (e.g. an old city login). */
async function linkFor(db: SupabaseClient, email: string): Promise<{ userId: string; token: string; kind: Kind }> {
  try {
    return { ...(await makeLink(db, email, "invite")), kind: "invite" };
  } catch {
    return { ...(await makeLink(db, email, "recovery")), kind: "recovery" };
  }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const input = await req.json().catch(() => ({}));
  const action = String(input.action ?? "");

  try {
    // ── Public: forgot password. Always answers ok, so it reveals nothing.
    if (action === "reset" && input.site === "members") {
      const email = String(input.email ?? "").trim().toLowerCase();
      const { data: p } = await db.from("people").select("id, email, name").eq("email", email).maybeSingle();
      const { data: inNetwork } = p ? await db.rpc("person_in_network", { p_person: p.id }) : { data: false };
      if (p && inNetwork === true) {
        const { data: acc } = await db.from("network_accounts").select("user_id, reset_sent_at").eq("person_id", p.id).maybeSingle();
        const { data: tm } = await db.from("team_members").select("user_id").eq("person_id", p.id).maybeSingle();
        if (!acc?.reset_sent_at || Date.now() - Date.parse(acc.reset_sent_at) > RESET_PAUSE_MS) {
          const link = await linkFor(db, p.email);
          // Team members keep their team login; others get (or keep) a network login
          if (!tm?.user_id) await db.from("network_accounts").upsert({ person_id: p.id, user_id: link.userId, reset_sent_at: new Date().toISOString() });
          else await db.from("network_accounts").upsert({ person_id: p.id, user_id: null, reset_sent_at: new Date().toISOString() });
          await sendNetworkMail(db, p, link.kind, link.token, false);
        }
      }
      return json({ ok: true });
    }

    if (action === "network_queue") {
      const { data: due } = await db.from("network_invites").select("id, person_id").is("sent_at", null).is("error", null).limit(50);
      let sent = 0, failed = 0;
      for (const i of due ?? []) {
        try {
          await inviteToNetwork(db, i.person_id, true);
          await db.from("network_invites").update({ sent_at: new Date().toISOString() }).eq("id", i.id);
          sent++;
        } catch (e) {
          await db.from("network_invites").update({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }).eq("id", i.id);
          failed++;
        }
      }
      return json({ sent, failed });
    }

    if (action === "reset") {
      const email = String(input.email ?? "").trim().toLowerCase();
      const { data: m } = await db.from("team_members").select("id, name, email, reset_sent_at").eq("email", email).maybeSingle();
      if (m && (!m.reset_sent_at || Date.now() - Date.parse(m.reset_sent_at) > RESET_PAUSE_MS)) {
        await db.from("team_members").update({ reset_sent_at: new Date().toISOString() }).eq("id", m.id);
        const { token } = await makeLink(db, m.email, "recovery");
        await sendMail(db, m, "recovery", token);
      }
      return json({ ok: true });
    }

    // ── Public (cron): due yearly checks and reminders
    if (action === "checkins") {
      const sel = "id, email, name, check_token, check_sent_at, locations(name)";
      const now = new Date();
      const { data: due } = await db.from("team_members").select(sel).eq("status", "active").not("email", "is", null)
        .not("user_id", "is", null).is("check_sent_at", null).lte("next_check_at", now.toISOString());
      const { data: remind } = await db.from("team_members").select(sel).eq("status", "active").not("check_token", "is", null)
        .is("check_reminded_at", null).lte("check_sent_at", new Date(now.getTime() - REMIND_AFTER_MS).toISOString());
      let sent = 0, failed = 0;
      for (const [list, reminder] of [[due ?? [], false], [remind ?? [], true]] as const) {
        for (const m of list as unknown as CheckMember[]) {
          try { await sendCheck(db, m, reminder); sent++; } catch { failed++; }
        }
      }
      return json({ sent, failed });
    }

    // ── Everything else: signed-in team members only
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: who } = await caller.auth.getUser(jwt);
    const { data: isTeam } = await caller.rpc("is_team");
    if (!who.user || isTeam !== true) return json({ error: "not_allowed" }, 403);

    if (action === "network_invite") {
      const { data: inNetwork } = await db.rpc("person_in_network", { p_person: input.person_id });
      if (inNetwork !== true) return json({ error: "not_in_network" }, 400);
      const { data: tm } = await db.from("team_members").select("user_id").eq("person_id", input.person_id).maybeSingle();
      if (tm?.user_id) return json({ error: "team_has_login" }, 400);
      await inviteToNetwork(db, String(input.person_id), true);
      return json({ ok: true });
    }

    if (action === "invite") {
      const email = String(input.email ?? "").trim().toLowerCase();
      const name = String(input.name ?? "").trim();
      if (!name || !validEmail(email)) return json({ error: "missing_field" }, 400);
      if (!ROLES.includes(input.role)) return json({ error: "invalid_option" }, 400);
      const { data: exists } = await db.from("team_members").select("id").eq("email", email).maybeSingle();
      if (exists) return json({ error: "member_exists" }, 409);
      // Check the network profile before creating the login, so a refused
      // name doesn't leave a login without a member behind.
      const { data: person } = await db.from("people").select("name").eq("email", email).maybeSingle();
      const norm = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();
      if (person && norm(person.name) !== norm(name)) return json({ error: `member_name_mismatch:${person.name}` }, 409);

      const link = await linkFor(db, email);
      const { data: member, error } = await db.from("team_members").insert({
        user_id: link.userId, email, name, location_id: input.location_id, role: input.role,
        department_id: input.department_id || null, position: input.position || null,
        invited_at: new Date().toISOString(),
      }).select("id").single();
      if (error) throw new Error(error.message);
      try {
        await sendMail(db, { email, name }, link.kind, link.token);
      } catch (e) {
        return json({ id: member.id, mailError: String(e instanceof Error ? e.message : e) });
      }
      return json({ id: member.id });
    }

    const { data: m } = await db.from("team_members").select("id, user_id, email, name").eq("id", input.member_id ?? "").maybeSingle();
    if (!m) return json({ error: "not_found" }, 404);

    if (action === "activate") {
      const email = String(input.email ?? "").trim().toLowerCase();
      if (!validEmail(email)) return json({ error: "invalid_email" }, 400);
      if (m.user_id) return json({ error: "member_exists" }, 409);
      const { data: taken } = await db.from("team_members").select("id").eq("email", email).neq("id", m.id).maybeSingle();
      if (taken) return json({ error: "member_exists" }, 409);
      const { data: person } = await db.from("people").select("name").eq("email", email).maybeSingle();
      const norm = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();
      if (person && norm(person.name) !== norm(m.name)) return json({ error: `member_name_mismatch:${person.name}` }, 409);

      const link = await linkFor(db, email);
      const { error } = await db.from("team_members")
        .update({ email, user_id: link.userId, invited_at: new Date().toISOString() }).eq("id", m.id);
      if (error) throw new Error(error.message);
      try {
        await sendMail(db, { email, name: m.name }, link.kind, link.token);
      } catch (e) {
        return json({ ok: true, mailError: String(e instanceof Error ? e.message : e) });
      }
      return json({ ok: true });
    }

    if (action === "checkin_now") {
      const { data: c } = await db.from("team_members").select("id, email, name, check_token, check_sent_at, status, locations(name)").eq("id", m.id).single();
      if (!c?.email || c.status !== "active") return json({ error: "missing_field" }, 400);
      await db.from("team_members").update({ check_reminded_at: null }).eq("id", m.id);
      await sendCheck(db, c as unknown as CheckMember, false);
      return json({ ok: true });
    }

    if (action === "resend") {
      if (!m.email) return json({ error: "missing_field" }, 400);
      const link = await linkFor(db, m.email);
      if (!m.user_id) await db.from("team_members").update({ user_id: link.userId }).eq("id", m.id);
      await db.from("team_members").update({ invited_at: new Date().toISOString() }).eq("id", m.id);
      await sendMail(db, m, link.kind, link.token);
      return json({ ok: true });
    }

    if (action === "remove") {
      if (m.user_id === who.user.id) return json({ error: "remove_self" }, 400);
      // The network profile (people) stays: they remain part of the network.
      await db.from("team_members").delete().eq("id", m.id);
      // A city login (e.g. aachen@one-aim.org) is never deleted here.
      const { data: city } = m.user_id
        ? await db.from("team_accounts").select("user_id").eq("user_id", m.user_id).maybeSingle()
        : { data: null };
      if (m.user_id && !city) await db.auth.admin.deleteUser(m.user_id);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
