import React from "react";
import Card from "./Card";

export default function RightRail({ activePage, recommendationCount = 3, recommendations = [] }) {
  return (
    <div className="space-y-4">
      {activePage === "posts" && (
        <Card title="Connection Signals">
          <p className="text-sm text-stone-600">{recommendationCount} policy-safe recommendation(s) available.</p>
          <div className="mt-3 space-y-2">
            {recommendations.slice(0, 2).map((recommendation) => (
              <div key={recommendation.id} className="rounded-xl bg-stone-50 p-3">
                <p className="text-sm font-medium">{recommendation.name}</p>
                <p className="text-xs text-stone-500">
                  Score {(recommendation.score * 100).toFixed(0)}% · {recommendation.confidence}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activePage === "messages" && (
        <Card title="Session Info">
          <p className="text-sm text-stone-600">Live policy diagnostics are available in the chat panel.</p>
        </Card>
      )}

      {activePage === "profile" && (
        <Card title="Retention Policy">
          <ul className="space-y-1 text-sm text-stone-600">
            <li>Raw text: 24h</li>
            <li>Derived reports: 7d</li>
          </ul>
        </Card>
      )}
    </div>
  );
}
