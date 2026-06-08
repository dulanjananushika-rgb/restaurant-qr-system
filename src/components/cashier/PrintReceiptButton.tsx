"use client";

import { Printer } from "lucide-react";

export default function PrintReceiptButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 print:hidden"
    >
      <Printer size={16} />
      Print Receipt
    </button>
  );
}