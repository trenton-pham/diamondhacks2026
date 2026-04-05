import React from "react";
import Card from "./Card";
import { SIGNAL_THRESHOLDS } from "../utils/constants";

export default function RightRailPanel({
  activePage,
  recommendationCount = 3,
  recommendations = [],
  profile,
  setActivePage,
  setActiveThreadId
}) {
  const questionnaireComplete = Boolean(profile?.questionnaire?.completed);
  const highSignalRecommendations = recommendations
    .filter((recommendation) => recommendation.score >= SIGNAL_THRESHOLDS.PROMISING)
    .sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-4">
      {activePage === "posts" && (
        <Card title="High-Signal Matches">
          <p className="text-sm" style={{ color: "var(--text-soft)" }}>
            Ranked by compatibility score once the signal is promising or better.
          </p>
          {!questionnaireComplete && (
            <p className="mt-2 rounded-2xl px-3 py-2 text-xs" style={{ background: "rgba(255, 233, 205, 0.8)", color: "#a2633b" }}>
              Preference intake is incomplete, so match confidence stays reduced until the profile questions are filled out.
            </p>
          )}
          <div className="mt-3 space-y-2">
            {highSignalRecommendations.length ? (
              highSignalRecommendations.map((recommendation) => (
                <button
                  key={recommendation.id}
                  type="button"
                  onClick={() => {
                    setActiveThreadId?.(recommendation.threadId);
                    setActivePage?.("messages");
                  }}
                  className="w-full rounded-[22px] border p-3 text-left transition hover:bg-white/50"
                  style={{ background: "rgba(255, 242, 237, 0.88)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                      {recommendation.name}
                    </p>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                      style={{ background: "rgba(242, 116, 67, 0.14)", color: "var(--accent-deep)" }}
                    >
                      {(recommendation.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
                    {recommendation.score >= SIGNAL_THRESHOLDS.HIGH ? "High signal" : "Promising signal"}
                  </p>
                  <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-soft)" }}>
                    {recommendation.explanation?.explicit || recommendation.rationale}
                  </p>
                </button>
              ))
            ) : (
              <p className="rounded-[22px] border px-3 py-3 text-xs" style={{ background: "rgba(255, 242, 237, 0.88)", color: "var(--text-soft)" }}>
                No promising matches yet. Once a thread clears the threshold, it will appear here.
              </p>
            )}
          </div>
        </Card>
      )}

      {activePage === "messages" && (
        <Card title="Session Info">
          <p className="text-sm" style={{ color: "var(--text-soft)" }}>
            Live policy diagnostics are available in the chat panel.
          </p>
        </Card>
      )}

      {activePage === "profile" && (
        <Card title="Retention Policy">
          <ul className="space-y-1 text-sm" style={{ color: "var(--text-soft)" }}>
            <li>Raw text: 24h</li>
            <li>Derived reports: 7d</li>
          </ul>
        </Card>
      )}
    </div>
  );
}
