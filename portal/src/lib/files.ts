// Stored files: Cloudflare R2 (paths "r2:…") or, until R2 is set up / files
// are moved, Supabase Storage. Uploading asks the edge function "files" for
// a signed upload link; opening asks it for a short-lived download link.
// Who may do what is checked there (SQL can_read_file / can_delete_file).
import { friendlyError, supabase } from "./supabase";

type Kind = "application" | "receipt";
export const isR2 = (path: string) => path.startsWith("r2:");

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("files", { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const out = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error(fileError(out?.error ?? friendlyError(error)));
  }
  return data as T;
}

function fileError(code: string): string {
  if (code === "invalid_file") return "This file type or size isn't allowed (max. 10 MB).";
  if (code === "not_allowed") return "You're not allowed to open or change this file.";
  if (code === "application_not_open") return "This application is not open for submissions.";
  if (code === "storage_keys_invalid") return "Please fill in account ID (32 characters), access key, secret and bucket name.";
  if (code.startsWith("storage_keys_rejected:")) return `Cloudflare didn't accept these keys: ${code.slice(22)}`;
  if (code === "storage_in_use") return "Files are stored on Cloudflare: the keys can only be replaced, not removed.";
  if (code === "storage_not_configured") return "File storage on Cloudflare isn't set up (Settings → File storage).";
  return code;
}

/**
 * Uploads a file and returns its stored path.
 * Supabase fallback paths (while R2 isn't set up): uploads/<application>/… in
 * application-files, <city>/<member>/… in finance-receipts.
 */
export async function uploadFile(file: File, kind: Kind, ctx: { applicationId?: string; locationId?: string; memberId?: string }, fallback: { bucket: string; path: string }): Promise<string> {
  const target = await call<{ provider?: "supabase"; path?: string; url?: string }>({
    action: "upload", kind, application_id: ctx.applicationId, location_id: ctx.locationId,
    file_name: file.name, content_type: file.type, size: file.size,
  });
  if (target.provider === "supabase" || !target.url || !target.path) {
    const up = await supabase.storage.from(fallback.bucket).upload(fallback.path, file, { contentType: file.type || undefined });
    if (up.error) throw new Error(up.error.message);
    return fallback.path;
  }
  const res = await fetch(target.url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
  if (!res.ok) throw new Error(`Uploading failed (${res.status}). Please try again.`);
  return target.path;
}

/** Short-lived link to open a stored file */
export async function fileUrl(path: string, bucket: string): Promise<string> {
  if (isR2(path)) return (await call<{ url: string }>({ action: "download", path })).url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data) throw new Error("Could not open the file.");
  return data.signedUrl;
}

/** Removes a stored file (own unused receipts, or team for application files) */
export async function removeFile(path: string, bucket: string) {
  if (isR2(path)) await call({ action: "delete", path }).catch(() => undefined);
  else await supabase.storage.from(bucket).remove([path]);
}

// ── Settings → File storage ──────────────────────────────────────────────

export interface StorageStatus { configured: boolean; bucket?: string; jurisdiction?: string; updated_at?: string; updated_by?: string }

export async function storageStatus(): Promise<StorageStatus> {
  const { data, error } = await supabase.rpc("storage_settings_status");
  if (error) throw new Error(friendlyError(error));
  return (data as StorageStatus | null) ?? { configured: false };
}

export const filesOnSupabase = () => call<{ configured: boolean; on_supabase: number; cvs_on_supabase: number }>({ action: "status" });

export const saveStorageKeys = (k: { account_id: string; access_key_id: string; secret_access_key: string; bucket: string; jurisdiction: "eu" | "default" }) =>
  call<{ ok: true }>({ action: "settings_save", ...k });

export const clearStorageKeys = () => call<{ ok: true }>({ action: "settings_clear" });

/** Moves a batch of files from Supabase Storage to R2 */
export const moveFilesToR2 = (limit = 40) => call<{ moved: number; failed: string[]; remaining: number }>({ action: "migrate", limit });
