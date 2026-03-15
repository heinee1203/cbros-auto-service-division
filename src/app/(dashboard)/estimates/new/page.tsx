"use client";

import Link from "next/link";
import { InquiryWizard } from "@/components/estimates/inquiry-wizard";

export default function NewEstimatePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/estimates" className="text-sm text-surface-400 hover:text-primary">
          Estimates
        </Link>
        <span className="text-surface-300">/</span>
        <span className="text-sm font-medium text-primary">New Inquiry</span>
      </div>
      <InquiryWizard />
    </div>
  );
}
