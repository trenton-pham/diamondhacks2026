import React, { useMemo, useState } from "react";
import LeftNav from "./components/LeftNav";
import RightRail from "./components/RightRail";
import PostsPage from "./pages/PostsPage";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { initialMessages, initialPosts, initialProfile, initialThreads } from "./services/mockData";
import { useMessagesSession } from "./features/messages/useMessagesSession";

export default function App() {
  const [activePage, setActivePage] = useLocalStorage("active_page", "posts");
  const [posts, setPosts] = useState(initialPosts);
  const [profile, setProfile] = useState(initialProfile);
  const messagesSession = useMessagesSession(activePage);

  const recommendationCount = useMemo(() => Math.max(1, Math.min(5, posts.length)), [posts.length]);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <header className="mb-4">
        <h1 className="font-display text-3xl tracking-tight">Social Media Dashboard</h1>
        <p className="text-sm text-stone-600">Bright editorial UI, privacy-first messaging, human-only posting.</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[220px,1fr,280px]">
        <div className="xl:block">
          <LeftNav activePage={activePage} onSelect={setActivePage} />
        </div>

        <section aria-live="polite" className="min-h-[60vh]">
          {activePage === "posts" && <PostsPage posts={posts} setPosts={setPosts} />}
          {activePage === "messages" && (
            <MessagesPage threads={initialThreads} messages={initialMessages} session={messagesSession} />
          )}
          {activePage === "profile" && <ProfilePage profile={profile} setProfile={setProfile} />}
        </section>

        <aside className="hidden xl:block">
          <RightRail activePage={activePage} recommendationCount={recommendationCount} />
        </aside>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t bg-white p-2 xl:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2">
          {[
            { id: "posts", label: "Posts" },
            { id: "messages", label: "Messages" },
            { id: "profile", label: "Profile" }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActivePage(item.id)}
              className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-medium ${
                activePage === item.id ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
