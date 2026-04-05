import React, { useEffect, useMemo, useState } from "react";
import LeftNav from "./components/LeftNav";
import RightRail from "./components/RightRailPanel";
import PostsPage from "./pages/PostsPage";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useMessagesSession } from "./features/messages/useMessagesSession";
import { fetchBootstrap } from "./services/api";

export default function App() {
  const [activePage, setActivePage] = useLocalStorage("active_page", "posts");
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState({});
  const [eventsByThread, setEventsByThread] = useState({});
  const [sessions, setSessions] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetchBootstrap()
      .then((data) => {
        if (!mounted) return;
        setPosts(data.posts || []);
        setProfile(data.profile || null);
        setThreads(data.threads || []);
        setMessages(data.messages || {});
        setEventsByThread(data.events || {});
        setSessions(data.sessions || {});
        setRecommendations(data.recommendations || []);
        setActiveThreadId(data.threads?.[0]?.id || "");
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const currentSession = sessions[activeThreadId] || null;
  const currentEvents = eventsByThread[activeThreadId] || [];
  const messagesSession = useMessagesSession(activePage, activeThreadId, currentSession, currentEvents);

  const recommendationCount = useMemo(() => recommendations.length, [recommendations.length]);

  if (isLoading) {
    return (
      <main className="app-shell min-h-screen p-4 md:p-6">
        <p className="text-sm" style={{ color: "var(--text-soft)" }}>
          Loading DiamondHacks backend...
        </p>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen p-4 md:p-6">
      <header className="mb-6 rounded-[30px] border px-5 py-5 shadow-[0_24px_54px_rgba(123,82,94,0.08)]" style={{ background: "rgba(255, 248, 245, 0.84)" }}>
        <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-soft)" }}>
          Agent-to-agent introductions
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight md:text-[3.3rem]" style={{ color: "var(--text-main)" }}>
          DiamondHacks
        </h1>
        <p className="mt-2 max-w-2xl text-sm md:text-[15px]" style={{ color: "var(--text-soft)" }}>
          Agents read human posts, open policy-safe DMs, and surface compatibility matches with a little more warmth and clarity.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[220px,1fr,280px]">
        <div className="xl:block">
          <LeftNav activePage={activePage} onSelect={setActivePage} />
        </div>

        <section aria-live="polite" className="min-h-[60vh]">
          {activePage === "posts" && (
            <PostsPage
              posts={posts}
              profile={profile}
              setPosts={setPosts}
              setThreads={setThreads}
              setRecommendations={setRecommendations}
              setActiveThreadId={setActiveThreadId}
            />
          )}
          {activePage === "messages" && (
            <MessagesPage
              threads={threads}
              messages={messages}
              session={messagesSession}
              activeThreadId={activeThreadId}
              setActiveThreadId={setActiveThreadId}
              setMessages={setMessages}
              setEventsByThread={setEventsByThread}
              setThreads={setThreads}
              setSessions={setSessions}
              setRecommendations={setRecommendations}
            />
          )}
          {activePage === "profile" && <ProfilePage profile={profile} setProfile={setProfile} />}
        </section>

        <aside className="hidden xl:block">
          <RightRail
            activePage={activePage}
            recommendationCount={recommendationCount}
            recommendations={recommendations}
            profile={profile}
          />
        </aside>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-10 border-t p-2 backdrop-blur-md xl:hidden"
        style={{ background: "rgba(255, 248, 245, 0.95)" }}
      >
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
              className={`min-h-11 flex-1 rounded-2xl px-3 text-sm font-medium shadow-sm ${
                activePage === item.id ? "text-white" : ""
              }`}
              style={
                activePage === item.id
                  ? { background: "linear-gradient(135deg, var(--accent-main) 0%, var(--accent-deep) 100%)" }
                  : { background: "rgba(255, 239, 233, 0.92)", color: "var(--text-main)" }
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
