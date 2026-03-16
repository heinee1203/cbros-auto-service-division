"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const IntakeWizard = dynamic(
  () => import("@/components/schedule/intake-wizard").then((m) => ({ default: m.IntakeWizard })),
  { ssr: false }
);

export default function IntakePage() {
  return (
    <Suspense fallback={<div style={{ color: "var(--sch-text-muted)", textAlign: "center", padding: "3rem" }}>Loading intake wizard...</div>}>
      <IntakeWizard />
    </Suspense>
  );
}
