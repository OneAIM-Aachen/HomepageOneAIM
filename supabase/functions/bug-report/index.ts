// Bug reports from the team area → GitHub issue.
//
// Only signed-in team members. The screenshot (optional, JPEG/PNG, compressed in the
// browser) is stored as a file on the branch `bug-screenshots` of the repository and
// shown in the issue. The repository is public: the dialog tells people not to show
// personal data. At most 10 reports per person and hour (table bug_reports).
//
// Secrets (set them yourself, never in the code):
//   BUG_REPORT_GITHUB_TOKEN  fine-grained token for the repository with
//                            "Issues: Read and write" and "Contents: Read and write"
//   BUG_REPORT_REPO          optional, default OneAIM-Aachen/HomepageOneAIM
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const BRANCH = "bug-screenshots";
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";   // git's empty tree, exists in every repository
const MAX_IMAGE = 3 * 1024 * 1024;
const PER_HOUR = 10;

/** No @-mentions or #-links to other issues out of free text; keep it short */
const clean = (s: unknown, max: number) =>
  String(s ?? "").replace(/\r/g, "").slice(0, max).replace(/@/g, "@​").trim();

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = (Deno.env.get("BUG_REPORT_GITHUB_TOKEN") ?? "").trim();
  const repo = (Deno.env.get("BUG_REPORT_REPO") ?? "OneAIM-Aachen/HomepageOneAIM").trim();
  if (!token) return json({ error: "not_configured" }, 503);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  try {
    const { data: isTeam } = await caller.rpc("is_team");
    if (isTeam !== true) return json({ error: "not_allowed" }, 403);
    const { data: memberId } = await caller.rpc("my_member_id");
    const { data: member } = memberId
      ? await db.from("team_members").select("name, location_id").eq("id", memberId).maybeSingle()
      : { data: null };
    const { data: { user } } = await caller.auth.getUser();
    const reporterKey = memberId ?? user?.id ?? "unknown";

    const input = await req.json().catch(() => ({}));
    const description = clean(input.description, 5000);
    if (description.length < 5) return json({ error: "missing_field:description" }, 400);
    const givenTitle = clean(input.title, 100).replace(/\s+/g, " ");

    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db.from("bug_reports").select("id", { count: "exact", head: true })
      .eq("reporter", reporterKey).gte("created_at", since);
    if ((count ?? 0) >= PER_HOUR) return json({ error: "too_many" }, 429);

    const gh = async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "oneaim-bug-report", "Content-Type": "application/json",
        },
      });
      const body = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, body };
    };

    // Screenshot → file on the bug-screenshots branch (created once, without any website code)
    let imageUrl: string | null = null;
    const image = String(input.image ?? "");
    const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(image);
    if (image && !m) return json({ error: "invalid_file" }, 400);
    if (m) {
      const bytes = Math.floor(m[2]!.length * 3 / 4);
      if (bytes > MAX_IMAGE) return json({ error: "file_too_large" }, 400);
      const branch = await gh(`/git/ref/heads/${BRANCH}`);
      if (branch.status === 404) {
        const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message: "Screenshots for bug reports", tree: EMPTY_TREE, parents: [] }) });
        if (!commit.ok) throw new Error(`GitHub branch ${commit.status}`);
        const ref = await gh("/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: commit.body.sha }) });
        if (!ref.ok) throw new Error(`GitHub branch ${ref.status}`);
      } else if (!branch.ok) throw new Error(`GitHub branch ${branch.status}`);
      const path = `screenshots/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.${m[1] === "png" ? "png" : "jpg"}`;
      const put = await gh(`/contents/${path}`, { method: "PUT", body: JSON.stringify({ message: `Screenshot ${path}`, content: m[2], branch: BRANCH }) });
      if (!put.ok) throw new Error(`GitHub screenshot ${put.status}`);
      imageUrl = `https://raw.githubusercontent.com/${repo}/${BRANCH}/${path}`;
    }

    // Title from the form; older clients without one: first line of the description
    const firstLine = description.split("\n").find(l => l.trim())!.trim();
    const title = givenTitle || (firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine);
    const page = clean(input.page, 300).replace(/^https?:\/\/[^/]+/, "") || "/";
    const { data: loc } = member ? await db.from("locations").select("name").eq("id", member.location_id).maybeSingle() : { data: null };
    const who = member ? `${member.name.split(" ")[0]} (${loc?.name ?? member.location_id})` : "Team member";
    const body = [
      `**Page:** \`${page}\`  `,
      `**Reported by:** ${who}, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC  `,
      `**Browser:** ${clean(input.browser, 200) || "unknown"}`,
      "",
      "### What happened",
      description,
      ...(imageUrl ? ["", "### Screenshot", `![Screenshot](${imageUrl})`] : []),
      "",
      "<sub>Sent from the bug report button in the team area.</sub>",
    ].join("\n");

    const issue = await gh("/issues", { method: "POST", body: JSON.stringify({ title, body, labels: ["bug"] }) });
    if (!issue.ok) throw new Error(`GitHub issue ${issue.status}`);

    await db.from("bug_reports").insert({ reporter: reporterKey, page, issue_url: issue.body.html_url });
    return json({ ok: true, url: issue.body.html_url, number: issue.body.number });
  } catch (e) {
    console.error(e);
    return json({ error: "github_failed", detail: String(e instanceof Error ? e.message : e).slice(0, 200) }, 502);
  }
});
