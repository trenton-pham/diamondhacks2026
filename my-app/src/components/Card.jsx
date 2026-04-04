import React from "react";

export default function Card({ title, right, children, className = "" }) {
  return (
    <section className={`rounded-2xl border bg-white p-4 shadow-sm ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
          <div>{right}</div>
        </header>
      )}
      {children}
    </section>
  );
}
