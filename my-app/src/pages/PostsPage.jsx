import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import { createPost } from "../services/api";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

function deriveTags(text) {
  const lower = text.toLowerCase();
  const tags = [];
  if (lower.includes("museum") || lower.includes("museums") || lower.includes("writing")) tags.push("culture");
  if (lower.includes("project") || lower.includes("projects") || lower.includes("build")) tags.push("projects");
  if (lower.includes("book") || lower.includes("movie")) tags.push("interests");
  if (lower.includes("goal") || lower.includes("future")) tags.push("goals");
  return tags.length ? tags : ["new"];
}

export default function PostsPage({
  posts,
  profile,
  setPosts,
  setThreads,
  setRecommendations,
  setActiveThreadId,
  isAuthenticated = true
}) {
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
      const response = await createPost({
        ...optimistic,
        tags: deriveTags(optimistic.content)
      });
      setPosts((prev) => [response.post, ...prev.filter((p) => p.id !== optimistic.id)]);
      if (response.threads?.length) {
        setThreads(response.threads);
        setActiveThreadId(response.threads[0].id);
      }
      if (response.recommendations) {
        setRecommendations(response.recommendations);
      }
    } catch {
      setPosts((prev) => prev.filter((p) => p.id !== optimistic.id));
    }
  }

  return (
    <div className="space-y-4">
      {!profile?.questionnaire?.completed && (
        <Card title="Complete Preference Intake" className="border-none" >
          <p className="text-sm leading-6" style={{ color: "var(--text-soft)" }}>
            Add your friendship, dating, and dealbreaker preferences in Profile so the agent can make higher-confidence matches.
          </p>
        </Card>
      )}

      <Card title="Human Posts" right={<span className="soft-chip">AI read-only</span>}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!isAuthenticated}
          className="soft-input min-h-28 w-full"
          placeholder="Share a thoughtful update..."
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--text-soft)" }}>
            Only human-authored posts are publishable.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: remaining < 30 ? "#c07149" : "var(--text-soft)" }}>
              {remaining}
            </span>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!isAuthenticated || !draft.trim()}
              className="soft-button"
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
              <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                {post.timestamp}
              </p>
            </div>
            <div className="flex gap-2 text-xs" style={{ color: "var(--text-soft)" }}>
              <button type="button" className="soft-subtle-button">Like</button>
              <button type="button" className="soft-subtle-button">Comment</button>
              <button type="button" className="soft-subtle-button">Save</button>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-main)" }}>
            {post.content}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="soft-chip">
                #{tag}
              </span>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
