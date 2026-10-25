// Team area frame: redirects to the login when nobody is signed in,
// renders the sidebar and passes the city account to the page.
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { Account } from "../../lib/types";
import { currentAccount, loadAll, logout, useStore } from "../../lib/store";
import { Avatar, Toaster } from "../ui/Ui";
import {
  IconApps, IconBlueprint, IconExternal, IconHome, IconLogout, IconMail, IconMenu, IconNetwork, IconSettings,
} from "../ui/Icons";

export type NavKey = "overview" | "applications" | "blueprints" | "network" | "outbox" | "settings";

const NAV: { key: NavKey; label: string; href: string; Icon: typeof IconHome }[] = [
  { key: "overview", label: "Overview", href: "/team", Icon: IconHome },
  { key: "applications", label: "Applications", href: "/team/applications", Icon: IconApps },
  { key: "blueprints", label: "Blueprints", href: "/team/blueprints", Icon: IconBlueprint },
  { key: "network", label: "Network", href: "/team/network", Icon: IconNetwork },
  { key: "outbox", label: "Emails", href: "/team/outbox", Icon: IconMail },
];
const NAV2: typeof NAV = [
  { key: "settings", label: "Settings", href: "/team/settings", Icon: IconSettings },
];

export function TeamShell({ active, children }: { active: NavKey; children: (acc: Account) => ComponentChildren }) {
  const [acc, setAcc] = useState<Account | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const newCount = useStore(s => s.submissions.filter(x => x.status === "new").length);
  const unreadMail = useStore(s => s.inbox.filter(m => !m.readAt).length);

  useEffect(() => {
    (async () => {
      const a = await currentAccount();
      if (!a) {
        window.location.replace(`/team/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }
      try {
        await loadAll();
        setAcc(a);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  if (loadError) {
    return (
      <div class="empty" style="margin:48px auto;max-width:520px">
        <strong>Could not load data from Supabase.</strong><br />{loadError}<br /><br />
        <button class="btn btn--secondary" onClick={() => location.reload()}>Try again</button>
      </div>
    );
  }
  if (!acc) return <div class="loading" role="status" aria-label="Loading"><span /></div>;

  const item = (n: (typeof NAV)[number]) => (
    <a href={n.href} class={`nav__item ${active === n.key ? "is-active" : ""}`} aria-current={active === n.key ? "page" : undefined}>
      <n.Icon />{n.label}
      {n.key === "applications" && newCount > 0 && <span class="nav__badge" title="Applicants waiting for screening">{newCount}</span>}
      {n.key === "outbox" && unreadMail > 0 && <span class="nav__badge" title="Unread emails">{unreadMail}</span>}
    </a>
  );

  return (
    <div class="shell">
      <div class="mobile-bar">
        <button class="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><IconMenu /></button>
        <img src="/logo.png" alt="OneAIM" />
      </div>
      {open && <div class="overlay" style="z-index:45" onClick={() => setOpen(false)} />}
      <aside class={`sidebar ${open ? "is-open" : ""}`}>
        <a class="sidebar__brand" href="/team"><img src="/logo.png" alt="OneAIM" /><span>Team</span></a>
        <nav class="nav" aria-label="Team navigation">
          {NAV.map(item)}
          <div class="nav__section">Admin</div>
          {NAV2.map(item)}
          <a class="nav__item" href="/apply" target="_blank" rel="noopener"><IconExternal />Applicant site</a>
        </nav>
        <div class="sidebar__foot">
          <Avatar name={`OneAIM ${acc.city}`} />
          <div style="flex:1;min-width:0">
            <strong>{acc.city}</strong>
            <span class="muted small">{acc.email}</span>
          </div>
          <button class="icon-btn" title="Log out" aria-label="Log out"
            onClick={async () => { await logout(); window.location.href = "/team/login"; }}><IconLogout /></button>
        </div>
      </aside>
      <main class="main">{children(acc)}</main>
      <Toaster />
    </div>
  );
}

export function PageHead({ overline, title, sub, crumbs, actions }: {
  overline?: string; title: string; sub?: string; crumbs?: { label: string; href?: string }[]; actions?: ComponentChildren;
}) {
  return (
    <header class="page-head">
      <div class="page-head__title">
        {crumbs && (
          <nav class="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <>
                {i > 0 && <span aria-hidden="true">/</span>}
                {c.href ? <a href={c.href}>{c.label}</a> : <span>{c.label}</span>}
              </>
            ))}
          </nav>
        )}
        {overline && <p class="overline">{overline}</p>}
        <h1>{title}</h1>
        {sub && <p class="page-head__sub">{sub}</p>}
      </div>
      {actions && <div class="row">{actions}</div>}
    </header>
  );
}
