// Bank access (read-only, Enable Banking / PSD2) for the Finance area.
// Keys and bank sessions stay on the server (edge function "bank");
// the portal reads connection status and transactions of the cities the
// signed-in person is finance for (presidents, Finance & Legal lead).
import { friendlyError, supabase } from "./supabase";

export interface BankStatus { configured: boolean; app_id?: string; updated_at?: string; updated_by?: string }

export interface BankConnection {
  id: string;
  location_id: string;
  status: "pending" | "active" | "expired" | "error" | "disconnected";
  aspsp_name: string;
  accounts: { uid: string; iban: string | null; name: string | null; currency: string | null }[];
  valid_until: string | null;
  balance: number | null;
  currency: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  connected_by: string | null;
}

export interface BankTransaction {
  id: string;
  location_id: string;
  booking_date: string;
  amount: number;
  currency: string;
  counterparty: string;
  purpose: string;
}

export const BANK_CALLBACK_PATH = "/team/bank-callback";

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("bank", { body });
  if (error) {
    // The function answers with {error}; show that instead of the generic HTTP message
    const ctx = (error as { context?: Response }).context;
    const out = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error(bankError(out?.error ?? friendlyError(error)));
  }
  return data as T;
}

function bankError(code: string): string {
  if (code === "not_allowed") return "Only the presidents and the head of Finance & Legal can do this.";
  if (code === "bank_not_configured") return "Bank access isn't set up yet (Settings → Bank access).";
  if (code === "bank_keys_invalid") return "Please enter the application ID and the private key (a .pem file starting with -----BEGIN PRIVATE KEY-----).";
  if (code.startsWith("bank_keys_rejected:")) return `Enable Banking didn't accept these keys: ${code.slice(19)}`;
  if (code === "bank_link_invalid") return "This bank link is not valid any more. Please start connecting again.";
  if (code === "bank_cancelled") return "Connecting was cancelled at the bank.";
  return code;
}

export async function bankStatus(): Promise<BankStatus> {
  const { data, error } = await supabase.rpc("bank_settings_status");
  if (error) throw new Error(friendlyError(error));
  return (data as BankStatus | null) ?? { configured: false };
}

/** Is the signed-in person finance for this city (or any city when location is null)? */
export async function isFinance(location: string | null): Promise<boolean> {
  const { data } = await supabase.rpc("is_finance", { p_location: location });
  return data === true;
}

export const saveBankKeys = (appId: string, privateKey: string) => call<{ ok: true }>({ action: "settings_save", app_id: appId, private_key: privateKey });
export const clearBankKeys = () => call<{ ok: true }>({ action: "settings_clear" });
export const listBanks = (country = "DE") => call<{ banks: { name: string; country: string; logo: string | null }[] }>({ action: "banks", country }).then(r => r.banks);

/** Starts the bank login; returns the URL of the bank's page */
export const connectBank = (locationId: string, aspspName: string) =>
  call<{ url: string }>({ action: "connect", location_id: locationId, aspsp_name: aspspName, redirect_url: `${location.origin}${BANK_CALLBACK_PATH}` }).then(r => r.url);

export const finishBankLogin = (p: { code?: string | null; state?: string | null; error?: string | null; error_description?: string | null }) =>
  call<{ ok: true; location_id: string; accounts: number }>({ action: "callback", ...p });

export const disconnectBank = (locationId: string) => call<{ ok: true }>({ action: "disconnect", location_id: locationId });

export async function loadBankData(): Promise<{ connections: BankConnection[]; transactions: BankTransaction[] }> {
  const [c, t] = await Promise.all([
    supabase.from("bank_connections").select("*"),
    supabase.from("bank_transactions").select("id, location_id, booking_date, amount, currency, counterparty, purpose").order("booking_date", { ascending: false }).limit(5000),
  ]);
  if (c.error) throw new Error(friendlyError(c.error));
  if (t.error) throw new Error(friendlyError(t.error));
  return {
    connections: (c.data ?? []).map(x => ({ ...x, balance: x.balance === null ? null : Number(x.balance) })) as BankConnection[],
    transactions: (t.data ?? []).map(x => ({ ...x, amount: Number(x.amount) })) as BankTransaction[],
  };
}

// ── Saved IBANs of the signed-in member (for reimbursements) ─────────────

export interface SavedIban { id: string; iban: string; holder: string; label: string | null }

/** Removes spaces, upper case: "de89 3704 …" → "DE893704…" */
export const normalizeIban = (s: string) => s.replace(/\s+/g, "").toUpperCase();

/** Groups of four for display: DE89 3704 0044 0532 0130 00 */
export const formatIban = (s: string) => normalizeIban(s).replace(/(.{4})/g, "$1 ").trim();

/** Checks format and check digits (ISO 13616, mod 97) */
export function ibanValid(s: string): boolean {
  const iban = normalizeIban(s);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("DE") && iban.length !== 22) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

export async function loadMyIbans(memberId: string): Promise<SavedIban[]> {
  const { data, error } = await supabase.from("member_bank_accounts").select("id, iban, holder, label").eq("member_id", memberId).order("created_at");
  if (error) throw new Error(friendlyError(error));
  return (data ?? []) as SavedIban[];
}

export async function saveIban(memberId: string, iban: string, holder: string, label?: string): Promise<SavedIban> {
  const { data, error } = await supabase.from("member_bank_accounts")
    .upsert({ member_id: memberId, iban: normalizeIban(iban), holder: holder.trim(), label: label?.trim() || null }, { onConflict: "member_id,iban" })
    .select("id, iban, holder, label").single();
  if (error) throw new Error(friendlyError(error));
  return data as SavedIban;
}

export async function deleteIban(id: string): Promise<true> {
  const { error } = await supabase.from("member_bank_accounts").delete().eq("id", id);
  if (error) throw new Error(friendlyError(error));
  return true;
}
