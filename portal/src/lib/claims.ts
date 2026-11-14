// Reimbursement claims, stored in Supabase (table claims, receipts in the
// private bucket finance-receipts, one folder per city:
// <city>/<member id>/<uuid>/<file>). Members see their own claims; the
// finance people of a city (presidents, Finance & Legal lead) see that
// city's claims and decide on them. No emails are sent for claims.
import { friendlyError, supabase } from "./supabase";

export const RECEIPTS_BUCKET = "finance-receipts";

export interface ClaimRow {
  id: string;
  member_id: string;
  location_id: string;
  amount: number;
  paid_on: string;
  what: string;
  project: string;
  category: string;
  receipt_path: string;
  receipt_name: string;
  iban: string;
  holder: string;
  status: "submitted" | "question" | "approved" | "paid" | "rejected";
  note: string | null;
  answer: string | null;
  decided_by: string | null;
  decided_at: string | null;
  paid_by: string | null;
  paid_at: string | null;
  created_at: string;
}

const MESSAGES: Record<string, string> = {
  claim_not_deletable: "Only claims that aren't approved yet can be deleted.",
  claim_not_found: "This claim doesn't exist any more.",
  claim_own: "Nobody can decide on their own claim: someone else has to.",
  claim_already_decided: "This claim was already decided.",
  claim_not_approved: "Only approved claims can be marked as paid.",
  not_allowed: "Only the presidents and the head of Finance & Legal of this city can do this.",
};

function fail(error: unknown): never {
  const msg = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error);
  throw new Error(MESSAGES[msg] ?? friendlyError(error));
}

export async function loadClaims(): Promise<ClaimRow[]> {
  const { data, error } = await supabase.from("claims").select("*").order("created_at", { ascending: false });
  if (error) fail(error);
  return (data ?? []).map(c => ({ ...c, amount: Number(c.amount) })) as ClaimRow[];
}

const safeName = (n: string) => n.replace(/[^\w.\-]+/g, "_").slice(-100) || "receipt";

export interface NewClaimInput {
  memberId: string; locationId: string; amount: number; paidOn: string; what: string; project: string; category: string;
  iban: string; holder: string; file: File;
}

/** Uploads the receipt, then saves the claim (the file is removed again if saving fails) */
export async function submitClaim(c: NewClaimInput) {
  const path = `${c.locationId}/${c.memberId}/${crypto.randomUUID()}/${safeName(c.file.name)}`;
  const up = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, c.file, { contentType: c.file.type || undefined });
  if (up.error) throw new Error(`Uploading the receipt failed. Please use a photo or PDF under 10 MB. (${up.error.message})`);
  const { error } = await supabase.from("claims").insert({
    member_id: c.memberId, location_id: c.locationId, amount: Math.round(c.amount * 100) / 100, paid_on: c.paidOn, what: c.what.trim(),
    project: c.project, category: c.category, receipt_path: path, receipt_name: c.file.name, iban: c.iban, holder: c.holder.trim(),
  });
  if (error) {
    await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);
    fail(error);
  }
  return true as const;
}

export async function deleteClaim(id: string) {
  const { data, error } = await supabase.rpc("claim_delete", { p_id: id });
  if (error) fail(error);
  if (data) await supabase.storage.from(RECEIPTS_BUCKET).remove([data as string]);
  return true as const;
}

export async function answerClaim(id: string, answer: string) {
  const { error } = await supabase.rpc("claim_answer", { p_id: id, p_answer: answer });
  if (error) fail(error);
  return true as const;
}

export async function decideClaims(ids: string[], decision: "approve" | "question" | "reject", note?: string) {
  const { data, error } = await supabase.rpc("claim_decide", { p_ids: ids, p_decision: decision, p_note: note ?? null });
  if (error) fail(error);
  return data as number;
}

export async function markClaimsPaid(ids: string[]) {
  const { data, error } = await supabase.rpc("claim_mark_paid", { p_ids: ids });
  if (error) fail(error);
  return data as number;
}

/** Short-lived link to open a receipt */
export async function receiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, 300);
  if (error || !data) fail(error ?? "Receipt not found");
  return data.signedUrl;
}
