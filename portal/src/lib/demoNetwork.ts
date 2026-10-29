// Demo data for the members site: the same made-up people, team and
// alumni as in the team area (demo.ts), shown as network profiles, plus a
// few example board posts. Only in this browser, nothing is saved.
import type { State, TeamMember } from "./types";
import { withDemo } from "./demo";
import { appTitle } from "./fields";
import { subtitle } from "../components/team/MemberDrawer";
import type { NetworkProfile } from "../components/network/Profile";
import type { Post } from "../components/network/Board";

/** Everyone in the (demo) network, reduced to the fields a network profile may show. */
export function profilesFromState(s: State): NetworkProfile[] {
  const memberOf = new Map(s.team.filter(m => m.personId).map(m => [m.personId!, m]));
  const team = (m: TeamMember) => ({
    status: m.status, city: m.city, label: subtitle(m, s.departments), alumniSince: m.alumniSince, history: m.history,
  });
  const out: NetworkProfile[] = [];
  for (const p of s.people) {
    const taken = s.submissions
      .filter(x => x.personId === p.id && (x.status === "accepted" || x.status === "confirmed"))
      .map(x => s.applications.find(a => a.id === x.applicationId)!)
      .filter(Boolean)
      .sort((a, b) => b.dates.opensAt.localeCompare(a.dates.opensAt));
    const member = memberOf.get(p.id);
    // In the network: accepted after a selection, or (former) team member
    if (!taken.some(a => a.pipeline !== "instant") && !member) continue;
    out.push({
      key: p.id, name: p.name, photo: member?.photo, email: p.email, phone: p.phone, linkedin: p.linkedin ?? member?.linkedin,
      universities: p.universities, studyPrograms: p.studyPrograms, companies: p.companies, semester: p.semester, degree: p.degree,
      participations: taken.map(a => ({
        title: appTitle(a), program: a.tags.program, city: a.tags.location, semester: a.tags.semester, event: a.pipeline === "instant",
      })),
      team: member && team(member),
    });
  }
  return out;
}

/**
 * Made-up participants and alumni. The made-up current team is only added
 * while there's no real team yet (as in the team area), so cities don't get
 * two presidents.
 */
export function demoProfiles(tags: { locations: string[]; programs: string[] }, hasRealTeam: boolean): NetworkProfile[] {
  const empty: State = {
    team: [], scorecards: [], posts: [], networkAccounts: {}, departments: [], tagLists: { ...tags, semesters: [] },
    blueprints: [], applications: [], submissions: [], people: [], outbox: [], inbox: [], mailbox: null,
    universities: [], studyPrograms: [], companies: [],
  };
  return profilesFromState(withDemo(empty)).flatMap(p => {
    if (!hasRealTeam || p.team?.status !== "active") return [p];
    // Made-up team member who also took part in programs: keep them as a participant
    return p.participations.some(x => !x.event) ? [{ ...p, team: undefined }] : [];
  });
}

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();
const inDays = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

export const DEMO_POSTS: Post[] = [
  {
    id: "demo-post-1", kind: "job", title: "Working student Medical AI (m/f/d)", organization: "Virdx", location: "Munich / hybrid",
    date: inDays(21), link: "https://example.com/jobs/medical-ai",
    body: "We're looking for a working student (15–20 h/week) to help build our ML pipeline for medical imaging. Python and first experience with PyTorch required; a background in medicine or biomedical engineering is a plus.\n\nWrite to us and mention OneAIM!",
    status: "published", authorName: "Mia Schulz", authorIsTeam: true, createdAt: ago(2),
  },
  {
    id: "demo-post-2", kind: "event", title: "OneAIM Summit Munich", organization: "OneAIM Munich", location: "TUM Campus Munich",
    date: inDays(34),
    body: "Talks, workshops and a startup fair on AI in medicine. Free for all members of the OneAIM network; partners from industry and research are on site.",
    status: "published", authorName: "OneAIM Munich", authorIsTeam: true, createdAt: ago(5),
  },
  {
    id: "demo-post-3", kind: "job", title: "Master thesis: LLMs for clinical documentation", organization: "Uniklinik RWTH Aachen",
    location: "Aachen", date: inDays(45), link: "https://example.com/thesis-llm",
    body: "Master thesis in the Institute for Medical Informatics: evaluating large language models for discharge letters. Computer science, data science or medical informatics students welcome.",
    status: "published", authorName: "Lena Hoffmann", authorIsTeam: false, createdAt: ago(8),
  },
  {
    id: "demo-post-4", kind: "other", title: "AIM Connect Frankfurt: applications open",
    body: "The next AIM Connect round in Frankfurt is open. Know someone who'd be a great fit? Share it in your study groups!",
    status: "published", authorName: "Medi Bergmann", authorIsTeam: true, createdAt: ago(12),
  },
  {
    id: "demo-post-5", kind: "event", title: "Health Hackathon Aachen", organization: "OneAIM Aachen", location: "Aachen",
    date: inDays(-20),
    body: "48 hours, 12 teams, 3 clinical challenges. Thanks to everyone who joined!",
    status: "published", authorName: "OneAIM Aachen", authorIsTeam: true, createdAt: ago(40),
  },
];
