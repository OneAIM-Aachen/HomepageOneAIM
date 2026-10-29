// Landing page of the invitation / "forgot password" emails: redeems the
// one-time link, then lets the member set their password.
import { useEffect, useState } from "preact/hooks";
import type { Account } from "../../lib/types";
import { changePassword, currentAccount, redeemLink } from "../../lib/store";
import { Field } from "../ui/Ui";

export default function WelcomePage() {
  const [acc, setAcc] = useState<Account | null | undefined>(undefined);
  const [kind, setKind] = useState<"invite" | "recovery">("invite");
  const [error, setError] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const q = new URLSearchParams(location.search);
      const token = q.get("token_hash");
      const type = q.get("type") === "recovery" ? "recovery" : "invite";
      setKind(type);
      // The token works once: take it out of the address bar right away
      history.replaceState(null, "", "/team/welcome");
      try {
        const a = token ? await redeemLink(token, type) : await currentAccount();
        if (!a) throw new Error("This link is not valid. Use “Forgot password?” on the login page to get a new one.");
        setAcc(a);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setAcc(null);
      }
    })();
  }, []);

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    try {
      await changePassword(pw);
      // New members land on their profile to fill it in
      window.location.href = kind === "invite" && acc?.memberId ? `/team/team?member=${acc.memberId}` : "/team";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div class="login">
      <div class="login__art">
        <p class="overline" style="color:#D9B8FF">OneAIM Team</p>
        <h2>{kind === "invite" ? "Welcome to the team." : "Set a new password."}</h2>
        <p>Your own account for applications, interviews, our network and the team overview.</p>
      </div>
      <div class="login__panel">
        {acc === undefined && <div class="loading" role="status" aria-label="Loading"><span /></div>}
        {acc === null && (
          <div class="login__form">
            <img src="/logo.png" alt="OneAIM" />
            <h1>Link not valid</h1>
            <p class="field__error" style="font-size:15px">{error}</p>
            <a class="btn btn--primary btn--block" href="/team/login">Go to the login</a>
          </div>
        )}
        {acc && (
          <form class="login__form" onSubmit={submit}>
            <img src="/logo.png" alt="OneAIM" />
            <div class="stack-s">
              <h1>{kind === "invite" ? `Hi ${acc.name.split(" ")[0]}!` : "New password"}</h1>
              <p class="muted">{kind === "invite" ? "Choose a password for your team account." : "Choose a new password for your team account."} You sign in with <strong>{acc.email}</strong>.</p>
            </div>
            <Field label="Password" help="At least 10 characters.">
              <input class="input" type="password" autoComplete="new-password" required value={pw} onInput={e => { setPw(e.currentTarget.value); setError(""); }} />
            </Field>
            <Field label="Repeat password" error={error || (pw2 && pw !== pw2 ? "Passwords don't match." : undefined)}>
              <input class="input" type="password" autoComplete="new-password" required value={pw2} onInput={e => { setPw2(e.currentTarget.value); setError(""); }} />
            </Field>
            <button class="btn btn--primary btn--lg btn--block" disabled={busy || pw.length < 10 || pw !== pw2}>{busy ? "Saving…" : "Save password and continue"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
