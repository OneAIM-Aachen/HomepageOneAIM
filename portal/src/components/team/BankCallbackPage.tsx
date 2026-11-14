// Return page after the bank login (Enable Banking redirects here with
// ?code&state, or ?error). Finishes the connection and goes back to Finance.
import { useEffect, useState } from "preact/hooks";
import { finishBankLogin } from "../../lib/bank";
import { TeamShell } from "./TeamShell";
import { useParam } from "../ui/Ui";

export default function BankCallbackPage() {
  return <TeamShell active="finance">{() => <Finish />}</TeamShell>;
}

function Finish() {
  const code = useParam("code"), state = useParam("state"), error = useParam("error"), errorDescription = useParam("error_description");
  const [result, setResult] = useState<{ ok: boolean; text: string; city?: string } | null>(null);
  useEffect(() => {
    finishBankLogin({ code, state, error, error_description: errorDescription })
      .then(r => setResult({ ok: true, city: r.location_id, text: `Connected: ${r.accounts} account${r.accounts === 1 ? "" : "s"}. The first transactions were fetched.` }))
      .catch(e => setResult({ ok: false, text: e instanceof Error ? e.message : String(e) }));
  }, []);
  if (!result) return <div class="empty" style="margin:48px auto;max-width:520px">Finishing the connection with the bank…</div>;
  return (
    <div class="empty stack-s" style="margin:48px auto;max-width:520px">
      <strong>{result.ok ? "Bank account connected" : "Connecting didn't work"}</strong>
      <span>{result.text}</span>
      <a class="btn btn--primary" style="align-self:center" href={`/team/finance?tab=bank${result.city ? `&city=${result.city}` : ""}`}>Back to Finance</a>
    </div>
  );
}
