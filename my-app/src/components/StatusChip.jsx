import React from "react";

const statusStyle = {
  ok: "bg-emerald-50/90 text-emerald-700 border-emerald-200/70",
  warn: "bg-amber-50/90 text-amber-700 border-amber-200/70",
  blocked: "bg-rose-50/90 text-rose-700 border-rose-200/70"
};

export default function StatusChip({ label, status = "ok" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${statusStyle[status] || statusStyle.ok}`}
    >
      {label}
    </span>
  );
}
