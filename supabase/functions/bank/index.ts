// supabase/functions/bank
//
// Read-only bank access per city through Enable Banking (PSD2 account
// information). The provider keys live in bank_settings, which only this
// function (service role) can read.
// • settings_save {app_id, private_key}          (finance of any city) checks and stores the keys
// • settings_clear                               (finance of any city)
// • banks {country?}                             (finance) banks to pick from
// • connect {location_id, aspsp_name, redirect_url}  (finance of that city)
//   returns the bank's login URL; the treasurer confirms there with TAN/app
// • callback {code?, state, error?}              (finance of that city) after the bank
//   redirected back to /team/bank-callback: creates the session, first sync
// • disconnect {location_id}                     (finance of that city)
// • sync_all                                     (public, pg_cron 4× a day) skips
//   connections synced within the last 5 hours (banks allow ~4 fetches a day)
//
// "Finance" = presidents, co-presidents and the lead of the Finance & Legal
// department (SQL function is_finance).

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { signJwt } from "./jwt.ts";

const API = "https://api.enablebanking.com";
const CONSENT_DAYS = 180;
const MIN_SYNC_GAP_MS = 5 * 3600 * 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const errText = (e: unknown) => String(e instanceof Error ? e.message : e).slice(0, 500);

// ── Enable Banking API ───────────────────────────────────────────────────

class Bank {
  constructor(private jwt: string) {}
  static async from(db: SupabaseClient): Promise<Bank> {
    const { data } = await db.from("bank_settings").select("app_id, private_key").maybeSingle();
    if (!data) throw new Error("bank_not_configured");
    return new Bank(await signJwt(data.app_id, data.private_key));
  }
  async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.jwt}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Enable Banking ${res.status}: ${out.message ?? out.error ?? JSON.stringify(out).slice(0, 200)}`);
    return out as T;
  }
}

// ── Sync ─────────────────────────────────────────────────────────────────

interface EbAmount { amount: string; currency: string }
interface EbTransaction {
  entry_reference?: string | null; transaction_amount: EbAmount; credit_debit_indicator: string; status: string;
  booking_date?: string; value_date?: string; transaction_date?: string;
  creditor?: { name?: string } | null; debtor?: { name?: string } | null; remittance_information?: string[] | null;
}

async function hash(s: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(d.slice(0, 16), b => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
async function syncConnection(db: SupabaseClient, bank: Bank, conn: any) {
  const accounts = (conn.accounts ?? []) as { uid: string; currency?: string }[];
  let balance: number | null = null, currency: string | null = null;
  // Fetch from a few days before the last booked transaction (late bookings), or as far back as the bank allows
  const { data: last } = await db.from("bank_transactions").select("booking_date").eq("location_id", conn.location_id)
    .order("booking_date", { ascending: false }).limit(1).maybeSingle();
  const from = last ? new Date(Date.parse(last.booking_date) - 7 * 86400e3).toISOString().slice(0, 10) : null;

  for (const acc of accounts) {
    const bal = await bank.call<{ balances: { balance_amount: EbAmount; balance_type: string }[] }>("GET", `/accounts/${acc.uid}/balances`);
    const pick = ["CLBD", "ITAV", "CLAV", "XPCD", "ITBD"].map(t => bal.balances?.find(b => b.balance_type === t)).find(Boolean) ?? bal.balances?.[0];
    if (pick) { balance = (balance ?? 0) + Number(pick.balance_amount.amount); currency = pick.balance_amount.currency; }

    let key: string | null = null;
    do {
      const q = new URLSearchParams(from ? { date_from: from } : { strategy: "longest" });
      if (key) q.set("continuation_key", key);
      const page = await bank.call<{ transactions: EbTransaction[]; continuation_key?: string | null }>("GET", `/accounts/${acc.uid}/transactions?${q}`);
      const rows = [];
      for (const t of page.transactions ?? []) {
        if (t.status && t.status !== "BOOK") continue;    // only booked transactions
        const out = t.credit_debit_indicator === "DBIT";
        const amount = Math.abs(Number(t.transaction_amount.amount)) * (out ? -1 : 1);
        const booking = t.booking_date ?? t.value_date ?? t.transaction_date;
        if (!booking) continue;
        const counterparty = (out ? t.creditor?.name : t.debtor?.name) ?? "";
        const purpose = (t.remittance_information ?? []).join(" ").trim();
        rows.push({
          location_id: conn.location_id, account_uid: acc.uid,
          external_id: t.entry_reference || await hash(`${booking}|${amount}|${counterparty}|${purpose}`),
          booking_date: booking, value_date: t.value_date ?? null, amount, currency: t.transaction_amount.currency,
          counterparty, purpose, raw: t,
        });
      }
      if (rows.length) {
        const { error } = await db.from("bank_transactions").upsert(rows, { onConflict: "account_uid,external_id", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
      key = page.continuation_key ?? null;
    } while (key);
  }
  await db.from("bank_connections").update({
    balance, currency, balance_at: new Date().toISOString(), last_sync_at: new Date().toISOString(), last_error: null,
  }).eq("id", conn.id);
}

// ── Requests ─────────────────────────────────────────────────────────────

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const input = await req.json().catch(() => ({}));
  const action = String(input.action ?? "");

  try {
    // ── Public (pg_cron): sync every active connection that is due
    if (action === "sync_all") {
      const { data: conns } = await db.from("bank_connections").select("*").eq("status", "active");
      const due = (conns ?? []).filter(c => !c.last_sync_at || Date.now() - Date.parse(c.last_sync_at) > MIN_SYNC_GAP_MS);
      if (!due.length) return json({ synced: 0 });
      const bank = await Bank.from(db);
      let synced = 0, failed = 0;
      for (const c of due) {
        if (c.valid_until && Date.parse(c.valid_until) < Date.now()) {
          await db.from("bank_connections").update({ status: "expired" }).eq("id", c.id);
          continue;
        }
        try { await syncConnection(db, bank, c); synced++; }
        catch (e) { failed++; await db.from("bank_connections").update({ last_error: errText(e) }).eq("id", c.id); }
      }
      return json({ synced, failed });
    }

    // ── Everything else: finance people only
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: who } = await caller.auth.getUser(jwt);
    if (!who.user) return json({ error: "not_allowed" }, 403);
    const financeOf = async (location: string | null) => (await caller.rpc("is_finance", { p_location: location })).data === true;
    const { data: me } = await db.from("team_members").select("name, locations(name)").eq("user_id", who.user.id).maybeSingle();
    // deno-lint-ignore no-explicit-any
    const meLabel = me ? `${me.name} (${(me as any).locations?.name ?? ""})` : who.user.email ?? "Team";

    if (action === "settings_save") {
      if (!(await financeOf(null))) return json({ error: "not_allowed" }, 403);
      const appId = String(input.app_id ?? "").trim();
      const key = String(input.private_key ?? "").trim();
      if (!appId || !/-----BEGIN (RSA )?PRIVATE KEY-----/.test(key)) return json({ error: "bank_keys_invalid" }, 400);
      // Check the keys before saving: list the banks with them
      try {
        await new Bank(await signJwt(appId, key)).call("GET", "/aspsps?country=DE&service=AIS");
      } catch (e) {
        return json({ error: `bank_keys_rejected:${errText(e)}` }, 400);
      }
      const { error } = await db.from("bank_settings").upsert({ id: true, provider: "enable_banking", app_id: appId, private_key: key, updated_at: new Date().toISOString(), updated_by: meLabel });
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (action === "settings_clear") {
      if (!(await financeOf(null))) return json({ error: "not_allowed" }, 403);
      await db.from("bank_settings").delete().eq("id", true);
      return json({ ok: true });
    }

    if (action === "banks") {
      if (!(await financeOf(null))) return json({ error: "not_allowed" }, 403);
      const bank = await Bank.from(db);
      const country = /^[A-Z]{2}$/.test(String(input.country ?? "")) ? input.country : "DE";
      // deno-lint-ignore no-explicit-any
      const out = await bank.call<{ aspsps: any[] }>("GET", `/aspsps?country=${country}&service=AIS`);
      return json({ banks: (out.aspsps ?? []).map(a => ({ name: a.name, country: a.country, logo: a.logo ?? null })) });
    }

    if (action === "connect") {
      const location = String(input.location_id ?? "");
      if (!(await financeOf(location))) return json({ error: "not_allowed" }, 403);
      const aspsp = String(input.aspsp_name ?? "").trim();
      const redirect = String(input.redirect_url ?? "");
      if (!aspsp || !/^https?:\/\/[^/]+\/team\/bank-callback$/.test(redirect)) return json({ error: "missing_field" }, 400);
      const bank = await Bank.from(db);
      const state = crypto.randomUUID();
      // Some banks allow less than 180 days: then ask for 90
      // deno-lint-ignore no-explicit-any
      let auth: any;
      for (const days of [CONSENT_DAYS, 90]) {
        try {
          auth = await bank.call("POST", "/auth", {
            access: { valid_until: new Date(Date.now() + days * 86400e3).toISOString() },
            aspsp: { name: aspsp, country: String(input.aspsp_country ?? "DE") },
            state, redirect_url: redirect, psu_type: "business", language: "de",
          });
          break;
        } catch (e) { if (days === 90) throw e; }
      }
      const { error } = await db.from("bank_connections").upsert({
        location_id: location, status: "pending", aspsp_name: aspsp, aspsp_country: String(input.aspsp_country ?? "DE"),
        auth_state: state, connected_by: meLabel, last_error: null,
      }, { onConflict: "location_id" });
      if (error) throw new Error(error.message);
      return json({ url: auth.url });
    }

    if (action === "callback") {
      const { data: conn } = await db.from("bank_connections").select("*").eq("auth_state", String(input.state ?? "")).maybeSingle();
      if (!conn) return json({ error: "bank_link_invalid" }, 400);
      if (!(await financeOf(conn.location_id))) return json({ error: "not_allowed" }, 403);
      if (input.error || !input.code) {
        await db.from("bank_connections").update({ status: conn.session_id ? "active" : "error", auth_state: null, last_error: String(input.error_description ?? input.error ?? "cancelled") }).eq("id", conn.id);
        return json({ error: "bank_cancelled", location_id: conn.location_id }, 400);
      }
      const bank = await Bank.from(db);
      // deno-lint-ignore no-explicit-any
      const s = await bank.call<any>("POST", "/sessions", { code: String(input.code) });
      // A new connection replaces the old session of this city
      if (conn.session_id && conn.session_id !== s.session_id) await bank.call("DELETE", `/sessions/${conn.session_id}`).catch(() => undefined);
      const accounts = (s.accounts ?? []).map((a: { uid: string; account_id?: { iban?: string }; name?: string; currency?: string }) =>
        ({ uid: a.uid, iban: a.account_id?.iban ?? null, name: a.name ?? null, currency: a.currency ?? null }));
      const { data: updated, error } = await db.from("bank_connections").update({
        status: "active", session_id: s.session_id, accounts, valid_until: s.access?.valid_until ?? null, auth_state: null, last_error: null,
      }).eq("id", conn.id).select("*").single();
      if (error) throw new Error(error.message);
      try { await syncConnection(db, bank, updated); }
      catch (e) { await db.from("bank_connections").update({ last_error: errText(e) }).eq("id", conn.id); }
      return json({ ok: true, location_id: conn.location_id, accounts: accounts.length });
    }

    if (action === "disconnect") {
      const location = String(input.location_id ?? "");
      if (!(await financeOf(location))) return json({ error: "not_allowed" }, 403);
      const { data: conn } = await db.from("bank_connections").select("*").eq("location_id", location).maybeSingle();
      if (!conn) return json({ ok: true });
      if (conn.session_id) await Bank.from(db).then(b => b.call("DELETE", `/sessions/${conn.session_id}`)).catch(() => undefined);
      await db.from("bank_connections").update({ status: "disconnected", session_id: null, auth_state: null }).eq("id", conn.id);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    const msg = errText(e);
    return json({ error: msg }, msg === "bank_not_configured" ? 409 : 500);
  }
});
