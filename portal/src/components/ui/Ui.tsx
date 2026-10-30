// Small shared UI pieces for team and apply.
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { SubmissionStatus } from "../../lib/types";
import { PHASE_LABEL, STATUS_LABEL, initials, type AppPhase } from "../../lib/fields";
import { IconX } from "./Icons";

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  new: "chip--blue", invited: "chip--purple", accepted: "chip--green", rejected: "chip--red", confirmed: "chip--green",
};

export function StatusChip({ status }: { status: SubmissionStatus }) {
  return <span class={`chip chip--dot ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

const PHASE_CLASS: Record<AppPhase, string> = {
  draft: "chip--gray", upcoming: "chip--amber", open: "chip--green", closed: "chip--gray",
};

export function PhaseChip({ phase }: { phase: AppPhase }) {
  return <span class={`chip chip--dot ${PHASE_CLASS[phase]}`}>{PHASE_LABEL[phase]}</span>;
}

export function Avatar({ name, large, src }: { name: string; large?: boolean; src?: string }) {
  // A photo that doesn't load falls back to the initials
  const [broken, setBroken] = useState(false);
  if (src && !broken) return <img class={`avatar ${large ? "avatar--lg" : ""}`} src={src} alt="" onError={() => setBroken(true)} />;
  return <span class={`avatar ${large ? "avatar--lg" : ""}`} aria-hidden="true">{initials(name)}</span>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <>
      <div class="overlay" onClick={onClose} />
      <div class={`modal ${wide ? "modal--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div class="row row--between">
          <h2>{title}</h2>
          <button class="icon-btn" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        {children}
      </div>
    </>
  );
}

export function Drawer({ onClose, head, children, foot }: {
  onClose: () => void; head: ComponentChildren; children: ComponentChildren; foot?: ComponentChildren;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <>
      <div class="overlay" onClick={onClose} />
      <div class="drawer" role="dialog" aria-modal="true">
        <div class="drawer__head">
          <div style="flex:1;min-width:0">{head}</div>
          <button class="icon-btn" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div class="drawer__body">{children}</div>
        {foot && <div class="drawer__foot">{foot}</div>}
      </div>
    </>
  );
}

// Toast: call toast("…") from anywhere, <Toaster/> renders it.
let pushToast: ((t: string) => void) | null = null;
export function toast(text: string) { pushToast?.(text); }

export function Toaster() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    pushToast = t => { setText(t); clearTimeout(timer); timer = window.setTimeout(() => setText(null), 3200); };
    return () => { pushToast = null; clearTimeout(timer); };
  }, []);
  return text ? <div class="toast" role="status">{text}</div> : null;
}

export function Field({ label, required, help, helpBelow, error, children }: {
  label: string; required?: boolean; help?: string; error?: string; children: ComponentChildren;
  /** Show the help text under the input instead of above it */
  helpBelow?: boolean;
}) {
  return (
    <label class="field">
      <span class="field__label">{label}{required && <span class="req">*</span>}</span>
      {help && !helpBelow && <span class="field__help">{help}</span>}
      {children}
      {help && helpBelow && <span class="field__help">{help}</span>}
      {error && <span class="field__error">{error}</span>}
    </label>
  );
}

/** Query-string parameter, read once on mount (pages are static). */
export function useParam(name: string): string | null {
  const [v] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(name)));
  return v;
}

/** Runs an async action; shows the success text or the error as a toast. */
export async function act<T>(fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> {
  try {
    const r = await fn();
    if (success) toast(typeof success === "function" ? success(r) : success);
    return r;
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e));
    return undefined;
  }
}

// Confirmation popup (replaces window.confirm, which embedded browsers
// silently block). Usage: if (await confirmDialog({ … })) { … }
interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}
let pushConfirm: ((o: ConfirmOptions, resolve: (ok: boolean) => void) => void) | null = null;

export function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    if (pushConfirm) pushConfirm(o, resolve);
    else resolve(window.confirm(`${o.title}\n\n${o.message}`));
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<{ o: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  useEffect(() => {
    pushConfirm = (o, resolve) => setReq({ o, resolve });
    return () => { pushConfirm = null; };
  }, []);
  if (!req) return null;
  const close = (ok: boolean) => { req.resolve(ok); setReq(null); };
  return (
    <Modal title={req.o.title} onClose={() => close(false)}>
      <p style="white-space:pre-wrap">{req.o.message}</p>
      <div class="row" style="justify-content:flex-end">
        <button class="btn btn--ghost" onClick={() => close(false)}>Cancel</button>
        <button class={`btn ${req.o.danger ? "btn--danger-solid" : "btn--primary"}`} autoFocus onClick={() => close(true)}>
          {req.o.confirmLabel ?? "Confirm"}
        </button>
      </div>
    </Modal>
  );
}
