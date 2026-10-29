// Landing page of the welcome / password email: redeems the one-time link,
// then the member sets a password and goes on to complete their profile.
import { useEffect, useState } from "preact/hooks";
import { currentMember, redeemMemberLink, setMemberPassword, type Member } from "../../lib/members";
import { Field } from "../ui/Ui";

export default function MembersWelcome() {
  const [me, setMe] = useState<Member | null | undefined>(undefined);
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
      history.replaceState(null, "", "/members/welcome");
      try {
        const m = token ? await redeemMemberLink(token, type) : await currentMember();
        if (!m) throw new Error("This link is not valid, or your account is not part of the OneAIM network.");
        setMe(m);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setMe(null);
      }
    })();
  }, []);

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    try {
      await setMemberPassword(pw);
      window.location.href = kind === "invite" ? "/members/me?welcome=1" : "/members";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div class="login">
      <div class="login__art">
        <p class="overline" style="color:#D9B8FF">OneAIM Network</p>
        <h2>{kind === "invite" ? "Welcome to the OneAIM network." : "Set a new password."}</h2>
        <p>A community of participants, team members, alumni and partners who want to shape the future of healthcare.</p>
      </div>
      <div class="login__panel">
        {me === undefined && <div class="loading" role="status" aria-label="Loading"><span /></div>}
        {me === null && (
          <div class="login__form">
            <img src="/logo.png" alt="OneAIM" />
            <h1>Link not valid</h1>
            <p class="field__error" style="font-size:15px">{error}</p>
            <a class="btn btn--primary btn--block" href="/members/login">Go to the login</a>
          </div>
        )}
        {me && (
          <form class="login__form" onSubmit={submit}>
            <img src="/logo.png" alt="OneAIM" />
            <div class="stack-s">
              <h1>{kind === "invite" ? `Congratulations, ${me.name.split(" ")[0]}!` : "New password"}</h1>
              <p class="muted">Choose a password for the OneAIM network. You log in with <strong>{me.email}</strong>.</p>
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
