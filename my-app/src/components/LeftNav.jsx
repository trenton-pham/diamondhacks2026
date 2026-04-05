import React from "react";
import { NAV_ITEMS } from "../utils/constants";

export default function LeftNav({ activePage, onSelect }) {
  return (
    <aside
      className="rounded-[30px] border p-4 shadow-[0_24px_48px_rgba(118,82,94,0.08)]"
      style={{ background: "rgba(255, 249, 246, 0.92)" }}
    >
      <p className="px-2 text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>
        DiamondHacks
      </p>
      <h2 className="px-2 pb-4 pt-1 font-display text-[1.55rem]" style={{ color: "var(--text-main)" }}>
        Match gently
      </h2>
      <nav aria-label="Primary">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 ${
                    active ? "text-white shadow-[0_14px_28px_rgba(180,88,97,0.22)]" : "hover:bg-white/60"
                  }`}
                  style={
                    active
                      ? {
                          background: "linear-gradient(135deg, var(--accent-main) 0%, var(--accent-deep) 100%)"
                        }
                      : { color: "var(--text-main)" }
                  }
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
