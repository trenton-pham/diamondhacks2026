import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import { createPost } from "../services/api";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

export default function PostsPage({ posts, setPosts, isAuthenticated = true }) {
  const [draft, setDraft] = useState("");
  const debounced = useDebouncedValue(draft, 180);
  const remaining = 280 - debounced.length;

  const sortedPosts = useMemo(() => posts, [posts]);

  async function handlePublish() {
    if (!draft.trim() || !isAuthenticated) return;
    const optimistic = {
      id: `temp-${Date.now()}`,
      author: "You",
      timestamp: "now",
      content: draft.trim(),
      tags: ["new"]
    };
    setPosts((prev) => [optimistic, ...prev]);
    setDraft("");
    try {
      const persisted = await createPost(optimistic);
      setPosts((prev) => [persisted, ...prev.filter((p) => p.id !== optimistic.id)]);
    } catch {
      setPosts((prev) => prev.filter((p) => p.id !== optimistic.id));
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Human Posts" right={<span className="text-xs text-stone-500">AI read-only</span>}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!isAuthenticated}
          className="min-h-24 w-full rounded-xl border p-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-stone-100"
          placeholder="Share a thoughtful update..."
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-stone-500">Only human-authored posts are publishable.</p>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${remaining < 30 ? "text-amber-600" : "text-stone-500"}`}>{remaining}</span>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!isAuthenticated || !draft.trim()}
              className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              Publish
            </button>
          </div>
        </div>
      </Card>

      {sortedPosts.map((post) => (
        <Card key={post.id}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{post.author}</p>
              <p className="text-xs text-stone-500">{post.timestamp}</p>
            </div>
            <div className="flex gap-2 text-xs text-stone-500">
              <button type="button">Like</button>
              <button type="button">Comment</button>
              <button type="button">Save</button>
            </div>
          </div>
          <p className="mt-3 text-sm text-stone-700">{post.content}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">
                #{tag}
              </span>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
