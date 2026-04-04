import React from "react";
import { NAV_ITEMS } from "../utils/constants";

export default function LeftNav({ activePage, onSelect }) {
  return (
    <aside className="rounded-2xl border bg-white p-3 shadow-sm">
      <h2 className="px-2 pb-3 font-display text-xl">Social Match</h2>
      <nav aria-label="Primary">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
