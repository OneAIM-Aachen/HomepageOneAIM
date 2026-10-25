import { useEffect, useState } from "preact/hooks";
import { currentAccount, login } from "../../lib/store";
import { supabase } from "../../lib/supabase";
import { Field } from "../ui/Ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const next = () => {
    const n = new URLSearchParams(location.search).get("next");
    return n && n.startsWith("/team") ? n : "/team";
  };

  useEffect(() => { currentAccount().then(a => { if (a) window.location.replace(next()); }); }, []);

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      window.location.href = next();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const reset = async (e: Event) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your city account's email first."); return; }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/team/settings` });
    if (err) setError(err.message);
    else setInfo("If this is a team account, a reset link is on its way.");
  };

  return (
    <div class="login">
      <div class="login__art">
        <p class="overline" style="color:#D9B8FF">OneAIM Team</p>
        <h2>Applications, interviews and our network, in one place.</h2>
        <p>Internal tools for the OneAIM city teams. Sign in with your city account.</p>
      </div>
      <div class="login__panel">
        <form class="login__form" onSubmit={submit}>
          <img src="/logo.png" alt="OneAIM" />
          <div class="stack-s">
            <h1>Sign in</h1>
            <p class="muted">team.one-aim.org</p>
          </div>
          <Field label="Email">
            <input class="input" type="email" autoComplete="username" required value={email}
              onInput={e => { setEmail(e.currentTarget.value); setError(""); }} />
          </Field>
          <Field label="Password" error={error}>
            <input class={`input ${error ? "input--invalid" : ""}`} type="password" autoComplete="current-password" required
              value={password} onInput={e => { setPassword(e.currentTarget.value); setError(""); }} />
          </Field>
          <button class="btn btn--primary btn--lg btn--block" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <a class="small" href="#" onClick={reset}>Forgot password?</a>
          {info && <div class="demo-hint">{info}</div>}
        </form>
      </div>
    </div>
  );
}
