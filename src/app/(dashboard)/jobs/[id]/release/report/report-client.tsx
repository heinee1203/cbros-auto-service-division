"use client";

import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

export default function ReportClient({
  completionReportToken,
}: {
  completionReportToken?: string | null;
}) {
  const router = useRouter();

  return (
    <div className="no-print flex items-center gap-3 mb-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 px-4 py-2 text-sm border border-surface-300 rounded-lg hover:bg-surface-50"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <button
        onClick={() => {
          if (completionReportToken) {
            window.open(`/view/report/${completionReportToken}`, '_blank');
          } else {
            window.print();
          }
        }}
        className="flex items-center gap-2 px-4 py-2 text-sm bg-accent-600 text-white rounded-lg hover:bg-accent-700"
      >
        <Printer className="w-4 h-4" /> Print Report
      </button>
    </div>
  );
}
