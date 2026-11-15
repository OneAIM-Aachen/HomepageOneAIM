// Bug report button (team area): a round button in the lower right corner opens a
// window to describe a problem and optionally add a screenshot; the edge function
// `bug-report` turns it into a GitHub issue.
//
// ── On / off ──────────────────────────────────────────────────────────────
// Shown only when the environment variable PUBLIC_BUG_REPORTS = "true"
// (portal/netlify.toml or Netlify → Environment variables). Set it to anything
// else, or remove it, and the button disappears; nothing else changes.
//
// ── Removing the feature completely ───────────────────────────────────────
//   1. delete this file and the <BugReport /> line in TeamShell.tsx
//   2. delete supabase/functions/bug-report and the function in Supabase
//      (Edge Functions → bug-report → Delete), remove the secret BUG_REPORT_GITHUB_TOKEN
//   3. add a migration with `drop table public.bug_reports;`
//   4. remove PUBLIC_BUG_REPORTS from portal/netlify.toml
import { useEffect, useState } from "preact/hooks";
import { supabase } from "../../lib/supabase";
import { Field, Modal, toast } from "../ui/Ui";

export const BUG_REPORTS_ON = import.meta.env.PUBLIC_BUG_REPORTS === "true";

const MAX_SIDE = 1600;          // screenshot is scaled down to this width/height
const MAX_BYTES = 2.5 * 1024 * 1024;

/** Image file → compressed JPEG data URL (PNG stays PNG when it's small, e.g. UI screenshots) */
async function compress(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error("This file isn't an image we can read.")); i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.7, 0.55]) {
      const data = c.toDataURL("image/jpeg", q);
      if (data.length * 0.75 <= MAX_BYTES) return data;
    }
    throw new Error("The screenshot is too large. Please crop it.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BugReport() {
  const [open, setOpen] = useState(false);
  if (!BUG_REPORTS_ON) return null;
  return (
    <>
      <button class="bug-fab" onClick={() => setOpen(true)} title="Report a problem" aria-label="Report a problem">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 9V7a4 4 0 0 1 8 0v2" /><rect x="6" y="9" width="12" height="11" rx="6" /><path d="M12 13v7M3 13h3M18 13h3M4 7l2.5 2.5M20 7l-2.5 2.5M4 20l2.5-2.5M20 20l-2.5-2.5" />
        </svg>
      </button>
      {open && <BugDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function BugDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const addFile = async (f?: File | null) => {
    if (!f) return;
    setError("");
    try { setImage(await compress(f)); } catch (e) { setError((e as Error).message); }
  };

  // Paste a screenshot straight from the clipboard (Cmd/Ctrl+V)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find(x => x.type.startsWith("image/"));
      if (f) { e.preventDefault(); addFile(f); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const send = async () => {
    setBusy(true); setError("");
    const { data, error: err } = await supabase.functions.invoke("bug-report", {
      body: {
        title, description: text, image,
        page: location.pathname + location.search,
        browser: `${navigator.userAgent.slice(0, 160)} · ${window.innerWidth}×${window.innerHeight}`,
      },
    });
    setBusy(false);
    if (err || !data?.ok) {
      const code = (data?.error ?? "") as string;
      setError(code === "too_many" ? "You've sent many reports in the last hour. Please try again later."
        : code === "not_configured" ? "Bug reports aren't set up yet (the GitHub key is missing in Supabase)."
        : "The report couldn't be sent. Please try again, or tell the IT team directly.");
      return;
    }
    setSent(data.url);
    toast("Thanks, your report was sent.");
  };

  if (sent) {
    return (
      <Modal title="Report sent" onClose={onClose}>
        <p>Thanks! Your report is now an issue on GitHub, where the IT team will look at it.</p>
        <p class="small"><a href={sent} target="_blank" rel="noopener">Open the issue on GitHub →</a></p>
        <div class="row" style="justify-content:flex-end"><button class="btn btn--primary" onClick={onClose}>Close</button></div>
      </Modal>
    );
  }

  return (
    <Modal title="Report a problem" onClose={onClose}>
      <Field label="Title" required help="A short summary, e.g. “SEPA export button does nothing”.">
        <input class="input" maxLength={100} value={title} autoFocus onInput={e => setTitle(e.currentTarget.value)} />
      </Field>
      <Field label="What went wrong?" required help="What did you do, what happened, and what did you expect instead?">
        <textarea class="input" rows={6} maxLength={5000} value={text}
          placeholder="e.g. On the Finance page, “Export SEPA file” does nothing when I click it."
          onInput={e => setText(e.currentTarget.value)} />
      </Field>
      <div class="stack-s">
        <span class="field__label">Screenshot (optional)</span>
        {image ? (
          <div class="bug-shot">
            <img src={image} alt="Screenshot to send" />
            <button class="btn btn--ghost btn--sm" onClick={() => setImage(null)}>Remove screenshot</button>
          </div>
        ) : (
          <label class="bug-drop">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => addFile(e.currentTarget.files?.[0])} />
            <span>Choose an image, or paste a screenshot with {/Mac/.test(navigator.platform) ? "⌘V" : "Ctrl+V"}</span>
          </label>
        )}
      </div>
      {error && <p class="small" role="alert" style="color:var(--p-red)">{error}</p>}
      <div class="row" style="justify-content:flex-end">
        <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button class="btn btn--primary" disabled={busy || title.trim().length < 3 || text.trim().length < 5} onClick={send}>{busy ? "Sending…" : "Send report"}</button>
      </div>
    </Modal>
  );
}
