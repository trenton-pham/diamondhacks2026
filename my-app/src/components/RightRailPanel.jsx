import React from "react";
import Card from "./Card";

export default function RightRailPanel({ activePage, recommendationCount = 3, recommendations = [], profile }) {
  const questionnaireComplete = Boolean(profile?.questionnaire?.completed);

  return (
    <div className="space-y-4">
      {activePage === "posts" && (
        <Card title="Connection Signals">
          <p className="text-sm" style={{ color: "var(--text-soft)" }}>
            {recommendationCount} policy-safe recommendation(s) available.
          </p>
          {!questionnaireComplete && (
            <p className="mt-2 rounded-2xl px-3 py-2 text-xs" style={{ background: "rgba(255, 233, 205, 0.8)", color: "#a2633b" }}>
              Preference intake is incomplete, so match confidence stays reduced until the profile questions are filled out.
            </p>
          )}
          <div className="mt-3 space-y-2">
            {recommendations.slice(0, 2).map((recommendation) => (
              <div key={recommendation.id} className="rounded-[22px] border p-3" style={{ background: "rgba(255, 242, 237, 0.88)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                  {recommendation.name}
                </p>
                <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                  Score {(recommendation.score * 100).toFixed(0)}% - {recommendation.confidence}
                </p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-soft)" }}>
                  {recommendation.explanation?.explicit || recommendation.rationale}
                </p>
              </div>
            ))}
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
