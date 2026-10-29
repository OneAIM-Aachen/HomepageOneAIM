// Members site: board with job postings, events and news. Everyone in the
// network reads it; team members post directly, other members submit posts
// that a team member approves.
import { useEffect, useState } from "preact/hooks";
import { fetchBoard, submitPost, withdrawPost, type Member } from "../../lib/members";
import { isPast, KIND_LABEL, PostCard, PostForm, type Post, type PostKind } from "../network/Board";
import { MembersShell } from "./MembersShell";
import { act, confirmDialog } from "../ui/Ui";
import { IconPlus } from "../ui/Icons";

export default function MembersBoard() {
  return <MembersShell active="board">{me => <Board me={me} />}</MembersShell>;
}

function Board({ me }: { me: Member }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [kind, setKind] = useState<PostKind | "">("");
  const [writing, setWriting] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const load = () => fetchBoard().then(setPosts).catch(() => setPosts([]));
  useEffect(() => { load(); }, []);
  if (!posts) return <div class="loading" role="status" aria-label="Loading"><span /></div>;

  const published = posts.filter(p => p.status === "published" && (!kind || p.kind === kind));
  const current = published.filter(p => !isPast(p));
  const past = published.filter(isPast);
  const mine = posts.filter(p => p.mine && p.status !== "published");

  return (
    <div class="stack" style="gap:20px">
      <header class="row row--between" style="align-items:flex-end">
        <div class="stack-s">
          <p class="overline">OneAIM network</p>
          <h1>Board</h1>
          <p class="muted">Jobs, events and news from the OneAIM community and our partners.</p>
        </div>
        <button class="btn btn--primary" onClick={() => setWriting(true)}><IconPlus width={18} />Write a post</button>
      </header>

      {mine.length > 0 && (
        <section class="stack-s">
          <h2 style="font-size:1.1rem">Your submissions</h2>
          <div class="board">
            {mine.map(p => (
              <PostCard post={p} status>
                <button class="btn btn--ghost btn--sm" onClick={async () => {
                  if (await confirmDialog({ title: "Withdraw this post?", message: p.title, confirmLabel: "Withdraw", danger: true })) {
                    act(async () => { await withdrawPost(p.id); await load(); }, "Post withdrawn");
                  }
                }}>{p.status === "pending" ? "Withdraw" : "Delete"}</button>
              </PostCard>
            ))}
          </div>
        </section>
      )}

      <div class="row" style="gap:6px" role="group" aria-label="Type">
        <button class={`chip-btn ${!kind ? "is-active" : ""}`} onClick={() => setKind("")}>All</button>
        {(["job", "event", "other"] as PostKind[]).map(k => (
          <button class={`chip-btn ${kind === k ? "is-active" : ""}`} onClick={() => setKind(k)}>{k === "other" ? "News" : `${KIND_LABEL[k]}s`}</button>
        ))}
      </div>

      {current.length ? <div class="board">{current.map(p => <PostCard post={p} />)}</div>
        : <div class="empty">Nothing here yet. Know a great job or event? Write a post.</div>}

      {past.length > 0 && (
        <section class="stack-s">
          <button class="btn btn--ghost btn--sm" style="align-self:flex-start" onClick={() => setShowPast(!showPast)}>
            {showPast ? "Hide" : "Show"} past events and closed jobs ({past.length})
          </button>
          {showPast && <div class="board">{past.map(p => <PostCard post={p} />)}</div>}
        </section>
      )}

      {writing && (
        <PostForm title="Write a post" submitLabel={me.isTeam ? "Publish" : "Submit for approval"}
          note={me.isTeam ? "As a team member your post is published right away." : "A team member checks your post before it appears on the board."}
          onClose={() => setWriting(false)}
          onSubmit={async d => {
            const r = await act(() => submitPost(d), s => (s === "published" ? "Post published" : "Thanks! Your post is waiting for approval."));
            if (r) { setWriting(false); await load(); }
          }} />
      )}
    </div>
  );
}
