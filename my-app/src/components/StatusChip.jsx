import React from "react";

const statusStyle = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  blocked: "bg-rose-50 text-rose-700 border-rose-200"
};

export default function StatusChip({ label, status = "ok" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${statusStyle[status] || statusStyle.ok}`}>
      {label}
    </span>
  );
}
