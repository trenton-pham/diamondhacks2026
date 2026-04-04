import React from "react";
import Card from "./Card";

export default function RightRail({ activePage, recommendationCount = 3 }) {
  return (
    <div className="space-y-4">
      {activePage === "posts" && (
        <Card title="Connection Signals">
          <p className="text-sm text-stone-600">{recommendationCount} policy-safe recommendation(s) available.</p>
          <p className="mt-2 text-xs text-stone-500">Compact view enabled for performance.</p>
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
