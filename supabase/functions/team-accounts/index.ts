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
//
// Links are one-time tokens that the portal's /team/welcome page redeems
// (supabase.auth.verifyOtp), so no redirect URL has to be allowed in Supabase.
// Emails go through Brevo with the sender from email_settings; test mode
// does not apply (these emails are for the team itself).

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const RESET_PAUSE_MS = 2 * 60 * 1000;
const ROLES = ["president", "co_president", "lead", "member"];

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
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY is not set");
  const { data: s } = await db.from("email_settings").select("sender_email, reply_to, apply_base_url").single();
  if (!s) throw new Error("email_settings missing");
  const link = `${s.apply_base_url.replace(/\/$/, "")}/team/welcome?token_hash=${encodeURIComponent(token)}&type=${kind}`;
  const first = to.name.split(" ")[0];
  const subject = kind === "invite" ? "Your OneAIM team account" : "Set a new password for the OneAIM team portal";
  const body = kind === "invite"
    ? `Hi ${first},\n\nwelcome to the OneAIM team! You now have your own account for the team portal.\n\nSet your password here:\n${link}\n\nThe link works once and expires after a while. If it has expired, use "Forgot password?" on the login page.\n\nSee you in the portal!\nOneAIM`
    : `Hi ${first},\n\nset a new password for the OneAIM team portal here:\n${link}\n\nThe link works once and expires after a while. If you didn't ask for this, you can ignore this email.\n\nOneAIM`;
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

    // ── Everything else: signed-in team members only
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: who } = await caller.auth.getUser(jwt);
    const { data: isTeam } = await caller.rpc("is_team");
    if (!who.user || isTeam !== true) return json({ error: "not_allowed" }, 403);

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
