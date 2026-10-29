// Team portal: the network board. Approve or decline posts members
// submitted, write posts (published right away), edit and take posts down.
import { useState } from "preact/hooks";
import type { Account } from "../../lib/types";
import { createPost, deletePost, reviewPost, updatePost, useStore } from "../../lib/store";
import { isPast, PostCard, PostForm, type Post } from "../network/Board";
import { TeamShell, PageHead } from "./TeamShell";
import { act, confirmDialog, Field, Modal } from "../ui/Ui";
import { IconPlus } from "../ui/Icons";

export default function BoardPage() {
  return <TeamShell active="board">{acc => <Board acc={acc} />}</TeamShell>;
}

function Board({ acc }: { acc: Account }) {
  const posts = useStore(x => x.posts);
  const [writing, setWriting] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [declining, setDeclining] = useState<Post | null>(null);
  const [tab, setTab] = useState<"live" | "past" | "declined">("live");

  const pending = posts.filter(p => p.status === "pending");
  const live = posts.filter(p => p.status === "published" && !isPast(p));
  const past = posts.filter(p => p.status === "published" && isPast(p));
  const declined = posts.filter(p => p.status === "rejected");
  const shown = tab === "live" ? live : tab === "past" ? past : declined;

  const remove = async (p: Post) => {
    if (await confirmDialog({ title: "Delete this post?", message: p.title, danger: true, confirmLabel: "Delete" })) act(() => deletePost(p.id), "Post deleted");
  };

  return (
    <div class="stack">
      <PageHead overline="Network" title="Board"
        sub="Jobs, events and news on the network site. Members' posts appear after a team member approves them; your own posts go live right away."
        actions={<>
          <a class="btn btn--secondary" href="/members/board" target="_blank" rel="noopener">View on network site</a>
          <button class="btn btn--primary" onClick={() => setWriting(true)}><IconPlus width={18} />New post</button>
        </>} />

      <section class="stack-s">
        <h2 style="font-size:1.15rem">Waiting for approval{pending.length ? ` (${pending.length})` : ""}</h2>
        {pending.length === 0 && <p class="muted small">Nothing to review.</p>}
        <div class="board">
          {pending.map(p => (
            <PostCard post={p}>
              <button class="btn btn--primary btn--sm" onClick={() => act(() => reviewPost(p.id, "published", acc), "Published")}>Approve</button>
              <button class="btn btn--secondary btn--sm" onClick={() => setEditing(p)}>Edit</button>
              <span class="spacer" />
              <button class="btn btn--ghost btn--sm" style="color:var(--p-red)" onClick={() => setDeclining(p)}>Decline</button>
            </PostCard>
          ))}
        </div>
      </section>

      <div class="tabs" role="tablist">
        <button class={`tab ${tab === "live" ? "is-active" : ""}`} onClick={() => setTab("live")}>On the board<span class="count">{live.length}</span></button>
        <button class={`tab ${tab === "past" ? "is-active" : ""}`} onClick={() => setTab("past")}>Past<span class="count">{past.length}</span></button>
        <button class={`tab ${tab === "declined" ? "is-active" : ""}`} onClick={() => setTab("declined")}>Declined<span class="count">{declined.length}</span></button>
      </div>
      {shown.length === 0 && <div class="empty">No posts here.</div>}
      <div class="board">
        {shown.map(p => (
          <PostCard post={p} status>
            <button class="btn btn--secondary btn--sm" onClick={() => setEditing(p)}>Edit</button>
            {p.status === "published"
              ? <button class="btn btn--ghost btn--sm" onClick={() => act(() => reviewPost(p.id, "pending", acc), "Taken off the board")}>Take down</button>
              : <button class="btn btn--ghost btn--sm" onClick={() => act(() => reviewPost(p.id, "published", acc), "Published")}>Publish</button>}
            <span class="spacer" />
            <button class="btn btn--ghost btn--sm" style="color:var(--p-red)" onClick={() => remove(p)}>Delete</button>
          </PostCard>
        ))}
      </div>

      {writing && <PostForm title="New post" submitLabel="Publish" note="Published right away on the network site."
        onClose={() => setWriting(false)}
        onSubmit={async d => { if ((await act(() => createPost(d, acc), "Post published")) !== undefined) setWriting(false); }} />}
      {editing && <PostForm title="Edit post" submitLabel="Save" initial={editing}
        note={editing.status === "pending" ? `Submitted by ${editing.authorName}. Saving doesn't publish it yet; use “Approve”.` : undefined}
        onClose={() => setEditing(null)}
        onSubmit={async d => { if ((await act(() => updatePost(editing.id, d), "Saved")) !== undefined) setEditing(null); }} />}
      {declining && <DeclineModal post={declining} onClose={() => setDeclining(null)}
        onDecline={note => act(() => reviewPost(declining.id, "rejected", acc, note), "Declined").then(r => { if (r !== undefined) setDeclining(null); })} />}
    </div>
  );
}

function DeclineModal({ post, onClose, onDecline }: { post: Post; onClose: () => void; onDecline: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Modal title="Decline this post?" onClose={onClose}>
      <div class="stack">
        <p><strong>{post.title}</strong> by {post.authorName}</p>
        <Field label="Note for the author" help="Optional. They see it with their submission on the network site.">
          <textarea class="input" rows={3} value={note} onInput={e => setNote(e.currentTarget.value)} />
        </Field>
        <div class="row" style="justify-content:flex-end">
          <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button class="btn btn--primary" onClick={() => onDecline(note)}>Decline</button>
        </div>
      </div>
    </Modal>
  );
}
