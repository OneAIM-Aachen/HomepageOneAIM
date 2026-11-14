// Finance – CLICKABLE MOCKUP. Made-up data that lives only in this browser
// tab; nothing is saved and no money is moved. Shows how reimbursements,
// the city bank accounts, the cash book and the year-end package could work.
import { useMemo, useState } from "preact/hooks";
import type { Account, TeamMember } from "../../lib/types";
import { useStore } from "../../lib/store";
import { appTitle, fmtDate } from "../../lib/fields";
import { isDemo } from "../../lib/demo";
import { TeamShell, PageHead } from "./TeamShell";
import { confirmDialog, Field, Modal, toast } from "../ui/Ui";
import { IconCheck, IconDownload, IconFile, IconPlus } from "../ui/Icons";

// ── Mock data model ──────────────────────────────────────────────────────

type ClaimStatus = "submitted" | "question" | "approved" | "paid" | "rejected";
interface Claim {
  id: string; who: string; city: string; amount: number; date: string; what: string; project: string;
  category: string; receipt: Receipt; status: ClaimStatus; note?: string; iban: string; submittedAt: string; paidAt?: string;
}
interface Receipt { name: string; url?: string }
type TxKind = "card" | "transfer" | "debit" | "income";
interface Tx {
  id: string; city: string; date: string; counterparty: string; purpose: string; amount: number; kind: TxKind;
  receipt?: Receipt; category?: string; project?: string; claimId?: string; requestedFrom?: string;
}

/** Categories and the tax area they are suggested for (to be confirmed with a tax advisor) */
const CATEGORIES: Record<string, { area: Area; income?: boolean }> = {
  "Participation fees": { area: "Zweckbetrieb", income: true },
  "Donations": { area: "Ideeller Bereich", income: true },
  "Membership fees": { area: "Ideeller Bereich", income: true },
  "Sponsoring": { area: "Wirtschaftlicher Geschäftsbetrieb", income: true },
  "Interest": { area: "Vermögensverwaltung", income: true },
  "Food & drinks": { area: "Zweckbetrieb" },
  "Room rent": { area: "Zweckbetrieb" },
  "Travel": { area: "Zweckbetrieb" },
  "Printing & marketing": { area: "Ideeller Bereich" },
  "Software & tools": { area: "Ideeller Bereich" },
  "Bank fees": { area: "Ideeller Bereich" },
  "Merchandise": { area: "Wirtschaftlicher Geschäftsbetrieb" },
};
type Area = "Ideeller Bereich" | "Vermögensverwaltung" | "Zweckbetrieb" | "Wirtschaftlicher Geschäftsbetrieb";
const AREAS: [Area, string][] = [
  ["Ideeller Bereich", "Non-profit core: donations, membership fees, general costs"],
  ["Vermögensverwaltung", "Asset management: interest"],
  ["Zweckbetrieb", "Purpose-related operations: programs and their fees"],
  ["Wirtschaftlicher Geschäftsbetrieb", "Commercial activities: e.g. some sponsoring, merchandise"],
];
const EXPENSE_CATS = Object.keys(CATEGORIES).filter(c => !CATEGORIES[c]!.income);
const CLAIM_LABEL: Record<ClaimStatus, [string, string]> = {
  submitted: ["Submitted", "chip--blue"], question: ["Question", "chip--amber"], approved: ["Approved", "chip--purple"],
  paid: ["Paid", "chip--green"], rejected: ["Rejected", "chip--red"],
};
const KIND_LABEL: Record<TxKind, string> = { card: "Card payment", transfer: "Transfer", debit: "Direct debit", income: "Incoming" };
const CITIES = ["Aachen", "Munich", "Frankfurt"];
/** Each city has its own, independent bank account (balance before the mock transactions; 0 without demo data) */
const MOCK_OPENING: Record<string, number> = { Aachen: 2480.55, Munich: 1320.1, Frankfurt: 640 };
const openingBalance = (city: string) => (isDemo() ? MOCK_OPENING[city] ?? 0 : 0);

/** Who may approve claims of a city: the head of Finance & Legal and the presidents of that city */
function approversOf(team: TeamMember[], departments: { id: string; name: string }[], city: string) {
  const finance = new Set(departments.filter(d => /finance/i.test(d.name)).map(d => d.id));
  return team.filter(m => m.status === "active" && m.city === city
    && (m.role === "president" || m.role === "co_president" || (m.role === "lead" && m.departmentId && finance.has(m.departmentId))));
}

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const money = (n: number) => eur.format(n);
const maskIban = (iban: string) => `${iban.slice(0, 4)} •••• •••• ${iban.replace(/\s/g, "").slice(-4)}`;
let seq = 100;
const nextId = (p: string) => `${p}${++seq}`;

/** Made-up claims and transactions; empty when demo data is switched off (not connected to the database yet) */
function initialData(me: string): { claims: Claim[]; txs: Tx[] } {
  if (!isDemo()) return { claims: [], txs: [] };
  const claims: Claim[] = [
    { id: "c1", who: me, city: "Aachen", amount: 48.6, date: "2026-11-06", what: "Pizza for the interview day", project: "AIM Connect Aachen – SS 27", category: "Food & drinks", receipt: { name: "pizza-hut-receipt.jpg" }, status: "paid", iban: "DE89370400440532013000", submittedAt: "2026-11-06", paidAt: "2026-11-09" },
    { id: "c2", who: me, city: "Aachen", amount: 23.9, date: "2026-11-11", what: "Name badges and markers", project: "General", category: "Printing & marketing", receipt: { name: "staples-2026-11-11.pdf" }, status: "submitted", iban: "DE89370400440532013000", submittedAt: "2026-11-11" },
    { id: "c3", who: "Eric Hölpes", city: "Aachen", amount: 112.4, date: "2026-11-08", what: "Train tickets Aachen–Cologne, company visit (2 people)", project: "AIM Connect Aachen – SS 27", category: "Travel", receipt: { name: "db-ticket.pdf" }, status: "submitted", iban: "DE12500105170648489890", submittedAt: "2026-11-10" },
    { id: "c4", who: "Maren Raab", city: "Munich", amount: 35.0, date: "2026-11-02", what: "Coffee and snacks, info evening", project: "General", category: "Food & drinks", receipt: { name: "IMG_2231.jpg" }, status: "question", note: "The receipt shows 53,00 € – which is right?", iban: "DE02120300000000202051", submittedAt: "2026-11-03" },
    { id: "c5", who: "Nick Breit", city: "Munich", amount: 19.99, date: "2026-10-28", what: "Canva Pro, 1 month", project: "General", category: "Software & tools", receipt: { name: "canva-invoice-oct.pdf" }, status: "approved", iban: "DE02100500000054540402", submittedAt: "2026-10-29" },
    { id: "c6", who: "Paul Rössler", city: "Frankfurt", amount: 64.2, date: "2026-11-05", what: "Drinks for the kick-off", project: "AIM Connect Frankfurt – SS 28", category: "Food & drinks", receipt: { name: "rewe-bon.jpg" }, status: "approved", iban: "DE02300209000106531065", submittedAt: "2026-11-06" },
  ];
  const txs: Tx[] = [
    { id: "t1", city: "Aachen", date: "2026-11-12", counterparty: "Raumbuchung RWTH", purpose: "Rechnung 2026-4471 Seminarraum", amount: -150, kind: "transfer", receipt: { name: "rwth-rechnung-4471.pdf" }, category: "Room rent", project: "AIM Connect Aachen – SS 27" },
    { id: "t2", city: "Aachen", date: "2026-11-10", counterparty: "AMAZON EU S.A R.L.", purpose: "Kartenzahlung Visa Debit", amount: -37.98, kind: "card", requestedFrom: "Eric Hölpes" },
    { id: "t3", city: "Aachen", date: "2026-11-09", counterparty: me, purpose: "Auslagenerstattung Pizza Interviewtag", amount: -48.6, kind: "transfer", claimId: "c1", receipt: { name: "pizza-hut-receipt.jpg" }, category: "Food & drinks", project: "AIM Connect Aachen – SS 27" },
    { id: "t4", city: "Aachen", date: "2026-11-07", counterparty: "Mia Schulz", purpose: "Teilnahmegebuehr AIM Connect SS27", amount: 50, kind: "income", category: "Participation fees", project: "AIM Connect Aachen – SS 27" },
    { id: "t5", city: "Aachen", date: "2026-11-07", counterparty: "Jonas Weber", purpose: "Teilnahmebeitrag Connect", amount: 50, kind: "income" },
    { id: "t6", city: "Aachen", date: "2026-11-03", counterparty: "Medtech GmbH", purpose: "Sponsoring AIM Connect WS26/27 lt. Vertrag", amount: 1500, kind: "income", receipt: { name: "sponsoring-vertrag-medtech.pdf" }, category: "Sponsoring" },
    { id: "t7", city: "Aachen", date: "2026-11-01", counterparty: "Sparkasse Aachen", purpose: "Kontofuehrung 10/2026", amount: -6.9, kind: "debit", receipt: { name: "kontoauszug-10-2026.pdf" }, category: "Bank fees" },
    { id: "t8", city: "Aachen", date: "2026-10-30", counterparty: "CANVA* 104588", purpose: "Kartenzahlung", amount: -11.99, kind: "card" },
    { id: "t9", city: "Munich", date: "2026-11-08", counterparty: "Edeka München", purpose: "Kartenzahlung", amount: -82.15, kind: "card", requestedFrom: "Maren Raab" },
    { id: "t10", city: "Munich", date: "2026-11-04", counterparty: "TUM Raumvergabe", purpose: "Miete Hörsaal Infoabend", amount: -90, kind: "transfer", receipt: { name: "tum-raum.pdf" }, category: "Room rent" },
    { id: "t11", city: "Munich", date: "2026-11-01", counterparty: "Spende Familie Huber", purpose: "Spende OneAIM", amount: 200, kind: "income", category: "Donations" },
    { id: "t12", city: "Frankfurt", date: "2026-11-06", counterparty: "Flyeralarm", purpose: "Rechnung 99812 Flyer", amount: -54.3, kind: "transfer", receipt: { name: "flyeralarm-99812.pdf" }, category: "Printing & marketing", project: "AIM Connect Frankfurt – SS 28" },
  ];
  return { claims, txs };
}

// ── Page ─────────────────────────────────────────────────────────────────

type Tab = "mine" | "overview" | "inbox" | "bank" | "book" | "year";

export default function FinancePage() {
  return <TeamShell active="finance">{acc => <Finance acc={acc} />}</TeamShell>;
}

function Finance({ acc }: { acc: Account }) {
  const me = acc.name;
  const [data, setData] = useState(() => initialData(me));
  const [tab, setTab] = useState<Tab>("mine");
  const [city, setCity] = useState(CITIES.includes(acc.city) ? acc.city : "Aachen");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const setClaims = (f: (c: Claim[]) => Claim[]) => setData(d => ({ ...d, claims: f(d.claims) }));
  const setTxs = (f: (t: Tx[]) => Tx[]) => setData(d => ({ ...d, txs: f(d.txs) }));

  const toCheck = data.claims.filter(c => c.city === city && c.status === "submitted").length;
  const missing = data.txs.filter(t => t.city === city && !t.receipt && t.kind !== "income").length;
  const tabs: [Tab, string, number?, boolean?][] = [
    ["mine", "My claims", data.claims.filter(c => c.city === city && c.who === me && c.status !== "paid" && c.status !== "rejected").length || undefined],
    ["overview", "Money in & out", undefined, true],
    ["inbox", "Claims to approve", toCheck || undefined, true],
    ["bank", "Bank account", missing || undefined, true],
    ["book", "Cash book", undefined, true],
    ["year", "Year-end & tax", undefined, true],
  ];

  return (
    <div class="stack" style="gap:18px">
      <PageHead overline="Finance" title={`Finance · OneAIM ${city}`}
        sub="Get money back for things you paid, keep a receipt for every payment of the city account, and have everything ready for the tax return." />
      <div class="demo-banner" role="status">
        {isDemo()
          ? <><strong>Mockup with made-up data.</strong> Click through freely: nothing is saved, no emails are sent and no money is moved. Reloading the page resets it.</>
          : <><strong>Demo data is off.</strong> Finance isn't connected to the database and the bank yet, so there's no real data here. Switch on “Demo data” in the sidebar to see the mockup.</>}
      </div>
      <div class="city-switch-row">
        <div class="city-switch" role="group" aria-label="City">
          {CITIES.map(c => (
            <button class={city === c ? "is-active" : ""} aria-pressed={city === c} onClick={() => setCity(c)}>
              OneAIM {c}
              {data.claims.some(x => x.city === c && x.status === "submitted") && <span class="city-switch__dot" title="Claims to approve" />}
            </button>
          ))}
        </div>
        <span class="muted small" style="flex:1">Each city has its own bank account and its own books. Everything below is for {city} only.</span>
        {(tab === "overview" || tab === "book" || tab === "year") && (
          <label class="row small" style="gap:6px">
            <span class="muted">Year</span>
            <select class="input input--sm" style="width:auto" value={year} onChange={e => setYear(e.currentTarget.value)} aria-label="Calendar year">
              {["2026", "2025"].map(y => <option>{y}</option>)}
            </select>
          </label>
        )}
      </div>
      <nav class="tabs" role="tablist">
        {tabs.map(([k, label, n, finance]) => (
          <button role="tab" aria-selected={tab === k} class={`tab ${tab === k ? "is-active" : ""}`} onClick={() => setTab(k)}>
            {label}{n !== undefined && <span class="count">{n}</span>}
            {finance && <span class="muted small" style="font-weight:600;margin-left:6px">· finance</span>}
          </button>
        ))}
      </nav>
      {tab === "mine" && <MyClaims me={me} city={city} claims={data.claims.filter(c => c.who === me && c.city === city)} setClaims={setClaims} />}
      {tab === "overview" && <Overview city={city} year={year} txs={data.txs} />}
      {tab === "inbox" && <Inbox me={me} memberId={acc.memberId} city={city} claims={data.claims.filter(c => c.city === city)} setClaims={setClaims} setTxs={setTxs} />}
      {tab === "bank" && <Bank city={city} txs={data.txs} claims={data.claims} setTxs={setTxs} />}
      {tab === "book" && <Book city={city} year={year} txs={data.txs.filter(t => t.city === city && t.date.startsWith(year))} />}
      {tab === "year" && <YearEnd city={city} year={year} txs={data.txs.filter(t => t.city === city && t.date.startsWith(year))} claims={data.claims.filter(c => c.city === city && c.date.startsWith(year))} onGo={setTab} />}
    </div>
  );
}

function ReceiptView({ r }: { r?: Receipt }) {
  if (!r) return <div class="receipt receipt--missing">No receipt yet</div>;
  return r.url
    ? <img class="receipt" src={r.url} alt={r.name} />
    : <div class="receipt"><IconFile width={28} /><strong>{r.name}</strong><span class="muted small">Preview of the receipt</span></div>;
}

// ── My claims (every team member) ────────────────────────────────────────

function MyClaims({ me, city, claims, setClaims }: { me: string; city: string; claims: Claim[]; setClaims: (f: (c: Claim[]) => Claim[]) => void }) {
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const opened = claims.find(c => c.id === open);
  const outstanding = claims.filter(c => c.status !== "paid" && c.status !== "rejected").reduce((s, c) => s + c.amount, 0);
  return (
    <div class="stack">
      <div class="row">
        <p class="muted small" style="flex:1;margin:0">Paid something for OneAIM {city} yourself? Upload the receipt and get the money back from the {city} account, usually within a week. <strong>{money(outstanding)}</strong> waiting for you right now.</p>
        <button class="btn btn--primary" onClick={() => setCreating(true)}><IconPlus width={18} />Get money back</button>
      </div>
      <div class="card card--flush">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>What</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {claims.map(c => (
                <tr class="is-clickable" onClick={() => setOpen(c.id)}>
                  <td><strong style="color:var(--color-text-heading)">{c.what}</strong><br /><span class="muted small">{c.project} · {c.category}</span></td>
                  <td class="muted">{fmtDate(c.date)}</td>
                  <td><strong>{money(c.amount)}</strong></td>
                  <td><span class={`chip ${CLAIM_LABEL[c.status][1]}`}>{CLAIM_LABEL[c.status][0]}</span>{c.paidAt && <span class="muted small"> {fmtDate(c.paidAt)}</span>}</td>
                </tr>
              ))}
              {!claims.length && <tr><td colSpan={4} class="muted">No claims yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p class="muted small">You get an email when your claim is approved, has a question, or is paid.</p>
      {creating && <NewClaim me={me} city={city} onClose={() => setCreating(false)}
        onSubmit={c => { setClaims(l => [c, ...l]); setCreating(false); toast("Claim submitted. The finance team has been notified (mockup)."); }} />}
      {opened && (
        <Modal title={opened.what} onClose={() => setOpen(null)} wide>
          <div class="grid-2" style="align-items:start">
            <ReceiptView r={opened.receipt} />
            <dl class="qa">
              <div><dt>Status</dt><dd><span class={`chip ${CLAIM_LABEL[opened.status][1]}`}>{CLAIM_LABEL[opened.status][0]}</span></dd></div>
              {opened.note && <div><dt>Question from finance</dt><dd>{opened.note}</dd></div>}
              <div><dt>Amount</dt><dd>{money(opened.amount)}</dd></div>
              <div><dt>Paid on</dt><dd>{fmtDate(opened.date)}</dd></div>
              <div><dt>For</dt><dd>{opened.project} · {opened.category}</dd></div>
              <div><dt>To account</dt><dd>{maskIban(opened.iban)}</dd></div>
            </dl>
          </div>
          {opened.status === "question" && (
            <div class="row" style="justify-content:flex-end">
              <button class="btn btn--primary" onClick={() => { setClaims(l => l.map(c => c.id === opened.id ? { ...c, status: "submitted", note: undefined } : c)); setOpen(null); toast("Answer sent"); }}>Answer & resubmit</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function NewClaim({ me, city, onClose, onSubmit }: { me: string; city: string; onClose: () => void; onSubmit: (c: Claim) => void }) {
  const apps = useStore(s => s.applications.filter(a => a.tags.location === city).slice(0, 6));
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [what, setWhat] = useState("");
  const [project, setProject] = useState("General");
  const [category, setCategory] = useState(EXPENSE_CATS[0]!);
  const [iban, setIban] = useState("DE89 3704 0044 0532 0130 00");
  const value = Number(amount.replace(",", "."));
  const valid = receipt && value > 0 && date && what.trim() && iban.replace(/\s/g, "").length >= 15;
  return (
    <Modal title="Get money back" onClose={onClose} wide>
      <div class="grid-2" style="align-items:start">
        <label class="receipt receipt--drop">
          <input type="file" accept="image/*,application/pdf" capture="environment" style="display:none"
            onChange={e => { const f = e.currentTarget.files?.[0]; if (f) setReceipt({ name: f.name, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined }); }} />
          {receipt ? (receipt.url ? <img src={receipt.url} alt={receipt.name} style="max-width:100%;border-radius:10px" /> : <><IconFile width={28} /><strong>{receipt.name}</strong></>)
            : <><IconPlus width={28} /><strong>Photo or PDF of the receipt</strong><span class="muted small">On the phone this opens the camera</span></>}
        </label>
        <div class="stack-s">
          <div class="grid-2">
            <Field label="Amount (€)" required><input class="input" inputMode="decimal" placeholder="23,90" value={amount} onInput={e => setAmount(e.currentTarget.value)} /></Field>
            <Field label="Paid on" required><input class="input" type="date" value={date} onInput={e => setDate(e.currentTarget.value)} /></Field>
          </div>
          <Field label="What was it for?" required><input class="input" placeholder="e.g. Pizza for the interview day" value={what} onInput={e => setWhat(e.currentTarget.value)} /></Field>
          <div class="grid-2">
            <Field label="Belongs to">
              <select class="input" value={project} onChange={e => setProject(e.currentTarget.value)}>
                <option>General</option>
                {apps.map(a => <option>{appTitle(a)}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select class="input" value={category} onChange={e => setCategory(e.currentTarget.value)}>{EXPENSE_CATS.map(c => <option>{c}</option>)}</select>
            </Field>
          </div>
          <Field label="Pay it to (IBAN)" help="Saved on your profile after the first time. Only the finance team can see it.">
            <input class="input mono" value={iban} onInput={e => setIban(e.currentTarget.value)} />
          </Field>
        </div>
      </div>
      <p class="muted small">Paid with the city's bank card instead? Then don't submit a claim: the payment shows up under “City bank accounts”, where you add the receipt.</p>
      <div class="row" style="justify-content:flex-end">
        <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button class="btn btn--primary" disabled={!valid} onClick={() => onSubmit({
          id: nextId("c"), who: me, city, amount: value, date, what, project, category, receipt: receipt!, status: "submitted",
          iban: iban.replace(/\s/g, ""), submittedAt: new Date().toISOString().slice(0, 10),
        })}>Submit claim</button>
      </div>
    </Modal>
  );
}

// ── Finance inbox ────────────────────────────────────────────────────────

function Inbox({ me, memberId, city, claims, setClaims, setTxs }: {
  me: string; memberId?: string; city: string; claims: Claim[]; setClaims: (f: (c: Claim[]) => Claim[]) => void; setTxs: (f: (t: Tx[]) => Tx[]) => void;
}) {
  const team = useStore(s => s.team);
  const departments = useStore(s => s.departments);
  const approvers = approversOf(team, departments, city);
  const canApprove = approvers.some(m => m.id === memberId);
  const [sel, setSel] = useState<string | null>(claims.find(c => c.status === "submitted")?.id ?? null);
  const [question, setQuestion] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const open = claims.filter(c => c.status === "submitted" || c.status === "question");
  const approved = claims.filter(c => c.status === "approved");
  const cur = claims.find(c => c.id === sel);
  const set = (id: string, patch: Partial<Claim>) => setClaims(l => l.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const nextOpen = (after: string) => open.find(c => c.id !== after && c.status === "submitted")?.id ?? null;
  const toPay = approved.filter(c => picked.has(c.id));

  const sepa = () => {
    const xml = sepaXml(toPay);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
    a.download = `sepa-oneaim-${new Date().toISOString().slice(0, 10)}.xml`;
    a.click();
    toast(`SEPA file with ${toPay.length} transfers downloaded. Upload it in the bank's online banking.`);
  };
  const markPaid = async () => {
    if (!(await confirmDialog({ title: "Mark as paid?", confirmLabel: "Mark as paid",
      message: `Did the bank carry out the ${toPay.length} transfer${toPay.length === 1 ? "" : "s"} (${money(toPay.reduce((s, c) => s + c.amount, 0))})? The members get an email.` }))) return;
    const today = new Date().toISOString().slice(0, 10);
    setClaims(l => l.map(c => (picked.has(c.id) ? { ...c, status: "paid", paidAt: today } : c)));
    setTxs(l => [...toPay.map(c => ({
      id: nextId("t"), city: c.city, date: today, counterparty: c.who, purpose: `Auslagenerstattung ${c.what}`, amount: -c.amount,
      kind: "transfer" as const, claimId: c.id, receipt: c.receipt, category: c.category, project: c.project,
    })), ...l]);
    setPicked(new Set());
    toast("Marked as paid. The cash book entries were created with the receipts attached.");
  };

  return (
    <div class="stack">
      <div class="card card--tint small">
        <strong>Who approves claims in {city}:</strong> the head of Finance & Legal and the presidents
        {approvers.length ? <> ({approvers.map(m => m.name).join(", ")})</> : " (nobody set yet in the Team overview)"}.
        {canApprove ? " That includes you." : " You can look, but not approve here."} Nobody approves their own claim.
      </div>
      <div class="stats">
        <div class="card stat"><span class="stat__num">{claims.filter(c => c.status === "submitted").length}</span><span class="stat__label">To check</span></div>
        <div class="card stat"><span class="stat__num">{claims.filter(c => c.status === "question").length}</span><span class="stat__label">Waiting for an answer</span></div>
        <div class="card stat"><span class="stat__num">{approved.length}</span><span class="stat__label">Approved, to pay</span><span class="muted small">{money(approved.reduce((s, c) => s + c.amount, 0))}</span></div>
      </div>

      <div class="finance-split">
        <section class="card card--flush">
          <div class="card__head" style="padding:18px 20px 0"><h2>Claims to check</h2></div>
          <div class="table-wrap">
            <table class="table">
              <tbody>
                {open.map(c => (
                  <tr class={`is-clickable ${sel === c.id ? "is-selected" : ""}`} onClick={() => setSel(c.id)}>
                    <td><strong style="color:var(--color-text-heading)">{c.who}</strong> <span class="muted small">· {c.city}</span><br /><span class="small">{c.what}</span></td>
                    <td style="text-align:right;white-space:nowrap"><strong>{money(c.amount)}</strong><br /><span class={`chip ${CLAIM_LABEL[c.status][1]}`}>{CLAIM_LABEL[c.status][0]}</span></td>
                  </tr>
                ))}
                {!open.length && <tr><td class="muted">Nothing to check.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section class="card stack">
          {!cur ? <p class="muted">Pick a claim on the left.</p> : <>
            <div class="row"><h2 style="flex:1;margin:0">{cur.what}</h2><span class={`chip ${CLAIM_LABEL[cur.status][1]}`}>{CLAIM_LABEL[cur.status][0]}</span></div>
            <div class="grid-2" style="align-items:start">
              <ReceiptView r={cur.receipt} />
              <dl class="qa">
                <div><dt>From</dt><dd>{cur.who} ({cur.city})</dd></div>
                <div><dt>Amount</dt><dd><strong>{money(cur.amount)}</strong></dd></div>
                <div><dt>Paid on</dt><dd>{fmtDate(cur.date)}</dd></div>
                <div><dt>For</dt><dd>{cur.project}</dd></div>
                <div><dt>Category</dt><dd>{cur.category} <span class="muted small">→ {CATEGORIES[cur.category]?.area}</span></dd></div>
                <div><dt>IBAN</dt><dd class="mono">{maskIban(cur.iban)}</dd></div>
              </dl>
            </div>
            {cur.note && <div class="card card--tint small"><strong>Question:</strong> {cur.note}</div>}
            {cur.status === "submitted" && (cur.who === me
              ? <p class="small field__error">Your own claim: another approver has to approve it (four-eyes rule).</p>
              : !canApprove
              ? <p class="small muted">Only the head of Finance & Legal or the presidents of {city} can approve this claim.</p>
              : <>
                  <textarea class="input" style="min-height:54px" placeholder="Question or reason (for “Ask” and “Reject”)" value={question} onInput={e => setQuestion(e.currentTarget.value)} />
                  <div class="row">
                    <button class="btn btn--ghost btn--sm" disabled={!question.trim()} onClick={() => { set(cur.id, { status: "rejected", note: question }); setQuestion(""); setSel(nextOpen(cur.id)); toast("Rejected, the member gets an email"); }}>Reject</button>
                    <span class="spacer" />
                    <button class="btn btn--secondary btn--sm" disabled={!question.trim()} onClick={() => { set(cur.id, { status: "question", note: question }); setQuestion(""); setSel(nextOpen(cur.id)); toast("Question sent to the member"); }}>Ask</button>
                    <button class="btn btn--primary btn--sm" onClick={() => { set(cur.id, { status: "approved" }); setSel(nextOpen(cur.id)); toast("Approved"); }}><IconCheck width={16} />Approve</button>
                  </div>
                </>)}
          </>}
        </section>
      </div>

      <section class="card card--flush">
        <div class="card__head" style="padding:18px 20px 0">
          <h2>Approved: pay</h2>
          <span class="muted small">Paid from the {city} account: select, download the SEPA file, upload it in online banking, then mark as paid.</span>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th style="width:36px"><input type="checkbox" aria-label="Select all" checked={approved.length > 0 && approved.every(c => picked.has(c.id))}
              onChange={e => setPicked(e.currentTarget.checked ? new Set(approved.map(c => c.id)) : new Set())} /></th><th>To</th><th>For</th><th>Account</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>
              {approved.map(c => (
                <tr>
                  <td><input type="checkbox" checked={picked.has(c.id)} onChange={() => setPicked(p => { const n = new Set(p); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} /></td>
                  <td><strong>{c.who}</strong></td><td class="small">{c.what}</td><td class="mono small">{maskIban(c.iban)}</td>
                  <td style="text-align:right"><strong>{money(c.amount)}</strong></td>
                </tr>
              ))}
              {!approved.length && <tr><td colSpan={5} class="muted">Nothing to pay.</td></tr>}
            </tbody>
          </table>
        </div>
        {toPay.length > 0 && (
          <div class="row" style="padding:12px 20px 18px">
            <span class="small" style="flex:1">{toPay.length} selected · <strong>{money(toPay.reduce((s, c) => s + c.amount, 0))}</strong></span>
            <button class="btn btn--secondary btn--sm" onClick={sepa}><IconDownload width={16} />SEPA file</button>
            <button class="btn btn--primary btn--sm" onClick={markPaid}>Mark as paid</button>
          </div>
        )}
      </section>
    </div>
  );
}

/** SEPA credit transfer file (pain.001) for online banking – mockup values for the debtor account */
function sepaXml(list: Claim[]) {
  const now = new Date().toISOString().slice(0, 19);
  const total = list.reduce((s, c) => s + c.amount, 0).toFixed(2);
  const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!)).slice(0, 140);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>ONEAIM-${Date.now()}</MsgId><CreDtTm>${now}</CreDtTm><NbOfTxs>${list.length}</NbOfTxs><CtrlSum>${total}</CtrlSum><InitgPty><Nm>OneAIM (MOCKUP)</Nm></InitgPty></GrpHdr>
    <PmtInf><PmtInfId>REIMB-${Date.now()}</PmtInfId><PmtMtd>TRF</PmtMtd><NbOfTxs>${list.length}</NbOfTxs><CtrlSum>${total}</CtrlSum>
      <ReqdExctnDt>${now.slice(0, 10)}</ReqdExctnDt><Dbtr><Nm>OneAIM (MOCKUP)</Nm></Dbtr><DbtrAcct><Id><IBAN>DE00000000000000000000</IBAN></Id></DbtrAcct><DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>
${list.map(c => `      <CdtTrfTxInf><PmtId><EndToEndId>${c.id}</EndToEndId></PmtId><Amt><InstdAmt Ccy="EUR">${c.amount.toFixed(2)}</InstdAmt></Amt><Cdtr><Nm>${esc(c.who)}</Nm></Cdtr><CdtrAcct><Id><IBAN>${c.iban}</IBAN></Id></CdtrAcct><RmtInf><Ustrd>${esc(`Auslagenerstattung ${c.what}`)}</Ustrd></RmtInf></CdtTrfTxInf>`).join("\n")}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`;
}

// ── City bank accounts ───────────────────────────────────────────────────

function Bank({ city, txs, claims, setTxs }: { city: string; txs: Tx[]; claims: Claim[]; setTxs: (f: (t: Tx[]) => Tx[]) => void }) {
  const team = useStore(s => s.team.filter(m => m.status === "active"));
  const [filter, setFilter] = useState<"all" | "missing">("missing");
  const [edit, setEdit] = useState<string | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const list = txs.filter(t => t.city === city).sort((a, b) => b.date.localeCompare(a.date));
  const needsReceipt = (t: Tx) => !t.receipt && t.kind !== "income";
  const needsCategory = (t: Tx) => !t.category;
  const shown = filter === "missing" ? list.filter(t => needsReceipt(t) || needsCategory(t)) : list;
  const balance = openingBalance(city) + list.reduce((s, t) => s + t.amount, 0);
  const cur = txs.find(t => t.id === edit);
  const set = (id: string, patch: Partial<Tx>) => setTxs(l => l.map(t => (t.id === id ? { ...t, ...patch } : t)));

  return (
    <div class="stack">
      {isDemo() ? (
        <div class="row">
          <span class="chip chip--green">● Connected to the bank</span>
          <span class="muted small" style="flex:1">Transactions come in automatically through the bank's interface (API), several times a day, and are matched with claims. Last sync today, 06:00.</span>
        </div>
      ) : (
        <div class="row">
          <span class="chip chip--gray">○ Not connected to the bank yet</span>
          <span class="muted small" style="flex:1">Once connected, transactions of the {city} account come in automatically several times a day.</span>
        </div>
      )}
      <div class="stats">
        <div class="card stat"><span class="stat__num">{money(balance)}</span><span class="stat__label">Balance</span><span class="muted small">OneAIM {city} account{isDemo() ? " · synced today, 06:00" : ""}</span></div>
        <div class="card stat"><span class="stat__num">{list.filter(needsReceipt).length}</span><span class="stat__label">Payments without receipt</span><span class="muted small">card payments, transfers, debits</span></div>
        <div class="card stat"><span class="stat__num">{list.filter(needsCategory).length}</span><span class="stat__label">Not categorized</span><span class="muted small">needed for the tax return</span></div>
      </div>
      <div class="row" style="gap:6px">
        <button class={`chip-btn ${filter === "missing" ? "is-active" : ""}`} onClick={() => setFilter("missing")}>Needs attention</button>
        <button class={`chip-btn ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")}>All transactions</button>
      </div>
      <div class="card card--flush">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date</th><th>Counterparty / purpose</th><th>Type</th><th style="text-align:right">Amount</th><th>Receipt</th><th>Category</th></tr></thead>
            <tbody>
              {shown.map(t => {
                const claim = claims.find(c => c.id === t.claimId);
                return (
                  <tr class="is-clickable" onClick={() => setEdit(t.id)}>
                    <td class="muted">{fmtDate(t.date)}</td>
                    <td><strong style="color:var(--color-text-heading)">{t.counterparty}</strong><br /><span class="muted small">{t.purpose}</span></td>
                    <td class="small">{KIND_LABEL[t.kind]}{claim && <><br /><span class="muted">reimbursement</span></>}</td>
                    <td style={`text-align:right;white-space:nowrap;font-weight:700;color:${t.amount < 0 ? "var(--color-text-heading)" : "#1A7F4B"}`}>{t.amount > 0 ? "+" : ""}{money(t.amount)}</td>
                    <td>{t.receipt ? <span class="chip chip--green">✓ {t.receipt.name.length > 18 ? t.receipt.name.slice(0, 16) + "…" : t.receipt.name}</span>
                      : t.kind === "income" ? <span class="muted small">not needed</span>
                      : t.requestedFrom ? <span class="chip chip--amber">asked {t.requestedFrom.split(" ")[0]}</span>
                      : <span class="chip chip--red">missing</span>}</td>
                    <td>{t.category ? <span class="small">{t.category}</span> : <span class="chip chip--gray">?</span>}</td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={6} class="muted">{list.length ? "Everything has a receipt and a category. 🎉" : "No transactions yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p class="muted small">Every payment of the city account needs a receipt: card payments, transfers and direct debits. Whoever paid with the card gets a reminder until the receipt is uploaded.</p>

      {cur && (
        <Modal title={`${cur.counterparty} · ${money(cur.amount)}`} onClose={() => setEdit(null)} wide>
          <div class="grid-2" style="align-items:start">
            <div class="stack-s">
              {cur.receipt || cur.kind !== "income" ? <ReceiptView r={cur.receipt} /> : <div class="receipt"><span class="muted small">Incoming payment: no receipt needed (a contract or invoice can be attached)</span></div>}
              <label class="btn btn--secondary btn--sm" style="align-self:flex-start">
                <input type="file" accept="image/*,application/pdf" style="display:none"
                  onChange={e => { const f = e.currentTarget.files?.[0]; if (f) { set(cur.id, { receipt: { name: f.name, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined }, requestedFrom: undefined }); toast("Receipt attached"); } }} />
                {cur.receipt ? "Replace receipt" : "Upload receipt"}
              </label>
              {!cur.receipt && cur.kind !== "income" && (
                <button class="btn btn--ghost btn--sm" style="align-self:flex-start" onClick={() => setAsk(cur.id)}>Ask a member for the receipt</button>
              )}
            </div>
            <div class="stack-s">
              <dl class="qa">
                <div><dt>Date</dt><dd>{fmtDate(cur.date)} · {KIND_LABEL[cur.kind]}</dd></div>
                <div><dt>Purpose (from the bank)</dt><dd>{cur.purpose}</dd></div>
                {cur.requestedFrom && <div><dt>Receipt requested from</dt><dd>{cur.requestedFrom}</dd></div>}
              </dl>
              <Field label="Category">
                <select class="input" value={cur.category ?? ""} onChange={e => set(cur.id, { category: e.currentTarget.value || undefined })}>
                  <option value="">Choose…</option>
                  {Object.keys(CATEGORIES).filter(c => !!CATEGORIES[c]!.income === cur.amount > 0).map(c => <option>{c}</option>)}
                </select>
              </Field>
              {cur.category && <p class="muted small">Tax area: <strong>{CATEGORIES[cur.category]!.area}</strong></p>}
              <Field label="Belongs to">
                <input class="input" placeholder="e.g. AIM Connect Aachen – SS 27" value={cur.project ?? ""} onInput={e => set(cur.id, { project: e.currentTarget.value || undefined })} />
              </Field>
              {cur.kind === "income" && !cur.category && /teilnahme/i.test(cur.purpose) && (
                <div class="card card--tint small">Looks like a participation fee: <strong>{cur.counterparty}</strong> is an accepted participant of AIM Connect Aachen – SS 27.
                  <button class="btn btn--secondary btn--sm" style="margin-top:8px" onClick={() => set(cur.id, { category: "Participation fees", project: "AIM Connect Aachen – SS 27" })}>Assign</button></div>
              )}
            </div>
          </div>
          <div class="row" style="justify-content:flex-end"><button class="btn btn--primary" onClick={() => setEdit(null)}>Done</button></div>
        </Modal>
      )}
      {ask && (
        <Modal title="Ask for the receipt" onClose={() => setAsk(null)}>
          <p class="small">Who paid this? They get an email with a link to upload the receipt, and a reminder after 3 days.</p>
          <select class="input" id="ask-member">
            {team.filter(m => m.city === city).map(m => <option>{m.name}</option>)}
            {team.filter(m => m.city !== city).slice(0, 10).map(m => <option>{m.name}</option>)}
          </select>
          <div class="row" style="justify-content:flex-end">
            <button class="btn btn--ghost" onClick={() => setAsk(null)}>Cancel</button>
            <button class="btn btn--primary" onClick={() => {
              const who = (document.getElementById("ask-member") as HTMLSelectElement).value;
              set(ask, { requestedFrom: who }); setAsk(null); toast(`${who} was asked for the receipt (mockup, no email sent)`);
            }}>Send request</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Cash book ────────────────────────────────────────────────────────────

function Book({ city, year, txs }: { city: string; year: string; txs: Tx[] }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => [...txs].sort((a, b) => a.date.localeCompare(b.date)).map((t, i) => ({ ...t, no: `${city.slice(0, 2).toUpperCase()}-${year}-${String(i + 1).padStart(3, "0")}` })), [txs, city, year]);
  const shown = rows.filter(t => (!q || `${t.counterparty} ${t.purpose} ${t.category ?? ""} ${t.project ?? ""}`.toLowerCase().includes(q.toLowerCase()))).reverse();
  const income = shown.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expenses = shown.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const byProject = [...shown.reduce((m, t) => m.set(t.project ?? "General / not assigned", (m.get(t.project ?? "General / not assigned") ?? 0) + t.amount), new Map<string, number>())].sort((a, b) => a[1] - b[1]);

  return (
    <div class="stack">
      <div class="row">
        <span class="small" style="flex:1">Books of <strong>OneAIM {city}</strong>, {year}, numbered per city and year (receipt numbers {city.slice(0, 2).toUpperCase()}-{year}-001, …).</span>
        <input class="input input--sm" style="max-width:260px" placeholder="Search…" value={q} onInput={e => setQ(e.currentTarget.value)} />
      </div>
      <div class="stats">
        <div class="card stat"><span class="stat__num" style="color:#1A7F4B">{money(income)}</span><span class="stat__label">Income</span></div>
        <div class="card stat"><span class="stat__num">{money(-expenses)}</span><span class="stat__label">Expenses</span></div>
        <div class="card stat"><span class="stat__num">{money(income + expenses)}</span><span class="stat__label">Result</span><span class="muted small">{year}</span></div>
      </div>
      <div class="grid-2" style="align-items:start;grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
        <div class="card card--flush">
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>No.</th><th>Date</th><th>Entry</th><th>Category</th><th style="text-align:right">Amount</th><th></th></tr></thead>
              <tbody>
                {shown.map(t => (
                  <tr>
                    <td class="mono small">{t.no}</td>
                    <td class="muted">{fmtDate(t.date)}</td>
                    <td><strong style="color:var(--color-text-heading)">{t.counterparty}</strong><br /><span class="muted small">{t.project ?? "–"}</span></td>
                    <td class="small">{t.category ?? <span class="chip chip--gray">?</span>}{t.category && <><br /><span class="muted">{CATEGORIES[t.category]!.area}</span></>}</td>
                    <td style={`text-align:right;white-space:nowrap;font-weight:700;color:${t.amount < 0 ? "var(--color-text-heading)" : "#1A7F4B"}`}>{t.amount > 0 ? "+" : ""}{money(t.amount)}</td>
                    <td>{t.receipt || t.kind === "income" ? <span title="Receipt attached" style="color:#1A7F4B">✓</span> : <span class="chip chip--red">no receipt</span>}</td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={6} class="muted">No entries for {city} in {year}.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <section class="card stack-s">
          <h3>Per program / project</h3>
          {byProject.map(([p, n]) => (
            <div class="row" style="flex-wrap:nowrap"><span class="small" style="flex:1;min-width:0">{p}</span><strong class="small" style={n >= 0 ? "color:#1A7F4B" : ""}>{money(n)}</strong></div>
          ))}
          <p class="muted small" style="margin-top:8px">With the participants from the applications, this shows e.g. the cost per participant of a round.</p>
        </section>
      </div>
    </div>
  );
}

// ── Year-end & tax ───────────────────────────────────────────────────────

/** All entries of a city as a spreadsheet (CSV, opens in Excel / Numbers) */
function exportCsv(city: string, year: string, txs: Tx[]) {
  const head = ["Receipt no.", "Date", "Counterparty", "Purpose", "Category", "Tax area", "Project", "Income", "Expense", "Receipt file"];
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const rows = [...txs].sort((a, b) => a.date.localeCompare(b.date)).map((t, i) => [
    `${city.slice(0, 2).toUpperCase()}-${year}-${String(i + 1).padStart(3, "0")}`, t.date, t.counterparty, t.purpose, t.category ?? "",
    t.category ? CATEGORIES[t.category]!.area : "", t.project ?? "", t.amount > 0 ? num(t.amount) : "", t.amount < 0 ? num(-t.amount) : "", t.receipt?.name ?? "",
  ]);
  const csv = "\uFEFF" + [head, ...rows].map(r => r.map(v => q(String(v))).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `oneaim-${city.toLowerCase()}-${year}-entries.csv`;
  a.click();
  toast("Spreadsheet downloaded (made-up data)");
}

function YearEnd({ city, year, txs, claims, onGo }: { city: string; year: string; txs: Tx[]; claims: Claim[]; onGo: (t: Tab) => void }) {
  const noReceipt = txs.filter(t => !t.receipt && t.kind !== "income").length;
  const noCategory = txs.filter(t => !t.category).length;
  const openClaims = claims.filter(c => c.status === "submitted" || c.status === "question" || c.status === "approved").length;
  const sum = (area: Area, sign: 1 | -1) => txs.filter(t => t.category && CATEGORIES[t.category]!.area === area && Math.sign(t.amount) === sign).reduce((s, t) => s + t.amount, 0);
  const donations = txs.filter(t => t.category === "Donations");
  const ready = !noReceipt && !noCategory && !openClaims;
  const checks: [boolean, string, string, Tab][] = [
    [!noReceipt, "Every payment has a receipt", `${noReceipt} payment${noReceipt === 1 ? "" : "s"} without receipt`, "bank"],
    [!noCategory, "Every transaction has a category", `${noCategory} not categorized`, "bank"],
    [!openClaims, "No open claims", `${openClaims} claim${openClaims === 1 ? "" : "s"} not paid or decided yet`, "inbox"],
  ];
  return (
    <div class="stack">
      <div class="grid-2" style="align-items:start">
        <section class="card stack-s">
          <h2>OneAIM {city}: ready for the {year} tax return?</h2>
          {checks.map(([ok, good, bad, go]) => (
            <div class="row" style="flex-wrap:nowrap">
              <span class={`chip ${ok ? "chip--green" : "chip--amber"}`}>{ok ? "✓" : "!"}</span>
              <span class="small" style="flex:1">{ok ? good : bad}</span>
              {!ok && <button class="btn btn--ghost btn--sm" onClick={() => onGo(go)}>Fix</button>}
            </div>
          ))}
          <div class="row" style="margin-top:8px">
            <button class="btn btn--primary" disabled={!ready}
              onClick={() => toast("Here the full package would download: summary PDF, spreadsheet and all receipts as ZIP (mockup)")}><IconDownload width={16} />Download tax package</button>
            <button class="btn btn--secondary" onClick={() => exportCsv(city, year, txs)}><IconDownload width={16} />Entries as spreadsheet</button>
          </div>
          <p class="muted small">{ready ? "" : "The full package is available once everything above is done; the spreadsheet works any time. "}
            The package is made for filling in the tax return of a non-profit association yourself (corporate tax return with the non-profit annex, Anlage Gem), without a tax advisor:
            a summary with the profit statement per tax area, all entries as a spreadsheet, all receipts numbered as a ZIP, and the list of donations.</p>
        </section>
        <section class="card stack-s">
          <h2>Donation receipts</h2>
          <p class="muted small">Donors get an official donation receipt (Zuwendungsbestätigung), made from this list.</p>
          {donations.map(t => <div class="row"><span class="small" style="flex:1">{t.counterparty} · {fmtDate(t.date)}</span><strong class="small">{money(t.amount)}</strong>
            <button class="btn btn--ghost btn--sm" onClick={() => toast("Donation receipt as PDF (mockup)")}>PDF</button></div>)}
        </section>
      </div>

      <section class="card card--flush">
        <div class="card__head" style="padding:18px 20px 0"><h2>Profit statement per tax area</h2><span class="muted small">Einnahmen-Überschuss-Rechnung · 1 Jan – 31 Dec {year}</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Tax area</th><th style="text-align:right">Income</th><th style="text-align:right">Expenses</th><th style="text-align:right">Result</th></tr></thead>
            <tbody>
              {AREAS.map(([a, desc]) => (
                <tr>
                  <td><strong style="color:var(--color-text-heading)">{a}</strong><br /><span class="muted small">{desc}</span></td>
                  <td style="text-align:right">{money(sum(a, 1))}</td>
                  <td style="text-align:right">{money(-sum(a, -1))}</td>
                  <td style="text-align:right"><strong>{money(sum(a, 1) + sum(a, -1))}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="muted small" style="padding:0 20px 18px">Which category belongs to which tax area is a suggestion, set once in the settings; after that every entry is split automatically. Worth checking once with someone who knows non-profit taxes.</p>
      </section>
    </div>
  );
}

// ── Money in & out per city ──────────────────────────────────────────────

function Overview({ city, year, txs }: { city: string; year: string; txs: Tx[] }) {
  const mine = txs.filter(t => t.city === city && t.date.startsWith(year));
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const thisMonth = new Date().toISOString().slice(0, 7);
  // Mock history (in, out) per month; the real mock transactions are added on top
  const history: Record<string, [number, number][]> = !isDemo() ? {} : {
    "2025": [[0, 18], [320, 140], [450, 380], [60, 90], [180, 120], [510, 470], [140, 60], [0, 25], [400, 310], [880, 620], [260, 340], [120, 410]],
    "2026": [[0, 22], [350, 160], [520, 410], [80, 75], [210, 150], [420, 310], [150, 95], [0, 42], [380, 260], [900, 540], [0, 0], [0, 0]],
  };
  const scale = city === "Aachen" ? 1 : city === "Munich" ? 0.7 : 0.4;
  const per = months.map((m, i) => {
    const real = mine.filter(t => t.date.startsWith(m));
    const [hi, ho] = history[year]?.[i] ?? [0, 0];
    return {
      m, future: m > thisMonth,
      inn: hi * scale + real.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),
      out: ho * scale - real.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0),
      hi: hi * scale, ho: ho * scale,
    };
  });
  const max = Math.max(1, ...per.flatMap(p => [p.inn, p.out]));
  const monthName = (m: string) => new Date(`${m}-01`).toLocaleDateString("en-GB", { month: "short" });
  // Categories over the whole year: real entries plus the mock history split into typical categories
  const byCat = (sign: 1 | -1) => {
    const m = new Map<string, number>();
    for (const t of mine.filter(x => Math.sign(x.amount) === sign)) m.set(t.category ?? "Not categorized", (m.get(t.category ?? "Not categorized") ?? 0) + Math.abs(t.amount));
    const split: [string, number][] = sign > 0
      ? [["Participation fees", 0.7], ["Sponsoring", 0.2], ["Donations", 0.1]]
      : [["Food & drinks", 0.4], ["Room rent", 0.3], ["Printing & marketing", 0.2], ["Software & tools", 0.1]];
    const hist = per.reduce((s, p) => s + (sign > 0 ? p.hi : p.ho), 0);
    for (const [c, f] of split) m.set(c, (m.get(c) ?? 0) + hist * f);
    return [...m].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  };
  const totalIn = per.reduce((s, p) => s + p.inn, 0), totalOut = per.reduce((s, p) => s + p.out, 0);
  // Opening balance of the year (mock), end = opening + result
  const histResult = (y: string) => (history[y] ?? []).reduce((s, [i, o]) => s + (i - o) * scale, 0);
  const open2026 = openingBalance(city) - histResult("2026");
  const opening = year === "2025" ? open2026 - histResult("2025") : open2026;
  const past = year < thisMonth.slice(0, 4);

  return (
    <div class="stack">
      <div class="stats">
        <div class="card stat"><span class="stat__num">{money(opening)}</span><span class="stat__label">Balance on 1 Jan {year}</span></div>
        <div class="card stat"><span class="stat__num" style="color:#1A7F4B">+{money(totalIn)}</span><span class="stat__label">Money in, {year}</span></div>
        <div class="card stat"><span class="stat__num">−{money(totalOut)}</span><span class="stat__label">Money out, {year}</span></div>
        <div class="card stat"><span class="stat__num">{money(opening + totalIn - totalOut)}</span><span class="stat__label">{past ? `Balance on 31 Dec ${year}` : "Balance today"}</span>
          <span class="muted small" style={`color:${totalIn - totalOut >= 0 ? "#1A7F4B" : "inherit"}`}>{totalIn - totalOut >= 0 ? "+" : "−"}{money(Math.abs(totalIn - totalOut))} this year</span></div>
      </div>
      <section class="card stack-s">
        <div class="row"><h2 style="flex:1;margin:0">{year} per month</h2>
          <span class="small"><span class="money-key money-key--in" /> in <span class="money-key money-key--out" style="margin-left:10px" /> out</span></div>
        <div class="money-chart">
          {per.map(p => (
            <div class={`money-chart__col ${p.future ? "is-future" : ""}`} title={p.future ? `${monthName(p.m)}: not yet` : `${monthName(p.m)}: +${money(p.inn)} / −${money(p.out)}`}>
              <div class="money-chart__bars">
                <span class="money-chart__bar money-chart__bar--in" style={`height:${(p.inn / max) * 100}%`} />
                <span class="money-chart__bar money-chart__bar--out" style={`height:${(p.out / max) * 100}%`} />
              </div>
              <span class="small muted">{monthName(p.m)}</span>
              <span class="small" style={`font-weight:700;color:${p.inn - p.out >= 0 ? "#1A7F4B" : "var(--color-text-heading)"}`}>
                {p.future ? "–" : `${p.inn - p.out >= 0 ? "+" : "−"}${Math.round(Math.abs(p.inn - p.out))} €`}</span>
            </div>
          ))}
        </div>
      </section>
      <div class="grid-2" style="align-items:start">
        {([[1, "Where money came from"], [-1, "What it was spent on"]] as const).map(([sign, title]) => (
          <section class="card stack-s">
            <h3>{title} <span class="muted small">({year})</span></h3>
            {byCat(sign).map(([c, n]) => (
              <div class="row" style="flex-wrap:nowrap"><span class="small" style="flex:1">{c}</span><strong class="small">{money(n)}</strong></div>
            ))}
            {!byCat(sign).length && <p class="muted small">Nothing yet.</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
