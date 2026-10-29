// Frame of the members site: top bar, login guard. Network logins and team
// members get in; everyone else is sent to /members/login.
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { currentMember, memberLogout, type Member } from "../../lib/members";
import { Avatar, ConfirmHost, Toaster } from "../ui/Ui";
import { IconLogout } from "../ui/Icons";

export function MembersShell({ active, children }: { active: "directory" | "me"; children: (me: Member, reload: () => void) => ComponentChildren }) {
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
          <a href="/members/me" class={active === "me" ? "is-active" : ""} aria-current={active === "me" ? "page" : undefined}>My profile</a>
          {me.isTeam && <a href="/team">Team area</a>}
        </nav>
        <span class="spacer" />
        <a href="/members/me" class="members__me" title="My profile"><Avatar name={me.name} src={me.photo} /><span>{me.name.split(" ")[0]}</span></a>
        <button class="icon-btn" title="Log out" aria-label="Log out"
          onClick={async () => { await memberLogout(); window.location.href = "/members/login"; }}><IconLogout /></button>
      </header>
      <main class="members__main">{children(me, load)}</main>
      <Toaster />
      <ConfirmHost />
    </div>
  );
}
