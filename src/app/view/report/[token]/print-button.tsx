"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 bg-accent-600 text-white rounded-full shadow-lg hover:bg-accent-700 transition-colors"
    >
      <Printer className="w-5 h-5" />
      <span className="text-sm font-medium">Print</span>
    </button>
  );
}
