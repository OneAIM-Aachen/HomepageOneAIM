// supabase/functions/files
//
// Files on Cloudflare R2 (S3-compatible): CVs and other application uploads,
// and claim receipts. Supabase keeps the data and, per file, its location
// ("r2:uploads/…", "r2:receipts/…"). This function checks who may do what
// and hands out short-lived signed links; the browser uploads/downloads
// directly to/from R2. Keys: table storage_settings (Settings → File storage).
//
// • status                                              (team) configured? files still on Supabase?
// • settings_save {account_id, access_key_id, secret_access_key, bucket, jurisdiction}
//                                                       (finance) checks the keys with a test file, stores them
// • settings_clear                                      (finance)
// • upload {kind: "application", application_id, file_name, content_type, size}
//                                                       (public, open applications only)
// • upload {kind: "receipt", location_id, file_name, content_type, size}   (team member)
//   → {provider: "supabase"} while R2 isn't set up (the portal then uses Supabase Storage as before)
//   → {path, url} otherwise: PUT the file to url within 10 minutes, then save path
// • download {path}                                     (who may: SQL can_read_file) → {url} valid 5 minutes
// • delete {path}                                       (who may: SQL can_delete_file)
// • migrate {limit?}                                    (finance) copies files from Supabase Storage
//   to R2, updates their locations, removes the originals; call again until remaining = 0

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<"application" | "receipt", string[]> = {
  application: [
    "application/pdf", "image/png", "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  receipt: ["application/pdf", "image/png", "image/jpeg", "image/heic", "image/heif", "image/webp"],
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const errText = (e: unknown) => String(e instanceof Error ? e.message : e).slice(0, 500);
const safeName = (n: string) => n.replace(/[^\w.\-]+/g, "_").slice(-100) || "file";

// ── R2 ───────────────────────────────────────────────────────────────────

interface R2Config { account_id: string; access_key_id: string; secret_access_key: string; bucket: string; jurisdiction: string }

class R2 {
  private aws: AwsClient;
  private base: string;
  constructor(c: R2Config) {
    this.aws = new AwsClient({ accessKeyId: c.access_key_id, secretAccessKey: c.secret_access_key, service: "s3", region: "auto" });
    this.base = `https://${c.account_id}${c.jurisdiction === "eu" ? ".eu" : ""}.r2.cloudflarestorage.com/${c.bucket}`;
  }
  static async from(db: SupabaseClient): Promise<R2 | null> {
    const { data } = await db.from("storage_settings").select("*").maybeSingle();
    return data ? new R2(data as R2Config) : null;
  }
  private url(key: string) { return `${this.base}/${key.split("/").map(encodeURIComponent).join("/")}`; }
  /** Signed link for the browser (PUT upload or GET download) */
  async signed(method: "PUT" | "GET", key: string, seconds: number): Promise<string> {
    const req = await this.aws.sign(new Request(`${this.url(key)}?X-Amz-Expires=${seconds}`, { method }), { aws: { signQuery: true } });
    return req.url;
  }
  async put(key: string, body: Blob, type: string) {
    const res = await this.aws.fetch(new Request(this.url(key), { method: "PUT", body, headers: { "Content-Type": type || "application/octet-stream" } }));
    if (!res.ok) throw new Error(`R2 upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  async size(key: string): Promise<number | null> {
    const res = await this.aws.fetch(new Request(this.url(key), { method: "HEAD" }));
    return res.ok ? Number(res.headers.get("content-length")) : null;
  }
  async remove(key: string) {
    const res = await this.aws.fetch(new Request(this.url(key), { method: "DELETE" }));
    if (!res.ok && res.status !== 404) throw new Error(`R2 delete ${res.status}`);
  }
}

const keyOf = (path: string) => path.replace(/^r2:/, "");

// ── Moving files from Supabase Storage to R2 ─────────────────────────────

interface Todo { bucket: string; from: string; to: string; apply: () => Promise<void> }

// deno-lint-ignore no-explicit-any
const isFile = (v: any) => v && typeof v === "object" && !Array.isArray(v) && typeof v.path === "string";

async function pending(db: SupabaseClient) {
  const todo: Omit<Todo, "apply">[] = [];
  const { data: subs } = await db.from("submissions").select("id, answers");
  for (const s of subs ?? []) for (const v of Object.values(s.answers ?? {})) {
    if (isFile(v) && !(v as { path: string }).path.startsWith("r2:")) todo.push({ bucket: "application-files", from: (v as { path: string }).path, to: (v as { path: string }).path });
  }
  const { data: claims } = await db.from("claims").select("id, receipt_path").not("receipt_path", "like", "r2:%");
  for (const c of claims ?? []) todo.push({ bucket: "finance-receipts", from: c.receipt_path, to: `receipts/${c.receipt_path}` });
  const { data: people } = await db.from("people").select("id, cv").not("cv", "is", null);
  const cvs = (people ?? []).filter(p => isFile(p.cv) && !p.cv.path.startsWith("r2:")).length;
  return { files: todo, cvs };
}

async function migrate(db: SupabaseClient, r2: R2, limit: number) {
  const moved = new Map<string, string>();   // old path → new "r2:" path
  const originals: { bucket: string; path: string }[] = [];
  const failed: string[] = [];
  const copy = async (bucket: string, from: string, to: string): Promise<string | null> => {
    if (moved.has(from)) return moved.get(from)!;
    if (moved.size >= limit) return null;
    const { data: blob, error } = await db.storage.from(bucket).download(from);
    if (error || !blob) { failed.push(`${from}: ${error?.message ?? "not found"}`); return null; }
    await r2.put(to, blob, blob.type);
    if ((await r2.size(to)) !== blob.size) { failed.push(`${from}: size check failed`); return null; }
    moved.set(from, `r2:${to}`);
    originals.push({ bucket, path: from });
    return `r2:${to}`;
  };

  // Application uploads (answers of submissions)
  const { data: subs } = await db.from("submissions").select("id, answers");
  for (const s of subs ?? []) {
    const answers = { ...(s.answers ?? {}) };
    let changed = false;
    for (const [k, v] of Object.entries(answers)) {
      if (!isFile(v) || (v as { path: string }).path.startsWith("r2:")) continue;
      const to = await copy("application-files", (v as { path: string }).path, (v as { path: string }).path);
      if (to) { answers[k] = { ...(v as object), path: to }; changed = true; }
    }
    if (changed) {
      const { error } = await db.from("submissions").update({ answers }).eq("id", s.id);
      if (error) throw new Error(error.message);
    }
  }
  // Latest CV on the network profile points to the same file
  const { data: people } = await db.from("people").select("id, cv").not("cv", "is", null);
  for (const p of people ?? []) {
    if (!isFile(p.cv) || p.cv.path.startsWith("r2:")) continue;
    const to = moved.get(p.cv.path) ?? await copy("application-files", p.cv.path, p.cv.path);
    if (to) {
      const { error } = await db.from("people").update({ cv: { ...p.cv, path: to } }).eq("id", p.id);
      if (error) throw new Error(error.message);
    }
  }
  // Claim receipts: <city>/<member>/… → receipts/<city>/<member>/…
  const { data: claims } = await db.from("claims").select("id, receipt_path").not("receipt_path", "like", "r2:%");
  for (const c of claims ?? []) {
    const to = await copy("finance-receipts", c.receipt_path, `receipts/${c.receipt_path}`);
    if (to) {
      const { error } = await db.from("claims").update({ receipt_path: to }).eq("id", c.id);
      if (error) throw new Error(error.message);
    }
  }
  // Only now, with every reference updated, remove the originals
  for (const bucket of ["application-files", "finance-receipts"]) {
    const paths = originals.filter(o => o.bucket === bucket).map(o => o.path);
    for (let i = 0; i < paths.length; i += 100) await db.storage.from(bucket).remove(paths.slice(i, i + 100));
  }
  const rest = await pending(db);
  return { moved: moved.size, failed, remaining: rest.files.length };
}

// ── Requests ─────────────────────────────────────────────────────────────

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const input = await req.json().catch(() => ({}));
  const action = String(input.action ?? "");

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const rpc = async (fn: string, args: Record<string, unknown> = {}) => (await caller.rpc(fn, args)).data;

  try {
    if (action === "upload") {
      const kind = input.kind === "receipt" ? "receipt" : input.kind === "application" ? "application" : null;
      if (!kind) return json({ error: "invalid_option" }, 400);
      const type = String(input.content_type ?? "");
      if (!TYPES[kind].includes(type) || !(Number(input.size) > 0) || Number(input.size) > MAX_BYTES) return json({ error: "invalid_file" }, 400);
      let key: string;
      if (kind === "application") {
        const app = String(input.application_id ?? "");
        const { data: open } = await db.rpc("is_application_open", { p_application_id: app });
        if (open !== true) return json({ error: "application_not_open" }, 400);
        key = `uploads/${app}/${crypto.randomUUID()}/${safeName(String(input.file_name ?? ""))}`;
      } else {
        const member = await rpc("my_member_id");
        const location = String(input.location_id ?? "");
        const { data: loc } = await db.from("locations").select("id").eq("id", location).maybeSingle();
        if (!member || !loc) return json({ error: "not_allowed" }, 403);
        key = `receipts/${location}/${member}/${crypto.randomUUID()}/${safeName(String(input.file_name ?? ""))}`;
      }
      const r2 = await R2.from(db);
      if (!r2) return json({ provider: "supabase" });
      return json({ path: `r2:${key}`, url: await r2.signed("PUT", key, 600) });
    }

    if (action === "download") {
      const path = String(input.path ?? "");
      if (!path.startsWith("r2:") || (await rpc("can_read_file", { p_path: path })) !== true) return json({ error: "not_allowed" }, 403);
      const r2 = await R2.from(db);
      if (!r2) return json({ error: "storage_not_configured" }, 409);
      return json({ url: await r2.signed("GET", keyOf(path), 300) });
    }

    if (action === "delete") {
      const path = String(input.path ?? "");
      if (!path.startsWith("r2:") || (await rpc("can_delete_file", { p_path: path })) !== true) return json({ error: "not_allowed" }, 403);
      const r2 = await R2.from(db);
      if (r2) await r2.remove(keyOf(path));
      return json({ ok: true });
    }

    // ── Settings and moving files: finance people (presidents, Finance & Legal lead)
    const isTeam = (await rpc("is_team")) === true;
    if (action === "status") {
      if (!isTeam) return json({ error: "not_allowed" }, 403);
      const p = await pending(db);
      return json({ configured: !!(await R2.from(db)), on_supabase: p.files.length, cvs_on_supabase: p.cvs });
    }
    if ((await rpc("is_finance", { p_location: null })) !== true) return json({ error: "not_allowed" }, 403);
    const { data: me } = await caller.auth.getUser(jwt);
    const { data: member } = await db.from("team_members").select("name, locations(name)").eq("user_id", me.user?.id ?? "").maybeSingle();
    // deno-lint-ignore no-explicit-any
    const meLabel = member ? `${member.name} (${(member as any).locations?.name ?? ""})` : "Team";

    if (action === "settings_save") {
      const c: R2Config = {
        account_id: String(input.account_id ?? "").trim().toLowerCase(),
        access_key_id: String(input.access_key_id ?? "").trim(),
        secret_access_key: String(input.secret_access_key ?? "").trim(),
        bucket: String(input.bucket ?? "").trim(),
        jurisdiction: input.jurisdiction === "default" ? "default" : "eu",
      };
      if (!/^[0-9a-f]{32}$/.test(c.account_id) || !c.access_key_id || !c.secret_access_key || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(c.bucket)) {
        return json({ error: "storage_keys_invalid" }, 400);
      }
      // Check: write, read back and delete a small test file
      try {
        const r2 = new R2(c);
        const key = `_check/${crypto.randomUUID()}.txt`;
        await r2.put(key, new Blob(["OneAIM storage check"]), "text/plain");
        if ((await r2.size(key)) === null) throw new Error("test file not found after upload");
        await r2.remove(key);
      } catch (e) {
        return json({ error: `storage_keys_rejected:${errText(e)}` }, 400);
      }
      const { error } = await db.from("storage_settings").upsert({ id: true, ...c, updated_at: new Date().toISOString(), updated_by: meLabel });
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (action === "settings_clear") {
      // Not while files are on R2: they couldn't be opened any more
      const { count: receipts } = await db.from("claims").select("id", { count: "exact", head: true }).like("receipt_path", "r2:%");
      const { data: subs } = await db.from("submissions").select("answers");
      const uploads = (subs ?? []).some(s => Object.values(s.answers ?? {}).some(v => isFile(v) && (v as { path: string }).path.startsWith("r2:")));
      if ((receipts ?? 0) > 0 || uploads) return json({ error: "storage_in_use" }, 409);
      await db.from("storage_settings").delete().eq("id", true);
      return json({ ok: true });
    }

    if (action === "migrate") {
      const r2 = await R2.from(db);
      if (!r2) return json({ error: "storage_not_configured" }, 409);
      return json(await migrate(db, r2, Math.min(200, Math.max(1, Number(input.limit) || 40))));
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: errText(e) }, 500);
  }
});
