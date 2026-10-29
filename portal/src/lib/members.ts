// portal/src/lib/members.ts
//
// Data layer of the members site (/members, the OneAIM network site).
// Network logins have no table access: everything goes through the
// database functions network_directory / network_me / network_update_me,
// which only return what a network profile may show.

import type { NetworkProfile } from "../components/network/Profile";
import type { RoleEntry, TeamRole } from "./types";
import { IMAGES_BUCKET, friendlyError, supabase } from "./supabase";

export interface Member extends NetworkProfile {
  /** Also on the team: show the link to the team area */
  isTeam: boolean;
}

const ROLE: Record<TeamRole, string> = { president: "President", co_president: "Co-President", lead: "Team Lead", member: "Member" };

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapProfile(j: any): NetworkProfile {
  const t = j.team;
  return {
    key: j.key, name: j.name, photo: j.photo ?? undefined, email: j.email ?? undefined, phone: j.phone ?? undefined,
    linkedin: j.linkedin ?? undefined, universities: j.universities ?? [], studyPrograms: j.studyPrograms ?? [],
    semester: j.semester ?? undefined, degree: j.degree ?? undefined, participations: j.participations ?? [],
    team: t ? {
      status: t.status, city: t.city, alumniSince: t.alumniSince ?? undefined,
      label: t.position || (t.role === "lead" && t.department ? `Team Lead | ${t.department}` : ROLE[t.role as TeamRole]),
      history: (t.history ?? []).map((h: any) => ({
        id: h.id, city: h.city, role: h.role, department: h.department ?? undefined, position: h.position ?? undefined,
        from: h.from, to: h.to ?? undefined,
      }) as RoleEntry),
    } : undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw new Error(friendlyError(res.error));
  return res.data;
}

/** Signs in; only people in the OneAIM network (and team members) are let in. */
export async function memberLogin(email: string, password: string): Promise<Member> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) throw new Error("Email or password is wrong.");
  const me = await currentMember();
  if (!me) {
    await supabase.auth.signOut();
    throw new Error("This account is not part of the OneAIM network.");
  }
  return me;
}

export async function memberLogout() {
  await supabase.auth.signOut();
}

export async function currentMember(): Promise<Member | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const { data: ok } = await supabase.rpc("is_network_member");
  if (ok !== true) return null;
  const { data: me, error } = await supabase.rpc("network_me");
  if (error || !me) return null;
  return { ...mapProfile(me), isTeam: !!(me as { isTeam?: boolean }).isTeam };
}

export async function fetchDirectory(): Promise<NetworkProfile[]> {
  return (check(await supabase.rpc("network_directory")) as unknown[]).map(mapProfile);
}

export type MemberPatch = Partial<Pick<NetworkProfile, "phone" | "linkedin" | "universities" | "studyPrograms" | "semester" | "degree" | "photo">>;

export async function updateMe(p: MemberPatch) {
  check(await supabase.rpc("network_update_me", { p }));
}

/** Own photo → public bucket (folder network/<user id>/), returns its URL. */
export async function uploadMemberPhoto(file: File): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please log in again.");
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `network/${data.user.id}/${crypto.randomUUID()}.${ext}`;
  check(await supabase.storage.from(IMAGES_BUCKET).upload(path, file, { contentType: file.type }));
  return supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** "Forgot password?" / first login: emails a link if the address belongs to someone in the network. */
export async function requestMemberLink(email: string) {
  const { error } = await supabase.functions.invoke("team-accounts", { body: { action: "reset", site: "members", email: email.trim() } });
  if (error) throw new Error("Could not send the link. Please try again later.");
}

/** Redeems the link from the welcome / password email. */
export async function redeemMemberLink(tokenHash: string, type: "invite" | "recovery"): Promise<Member | null> {
  await supabase.auth.signOut();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) throw new Error("This link has expired or was already used. Use “Forgot password?” on the login page to get a new one.");
  return currentMember();
}

export async function setMemberPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
