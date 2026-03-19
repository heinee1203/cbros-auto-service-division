"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

export default function PrintClient() {
  const router = useRouter();

  return (
    <div className="no-print flex items-center justify-between border-b border-surface-200 px-8 py-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm font-medium text-surface-600 hover:text-surface-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
      >
        <Printer className="w-4 h-4" />
        Print Report
      </button>
    </div>
  );
}
