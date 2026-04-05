import React from "react";

export default function Card({ title, right, children, className = "" }) {
  return (
    <section
      className={`rounded-[28px] border p-5 shadow-[0_22px_54px_rgba(123,82,94,0.08)] backdrop-blur-sm ${className}`}
      style={{ background: "var(--surface-card)" }}
    >
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-[0.01em]" style={{ color: "var(--text-main)" }}>
            {title}
          </h3>
          <div>{right}</div>
        </header>
      )}
      {children}
    </section>
  );
}
