// Supabase client for team and apply. Uses the public (anon) key only:
// everything sensitive is protected by the database's access rules
// (supabase/migrations/…_security.sql), not by hiding the key.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  throw new Error("Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY – copy portal/.env.example to portal/.env");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const FILES_BUCKET = "application-files";
export const IMAGES_BUCKET = "public-images";

/** Turns database errors (raise exception '…') into readable messages. */
const MESSAGES: Record<string, string> = {
  consent_required: "Please agree to the data storage to submit.",
  application_not_open: "This application is not open for submissions.",
  already_applied: "You have already applied with this email address. Each person can apply once per application.",
  invalid_email: "Please enter a valid email address.",
  invalid_token: "This link is not valid.",
  not_invited: "Booking is only possible after an interview invitation.",
  invalid_slot: "This slot does not exist.",
  slot_in_past: "This slot is already in the past.",
  slot_full: "This slot was just taken. Please pick another one.",
  not_allowed: "Your account is not allowed to do this.",
  no_slot_booked: "This applicant hasn't booked an interview slot yet.",
  no_free_slots: "Add interview slots with free places first (tab “Interview slots”). Invitations need bookable slots.",
  slots_incomplete: "Some interview slots are incomplete: online slots need a meeting link, in-person slots a place (tab “Interview slots”).",
  slot_incomplete: "This slot can't be booked right now. Please pick another one.",
};

export function friendlyError(e: unknown): string {
  const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
  const key = msg.split(":")[0]!.trim();
  if (MESSAGES[key]) return MESSAGES[key]!;
  if (key === "missing_field") return "Please fill in all required fields.";
  if (key === "invalid_file") return "A file upload failed. Please upload it again.";
  return msg || "Something went wrong. Please try again.";
}
