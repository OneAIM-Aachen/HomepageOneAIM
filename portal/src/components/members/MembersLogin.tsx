import { useEffect, useState } from "preact/hooks";
import { currentMember, memberLogin, requestMemberLink } from "../../lib/members";
import { Field } from "../ui/Ui";

export default function MembersLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const next = () => {
    const n = new URLSearchParams(location.search).get("next");
    return n && n.startsWith("/members") ? n : "/members";
  };
  useEffect(() => { currentMember().then(m => { if (m) window.location.replace(next()); }); }, []);

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await memberLogin(email, password);
      window.location.href = next();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const link = async (e: Event) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email first."); return; }
    try {
      await requestMemberLink(email);
      setInfo("If this email belongs to a member of the OneAIM network, a login link is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div class="login">
      <div class="login__art">
        <p class="overline" style="color:#D9B8FF">OneAIM Network</p>
        <h2>Our community of participants, team and alumni.</h2>
        <p>Find other members, see who studies what and where, and get in touch.</p>
      </div>
      <div class="login__panel">
        <form class="login__form" onSubmit={submit}>
          <img src="/logo.png" alt="OneAIM" />
          <div class="stack-s">
            <h1>Log in</h1>
            <p class="muted">OneAIM network</p>
          </div>
          <Field label="Email">
            <input class="input" type="email" autoComplete="username" required value={email}
              onInput={e => { setEmail(e.currentTarget.value); setError(""); }} />
          </Field>
          <Field label="Password" error={error}>
            <input class={`input ${error ? "input--invalid" : ""}`} type="password" autoComplete="current-password" required
              value={password} onInput={e => { setPassword(e.currentTarget.value); setError(""); }} />
          </Field>
          <button class="btn btn--primary btn--lg btn--block" type="submit" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
          <a class="small" href="#" onClick={link}>First time here or forgot your password?</a>
          {info && <div class="demo-hint">{info}</div>}
        </form>
      </div>
    </div>
  );
}
