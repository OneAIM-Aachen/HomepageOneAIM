// Frame of the members site: top bar, login guard. Network logins and team
// members get in; everyone else is sent to /members/login. Nothing here
// points to the team area: that part stays out of sight for members.
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { currentMember, memberLogout, type Member } from "../../lib/members";
import { Avatar, ConfirmHost, Toaster } from "../ui/Ui";
import { demoAvailable, isDemo, setDemo } from "../../lib/demo";
import { IconLogout } from "../ui/Icons";

export function MembersShell({ active, children }: { active: "directory" | "board" | "me"; children: (me: Member, reload: () => void) => ComponentChildren }) {
  const [me, setMe] = useState<Member | null | undefined>(undefined);
  const load = () => currentMember().then(m => {
    if (!m) window.location.replace(`/members/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    else setMe(m);
  });
  useEffect(() => { load(); }, []);
  if (!me) return <div class="loading" role="status" aria-label="Loading"><span /></div>;

  return (
    <div class="members">
      <header class="members__bar">
        <a class="members__brand" href="/members"><img src="/logo.png" alt="OneAIM" /><span>Network</span></a>
        <nav class="members__nav" aria-label="Network">
          <a href="/members" class={active === "directory" ? "is-active" : ""} aria-current={active === "directory" ? "page" : undefined}>Members</a>
          <a href="/members/board" class={active === "board" ? "is-active" : ""} aria-current={active === "board" ? "page" : undefined}>Board</a>
        </nav>
        <span class="spacer" />
        {demoAvailable() && (
          <label class="demo-switch members__demo" title="Adds made-up members and posts, only in this browser">
            <input type="checkbox" role="switch" checked={isDemo()} onChange={e => setDemo(e.currentTarget.checked)} />
            <span class="demo-switch__track" aria-hidden="true"><span /></span>
            <span>Demo data</span>
          </label>
        )}
        <a href="/members/me" class={`members__me ${active === "me" ? "is-active" : ""}`} title="My profile" aria-current={active === "me" ? "page" : undefined}><Avatar name={me.name} src={me.photo} /><span>{me.name.split(" ")[0]}</span></a>
        <button class="icon-btn" title="Log out" aria-label="Log out"
          onClick={async () => { await memberLogout(); window.location.href = "/members/login"; }}><IconLogout /></button>
      </header>
      <main class="members__main">
        {isDemo() && (
          <div class="demo-banner" role="status" style="margin-bottom:20px">
            <strong>Demo data is on:</strong> made-up members, alumni and posts are shown in addition to the real ones, only in this browser.
            <button class="btn btn--secondary btn--sm" onClick={() => setDemo(false)}>Show real data only</button>
          </div>
        )}
        {children(me, load)}
      </main>
      <Toaster />
      <ConfirmHost />
    </div>
  );
}
