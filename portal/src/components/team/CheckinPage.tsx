// Answer page of the yearly "still active?" email (no login needed; the
// token in the link identifies the member and works once).
import { useEffect, useState } from "preact/hooks";
import { answerCheckin, getCheckin } from "../../lib/store";

export default function CheckinPage() {
  const [token] = useState(() => new URLSearchParams(location.search).get("t") ?? "");
  const [info, setInfo] = useState<{ name: string; city: string } | null | undefined>(undefined);
  const [done, setDone] = useState<"active" | "alumni" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!/^[0-9a-f-]{36}$/i.test(token)) { setInfo(null); return; }
    getCheckin(token).then(setInfo).catch(() => setInfo(null));
  }, []);

  const answer = async (yes: boolean) => {
    setBusy(true);
    try {
      setDone(await answerCheckin(token, yes));
    } catch {
      setError("This link was already used or is no longer valid.");
    }
    setBusy(false);
  };

  return (
    <div class="login">
      <div class="login__art">
        <p class="overline" style="color:#D9B8FF">OneAIM Team</p>
        <h2>Once a year we ask who is still on board.</h2>
        <p>So the organigram stays up to date. Former members become OneAIM alumni and stay part of our network.</p>
      </div>
      <div class="login__panel">
        <div class="login__form">
          <img src="/logo.png" alt="OneAIM" />
          {info === undefined && <div class="loading" role="status" aria-label="Loading"><span /></div>}
          {info === null && !done && (
            <>
              <h1>Link not valid</h1>
              <p class="muted">This link was already used or has expired. If something's wrong, just write to your city team.</p>
            </>
          )}
          {info && !done && (
            <>
              <div class="stack-s">
                <h1>Hi {info.name}!</h1>
                <p class="muted">Are you still an active part of OneAIM {info.city}?</p>
              </div>
              <button class="btn btn--primary btn--lg btn--block" disabled={busy} onClick={() => answer(true)}>Yes, I'm still active</button>
              <button class="btn btn--secondary btn--lg btn--block" disabled={busy} onClick={() => answer(false)}>No, I've left the team</button>
              {error && <p class="field__error">{error}</p>}
            </>
          )}
          {done === "active" && (
            <>
              <h1>Thanks!</h1>
              <p class="muted">Great to have you on the team. We'll ask again in a year.</p>
              <a class="btn btn--secondary btn--block" href="/team">Go to the team portal</a>
            </>
          )}
          {done === "alumni" && (
            <>
              <h1>Thank you for everything!</h1>
              <p class="muted">You're now part of the OneAIM alumni. Your positions stay in our history, and you stay in our network. If this was a mistake, write to your city team.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
